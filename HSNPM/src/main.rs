use std::collections::HashMap;
use std::net::SocketAddr;
use std::sync::{Arc, Mutex};
use std::time::Duration;

use chrono::{DateTime, Utc};
use reqwest::{Client, Response};
use serde::{Deserialize, Serialize};
use serde_json::{self, Value};
use tokio::sync::broadcast;
use uuid::Uuid;
use warp::{Filter, Reply};
use web_push::{IsahcWebPushClient, WebPushMessageBuilder, SubscriptionInfo, SubscriptionKeys, VapidSignatureBuilder, ContentEncoding, WebPushClient};

type Subscriptions = Arc<Mutex<HashMap<String, Subscription>>>;
type RoomEventSender = broadcast::Sender<RoomEvent>;

/// Web-Push 订阅信息
#[derive(Debug, Serialize, Deserialize)]
struct Subscription {
    endpoint: String,
    keys: SubscriptionKeys,
    expires_at: Option<DateTime<Utc>>,
    user_id: Option<u64>,
}

impl Clone for Subscription {
    fn clone(&self) -> Self {
        // SubscriptionKeys 可能没有实现 Clone，所以我们需要手动复制其字段
        // 假设 SubscriptionKeys 有 p256dh 和 auth 字段
        // 但我们可以使用序列化和反序列化来克隆
        let keys_json = serde_json::to_string(&self.keys).expect("Failed to serialize keys");
        let keys: SubscriptionKeys = serde_json::from_str(&keys_json).expect("Failed to deserialize keys");
        
        Subscription {
            endpoint: self.endpoint.clone(),
            keys,
            expires_at: self.expires_at,
            user_id: self.user_id,
        }
    }
}

/// 房间事件（从远程SSE接收）
#[derive(Debug, Clone, Serialize, Deserialize)]
struct RoomEvent {
    event_type: String,
    room: String,
    data: Option<Value>,
    user: Option<u64>,
    timestamp: DateTime<Utc>,
}

/// 远程SSE事件数据格式
#[derive(Debug, Clone, Serialize, Deserialize)]
struct SSERoomEventData {
    room: String,
    data: Option<Value>,
}

/// 远程SSE事件
#[derive(Debug, Clone, Serialize, Deserialize)]
struct SSERoomEvent {
    event: String,
    data: String,
}

/// 应用状态
struct AppState {
    subscriptions: Subscriptions,
    room_events: RoomEventSender,
    vapid_private_key: String,  // PEM格式的私钥
    vapid_public_key: String,   // Base64URL格式的公钥
    vapid_subject: String,
    remote_server_url: String,
}

impl AppState {
    fn new(
        vapid_private_key: String,
        vapid_public_key: String,
        vapid_subject: String,
        remote_server_url: String,
    ) -> Self {
        let (tx, _) = broadcast::channel(100);
        
        // 确保私钥是PEM格式（如果不是，尝试转换）
        let vapid_private_key = Self::ensure_pem_format(&vapid_private_key);
        
        AppState {
            subscriptions: Arc::new(Mutex::new(HashMap::new())),
            room_events: tx,
            vapid_private_key,
            vapid_public_key,
            vapid_subject,
            remote_server_url,
        }
    }
    
    /// 确保私钥是PEM格式，如果不是则尝试转换
    fn ensure_pem_format(private_key: &str) -> String {
        // 已是PEM格式（任意类型），直接返回
        if private_key.contains("-----BEGIN") {
            log::info!("私钥已经是PEM格式");
            return private_key.to_string();
        }

        log::info!("检测到非PEM格式私钥，尝试转换...");
        log::debug!("原始私钥长度: {} 字符", private_key.len());

        // Base64URL -> 标准Base64
        let b64 = private_key.replace('-', "+").replace('_', "/");
        let padding = (4 - b64.len() % 4) % 4;
        let b64_padded = format!("{}{}", b64, "=".repeat(padding));

        // 每64字符加换行（PEM 标准格式）
        let mut pem_body = String::new();
        for chunk in b64_padded.as_bytes().chunks(64) {
            pem_body.push_str(std::str::from_utf8(chunk).unwrap_or(""));
            pem_body.push('\n');
        }

        // ---------------------------------------------------------------
        // 关键修复：区分 PKCS#8 和 SEC1 两种 DER 格式
        //
        // web-push CLI / 某些工具生成的私钥是 PKCS#8 DER（base64 后以
        // MIGHAgEA 开头），必须先包成 BEGIN PRIVATE KEY 才能被 openssl
        // 解析，然后再提取 EC key 转成 BEGIN EC PRIVATE KEY 供 web-push
        // 库的 from_pem() 使用。
        //
        // openssl ecparam 生成的是 SEC1 格式，直接包成 BEGIN EC PRIVATE KEY。
        // ---------------------------------------------------------------

        // 先尝试按 PKCS#8 解析（BEGIN PRIVATE KEY）
        let pkcs8_pem = format!("-----BEGIN PRIVATE KEY-----\n{}-----END PRIVATE KEY-----", pem_body);
        if let Ok(pkey) = openssl::pkey::PKey::private_key_from_pem(pkcs8_pem.as_bytes()) {
            if let Ok(ec_key) = pkey.ec_key() {
                if let Ok(sec1_bytes) = ec_key.private_key_to_pem() {
                    if let Ok(sec1_pem) = String::from_utf8(sec1_bytes) {
                        log::info!("已将 PKCS#8 密钥成功转换为 EC SEC1 PEM 格式");
                        return sec1_pem;
                    }
                }
            }
        }

        // 再尝试按 SEC1 解析（BEGIN EC PRIVATE KEY）
        let sec1_pem = format!("-----BEGIN EC PRIVATE KEY-----\n{}-----END EC PRIVATE KEY-----", pem_body);
        if openssl::ec::EcKey::private_key_from_pem(sec1_pem.as_bytes()).is_ok() {
            log::info!("私钥已是有效的 SEC1 EC PEM 格式");
            return sec1_pem;
        }

        log::warn!("无法识别私钥格式（既非 PKCS#8 也非 SEC1），返回原始值——推送可能失败");
        private_key.to_string()
    }
}

#[tokio::main]
async fn main() {
    // 初始化日志
    env_logger::init();

    // 从环境变量加载配置
    dotenv::dotenv().ok();
    let vapid_private_key = std::env::var("VAPID_PRIVATE_KEY")
        .expect("VAPID_PRIVATE_KEY must be set");
    let vapid_public_key = std::env::var("VAPID_PUBLIC_KEY")
        .expect("VAPID_PUBLIC_KEY must be set");
    let vapid_subject = std::env::var("VAPID_SUBJECT")
        .expect("VAPID_SUBJECT must be set (e.g., mailto:admin@example.com)");
    
    // 记录密钥信息用于调试
    log::info!("VAPID公钥长度: {} 字符", vapid_public_key.len());
    log::debug!("VAPID公钥前20字符: {}...", &vapid_public_key.chars().take(20).collect::<String>());
    log::info!("VAPID私钥长度: {} 字符", vapid_private_key.len());
    log::debug!("VAPID私钥前50字符: {}...", &vapid_private_key.chars().take(50).collect::<String>());
    let remote_server_url = std::env::var("REMOTE_PHIRA_SERVER")
        .unwrap_or_else(|_| "https://phira.htadiy.com".to_string());

    let state = Arc::new(AppState::new(
        vapid_private_key,
        vapid_public_key,
        vapid_subject,
        remote_server_url,
    ));

    // 启动远程SSE监听任务
    let state_for_sse = state.clone();
    tokio::spawn(async move {
        listen_remote_sse(state_for_sse).await;
    });

    // 注册API路由
    let routes = api_routes(state.clone())
        .with(warp::cors().allow_any_origin().allow_methods(vec!["GET", "POST"]).allow_headers(vec!["Content-Type"]));

    // 启动服务器
    let port = std::env::var("PORT").unwrap_or_else(|_| "3030".to_string());
    let addr = format!("0.0.0.0:{}", port);
    println!("🚀 HSNPM通知服务启动于 http://{}", addr);
    println!("📡 正在连接到远程SSE: {}/api/rooms/listen", state.remote_server_url);
    warp::serve(routes).run(addr.parse::<SocketAddr>().unwrap()).await;
}

/// API路由定义
fn api_routes(state: Arc<AppState>) -> impl Filter<Extract = impl Reply, Error = warp::Rejection> + Clone {
    let state_filter = warp::any().map(move || state.clone());

    // POST /api/subscriptions - 注册 Web-Push 订阅（旧路径，保持兼容）
    let subscribe_api = warp::path!("api" / "subscriptions")
        .and(warp::post())
        .and(warp::body::json())
        .and(state_filter.clone())
        .and_then(handle_subscribe);

    // POST /subscriptions - 注册 Web-Push 订阅（新路径）
    let subscribe = warp::path!("subscriptions")
        .and(warp::post())
        .and(warp::body::json())
        .and(state_filter.clone())
        .and_then(handle_subscribe);

    // POST /subscriptions/verify - 验证订阅是否存在
    let verify_subscription = warp::path!("subscriptions" / "verify")
        .and(warp::post())
        .and(warp::body::json())
        .and(state_filter.clone())
        .and_then(handle_verify_subscription);

    // GET /health - 健康检查
    let health = warp::path!("health")
        .and(warp::get())
        .map(|| "OK");

    // 组合所有路由
    subscribe_api.or(subscribe).or(verify_subscription).or(health)
}

/// 处理Web-Push订阅
async fn handle_subscribe(
    subscription: Subscription,
    state: Arc<AppState>,
) -> Result<impl Reply, warp::Rejection> {
    let sub_id = Uuid::new_v4().to_string();
    let mut subs = state.subscriptions.lock().unwrap();
    subs.insert(sub_id.clone(), subscription);

    log::info!("新的Web-Push订阅注册: {}", sub_id);

    Ok(warp::reply::json(&serde_json::json!({
        "success": true,
        "id": sub_id
    })))
}

/// 验证Web-Push订阅是否存在
async fn handle_verify_subscription(
    subscription_data: Subscription,
    state: Arc<AppState>,
) -> Result<impl Reply, warp::Rejection> {
    let subs = state.subscriptions.lock().unwrap();
    
    // 查找匹配的订阅（基于 endpoint）
    let exists = subs.values().any(|sub| sub.endpoint == subscription_data.endpoint);
    
    log::info!("验证订阅 {}: {}", subscription_data.endpoint, if exists { "存在" } else { "不存在" });
    
    if exists {
        Ok(warp::reply::with_status(
            warp::reply::json(&serde_json::json!({
                "success": true,
                "exists": true
            })),
            warp::http::StatusCode::OK,
        ))
    } else {
        Ok(warp::reply::with_status(
            warp::reply::json(&serde_json::json!({
                "success": false,
                "exists": false,
                "error": "Subscription not found"
            })),
            warp::http::StatusCode::NOT_FOUND,
        ))
    }
}

/// 监听远程SSE事件
async fn listen_remote_sse(state: Arc<AppState>) {
    let sse_url = format!("{}/api/rooms/listen", state.remote_server_url);
    
    log::info!("开始监听远程SSE: {}", sse_url);

    loop {
        match connect_to_sse(&sse_url).await {
            Ok(mut response) => {
                log::info!("成功连接到远程SSE");
                
                // 处理SSE流
                while let Some(chunk) = response.chunk().await.transpose() {
                    match chunk {
                        Ok(data) => {
                            if let Ok(text) = String::from_utf8(data.to_vec()) {
                                process_sse_message(&text, state.clone()).await;
                            }
                        }
                        Err(e) => {
                            log::error!("读取SSE数据失败: {}", e);
                            break;
                        }
                    }
                }
            }
            Err(e) => {
                log::error!("连接远程SSE失败: {}", e);
            }
        }

        // 连接断开，等待后重试
        log::warn!("SSE连接断开，5秒后重试...");
        tokio::time::sleep(Duration::from_secs(5)).await;
    }
}

/// 连接到远程SSE
async fn connect_to_sse(url: &str) -> Result<Response, reqwest::Error> {
    let client = Client::new();
    client
        .get(url)
        .header("Accept", "text/event-stream")
        .header("Cache-Control", "no-cache")
        .send()
        .await
}

/// 处理SSE消息
async fn process_sse_message(message: &str, state: Arc<AppState>) {
    // SSE消息格式示例:
    // event: create_room
    // data: {"room": "房间名", "data": {...}}
    
    let mut event_type = None;
    let mut event_data = None;

    for line in message.lines() {
        if line.starts_with("event: ") {
            event_type = Some(line["event: ".len()..].trim().to_string());
        } else if line.starts_with("data: ") {
            let data_str = &line["data: ".len()..];
            match serde_json::from_str::<Value>(data_str.trim()) {
                Ok(data) => event_data = Some(data),
                Err(e) => {
                    log::error!("解析SSE数据失败: {} - {}", e, data_str);
                    return;
                }
            }
        }
    }

    if let (Some(event_type), Some(event_data)) = (event_type, event_data) {
        log::info!("收到SSE事件: {} - {:?}", event_type, event_data);
        
        // 只处理房间创建事件
        if event_type == "create_room" {
            // 解析房间数据
            let room_name = event_data.get("room")
                .and_then(|v| v.as_str())
                .unwrap_or("未知房间")
                .to_string();

            let room_data = event_data.get("data").cloned();

            // 构建房间事件
            let room_event = RoomEvent {
                event_type: event_type.clone(),
                room: room_name,
                data: room_data,
                user: None,
                timestamp: Utc::now(),
            };

            // 发送Web-Push通知
            send_web_push_notifications(&state, &room_event).await;
        }
    }
}

/// 发送Web-Push通知给所有订阅者
async fn send_web_push_notifications(state: &AppState, event: &RoomEvent) {
    let subscriptions = state.subscriptions.lock().unwrap().clone();
    
    if subscriptions.is_empty() {
        log::info!("没有Web-Push订阅者，跳过通知发送");
        return;
    }

    log::info!("向 {} 个订阅者发送Web-Push通知", subscriptions.len());

    let host_name = fetch_host_name(event.data.as_ref()).await;
    let notification_title = "HSNPhira服务器上有新房间";
    let notification_body = format!("房间名:{} 房主:{}", event.room, host_name);

    for (sub_id, subscription) in subscriptions.iter() {
        if let Err(e) = send_single_web_push_notification(state, subscription, &notification_title, &notification_body, &event.room).await {
            log::error!("向订阅者 {} 发送Web-Push失败: {}", sub_id, e);
        }
    }
}

/// 通过 Phira API 获取房主用户名
async fn fetch_host_name(data: Option<&Value>) -> String {
    let host_id = match data
        .and_then(|d| d.get("host"))
        .and_then(|v| v.as_u64())
    {
        Some(id) => id,
        None => return "未知".to_string(),
    };

    let url = format!("https://phira.5wyxi.com/user/{}", host_id);
    log::debug!("获取房主信息: {}", url);

    match Client::new()
        .get(&url)
        .header("Accept", "application/json")
        .send()
        .await
    {
        Ok(resp) if resp.status().is_success() => {
            match resp.json::<Value>().await {
                Ok(json) => json
                    .get("name")
                    .and_then(|v| v.as_str())
                    .unwrap_or("未知")
                    .to_string(),
                Err(e) => {
                    log::warn!("解析用户信息失败: {}", e);
                    format!("用户#{}", host_id)
                }
            }
        }
        Ok(resp) => {
            log::warn!("获取用户信息失败，状态码: {}", resp.status());
            format!("用户#{}", host_id)
        }
        Err(e) => {
            log::warn!("请求用户信息失败: {}", e);
            format!("用户#{}", host_id)
        }
    }
}

/// 发送单个Web-Push通知
async fn send_single_web_push_notification(
    state: &AppState,
    subscription: &Subscription,
    title: &str,
    body: &str,
    room_name: &str,
) -> Result<(), web_push::WebPushError> {
    let client = IsahcWebPushClient::new()?;

    // 构建VAPID签名
    // 首先创建 SubscriptionInfo
    // 克隆 SubscriptionKeys 通过序列化/反序列化
    let keys_json = serde_json::to_string(&subscription.keys).expect("Failed to serialize keys");
    log::debug!("序列化的keys JSON长度: {}", keys_json.len());
    let keys: SubscriptionKeys = serde_json::from_str(&keys_json).expect("Failed to deserialize keys");
    
    // 检查keys是否有效
    log::debug!("成功反序列化keys，准备构建SubscriptionInfo");

    let subscription_info = SubscriptionInfo {
        endpoint: subscription.endpoint.clone(),
        keys,
    };
    
    // 记录私钥信息用于调试
    log::debug!("VAPID私钥长度: {} 字节", state.vapid_private_key.len());
    
    let mut builder = VapidSignatureBuilder::from_pem(
        state.vapid_private_key.as_bytes(),
        &subscription_info,
    )
    .map_err(|e| {
        log::error!("VAPID私钥格式错误: {}", e);
        log::error!("私钥前100字符: {}...", &state.vapid_private_key.chars().take(100).collect::<String>());
        e
    })?;
    builder.add_claim("sub", state.vapid_subject.as_str());
    let signature = builder.build()?;

    // 构建通知消息
    let mut message_builder = WebPushMessageBuilder::new(&subscription_info);
    message_builder.set_vapid_signature(signature);
    
    // 构建 payload JSON
    let payload_json = serde_json::json!({
        "title": title,
        "body": body,
        "icon": format!("{}/logo.png", state.remote_server_url),
        "tag": "room-creation", // 使用相同的tag避免重复通知
        "data": {
            "room": room_name,
            "url": format!("{}/rooms", state.remote_server_url)
        }
    }).to_string();
    
    message_builder.set_payload(
        ContentEncoding::Aes128Gcm,
        payload_json.as_bytes()
    );
    message_builder.set_ttl(86400); // 24小时TTL
    let message = message_builder.build()?;

    client.send(message).await?;
    Ok(())
}
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use std::time::{Duration, SystemTime};

use chrono::{DateTime, Utc};
use futures::StreamExt;
use reqwest::{Client, Response};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use tokio::sync::broadcast;
use tokio_stream::wrappers::BroadcastStream;
use uuid::Uuid;
use warp::{Filter, Reply};
use web_push::{WebPushClient, WebPushMessageBuilder, SubscriptionInfo, SubscriptionKeys, VapidSignatureBuilder};

type Subscriptions = Arc<Mutex<HashMap<String, Subscription>>>;
type RoomEventSender = broadcast::Sender<RoomEvent>;

/// Web-Push 订阅信息
#[derive(Debug, Clone, Serialize, Deserialize)]
struct Subscription {
    endpoint: String,
    keys: SubscriptionKeys,
    expires_at: Option<DateTime<Utc>>,
    user_id: Option<u64>,
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
    vapid_private_key: Vec<u8>,
    vapid_public_key: String,
    vapid_subject: String,
    remote_server_url: String,
}

impl AppState {
    fn new(
        vapid_private_key: Vec<u8>,
        vapid_public_key: String,
        vapid_subject: String,
        remote_server_url: String,
    ) -> Self {
        let (tx, _) = broadcast::channel(100);
        AppState {
            subscriptions: Arc::new(Mutex::new(HashMap::new())),
            room_events: tx,
            vapid_private_key,
            vapid_public_key,
            vapid_subject,
            remote_server_url,
        }
    }
}

#[tokio::main]
async fn main() {
    // 初始化日志
    env_logger::init();

    // 从环境变量加载配置
    dotenv::dotenv().ok();
    let vapid_private_key = std::env::var("VAPID_PRIVATE_KEY")
        .expect("VAPID_PRIVATE_KEY must be set")
        .as_bytes()
        .to_vec();
    let vapid_public_key = std::env::var("VAPID_PUBLIC_KEY")
        .expect("VAPID_PUBLIC_KEY must be set");
    let vapid_subject = std::env::var("VAPID_SUBJECT")
        .expect("VAPID_SUBJECT must be set (e.g., mailto:admin@example.com)");
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
    warp::serve(routes).run(addr.parse().unwrap()).await;
}

/// API路由定义
fn api_routes(state: Arc<AppState>) -> impl Filter<Extract = impl Reply, Error = warp::Rejection> + Clone {
    let state_filter = warp::any().map(move || state.clone());

    // POST /api/subscriptions - 注册 Web-Push 订阅
    let subscribe = warp::path!("api" / "subscriptions")
        .and(warp::post())
        .and(warp::body::json())
        .and(state_filter.clone())
        .and_then(handle_subscribe);

    // GET /health - 健康检查
    let health = warp::path!("health")
        .and(warp::get())
        .map(|| "OK");

    // 组合所有路由
    subscribe.or(health)
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

    let host_name = extract_host_name(event.data.as_ref());
    let notification_title = "HSNPhira服务器上有新房间";
    let notification_body = format!("房间名:{} 房主:{}", event.room, host_name);

    for (sub_id, subscription) in subscriptions.iter() {
        if let Err(e) = send_single_web_push_notification(state, subscription, &notification_title, &notification_body, &event.room).await {
            log::error!("向订阅者 {} 发送Web-Push失败: {}", sub_id, e);
        }
    }
}

/// 提取房主名称
fn extract_host_name(data: Option<&Value>) -> String {
    data.and_then(|d| d.get("host"))
        .and_then(|host_id| host_id.as_u64())
        .map(|host_id| {
            // 这里应该调用用户信息API获取房主名称
            // 但为了简化，我们返回"未知"或使用host_id
            format!("用户#{}", host_id)
        })
        .unwrap_or_else(|| "未知".to_string())
}

/// 发送单个Web-Push通知
async fn send_single_web_push_notification(
    state: &AppState,
    subscription: &Subscription,
    title: &str,
    body: &str,
    room_name: &str,
) -> Result<(), web_push::WebPushError> {
    let client = WebPushClient::new()?;

    // 构建VAPID签名
    let signature = VapidSignatureBuilder::from_pem(
        &state.vapid_private_key,
        &subscription.endpoint,
        &state.vapid_subject,
    )?
    .build()?;

    // 构建通知消息
    let message = WebPushMessageBuilder::new(subscription)
        .vapid_signature(signature)
        .payload(
            serde_json::json!({
                "title": title,
                "body": body,
                "icon": format!("{}/logo.png", state.remote_server_url),
                "tag": "room-creation", // 使用相同的tag避免重复通知
                "data": {
                    "room": room_name,
                    "url": format!("{}/rooms", state.remote_server_url)
                }
            }).to_string().as_bytes()
        )
        .ttl(86400) // 24小时TTL
        .build()?;

    client.send(message).await?;
    Ok(())
}
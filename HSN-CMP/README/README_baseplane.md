# base-plane 插件说明

基础面板插件 `base-plane` 为前端面板提供登录、会话与简单的系统统计 SSE（Server Sent Events）接口。此文件说明插件约定、配置项和本地调试方法。

## 提供的 HTTP 接口

- POST `/api/login` — 接受 JSON body {username, password, remember}，会代理到外部鉴权服务（由 `configs/base-plane.json` 的 `user_system_url` 指定，默认 `https://phira.htadiy.cc`），成功后在 `temp/base-plane-token.json` 写入本地会话记录并返回本地 token。
- GET `/api/me` — 检查本地 token 或 Authorization: Bearer header，返回 user 信息或 401。
- GET `/api/sse/stats` — SSE 实时发送 CPU/内存/磁盘/网络统计（配置项 `sse_interval_seconds` 控制频率）。
- POST `/stop` — 优雅退出（loader 的 stop 操作会调用该接口）。

## 配置（`configs/base-plane.json`）

- `user_system_url`：鉴权服务地址，登录请求会 POST 到 `${user_system_url}/api/auth/login`。
- `loader_url`：loader 的地址（默认 `http://127.0.0.1:19999`）。
- `token_expiry_seconds`：本地生成 token 的有效期（秒）。
- `sse_interval_seconds`：SSE 推送间隔（秒）。

支持两种格式：平面 JSON 或 `meta`+`config[]`，插件会自动兼容并转换为内部平面格式。

## 日志与临时文件

- 插件启动时会在仓库根 `temp/` 下写入 `<id>.log`，第一行为 `id:<id>`；loader 会把 stdout/stderr 重定向到该文件。
- 会话 token 存储在 `temp/base-plane-token.json`，每次插件启动会清除旧的 token（按规范）。

## 本地调试

在不通过 loader 的情况下独立运行（仅用于开发）：

```powershell
cd plugins\base-plane
python -m pip install -r requirements.txt  # 如果有
python main.py
# 或使用 uvicorn
uvicorn main:app --host 127.0.0.1 --port 20001
```

注意：独立运行时需要手动在 manifest.json 指定 port，否则插件会自行退出。

## 安全与生产建议

- 确认 `user_system_url` 使用 HTTPS 并且对方证书有效，避免在网络中以明文转发密码。
- 生产环境请限制 CORS origin，设置更严格的日志保留策略并避免把敏感信息写入日志。

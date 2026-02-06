HSNPhira — 前端实现说明

概览
- 本仓库为 HSNPhira 前端实现（静态 HTML/CSS/原生 JS），遵循用户提供的 AI-Ready Spec 与 Original Spec。实现以最小假设为原则：任何缺失字段均不擅自填补，已在代码内用注释标注的假设均需后端确认。

已实现功能（精简）
- 项目骨架与样式：`index.html`、`src/css/styles.css`
- 核心模块：`src/js/core/event-bus.js`、`src/js/core/page-loader.js`、`src/js/core/sse-client.js`、`src/js/core/auth.js`
- UI 组件：`src/js/ui/message-toast.js`、`src/js/ui/lightbox.js`、`src/js/ui/header.js`、`src/js/ui/footer.js`
- 窗口组件：`src/js/window/*`（包含 `window-base.js`、`window-chart.js`、`window-room.js` 等）
- 页面脚本：`src/js/pages/pages.js`、`src/js/pages/charts-page.js`、`src/js/pages/users-page.js`
- 房间列表：调用 `/api/rooms/info` 渲染、使用 SSE `/api/rooms/listen` 实时更新（带重连与心跳）、已在表格中加入“曲绘”列与行内查看按钮

主要 API（按 Original Spec 使用）
- GET `/api/auth/visited/count` — 访问计数（兼容纯数字或 JSON {count}）
- GET `/api/rooms/info` — 房间列表（预期数组）
- SSE `/api/rooms/listen` — 房间相关实时事件（create_room / update_room / player_score / join_room / leave_room / start_round）
- GET `/hot_rank/{time_range}` — 谱面排行（charts page）
- GET `/chart/{chart-id}` — 外部谱面信息与 `illustration` 字段（用于曲绘展示，默认 external_api_base: https://phira.5wyxi.com）
- Auth: `/api/auth/login`、`/api/auth/logout`、`/api/auth/me`

配置
- `config/app_config.json`：
	- `api_mode`: `local` | `remote` | `mock`（当前默认 `local`）
	- `api_base_url`: 后端基础地址（默认 `http://localhost:7865`）
	- `external_api_base`: 外部谱面源（默认 `https://phira.5wyxi.com`）

运行与预览
- 建议使用简单静态服务器预览 `index.html`，示例（系统需安装 Python）：

```bash
# 在仓库根目录运行（端口可改）
python -m http.server 8000
# 或者（Python3 在 Windows 下）
py -3 -m http.server 8000
```

浏览器访问 http://localhost:8000 即可。

实现中的假设与注意事项
- Auth 默认采用 Cookie 会话（fetch 使用 `credentials: 'include'`）；如后端使用 token（Bearer），前端需切换实现。
- `/api/rooms/info` 返回结构以 Original Spec 为准；前端包含基础兼容与防护（字段存在性检查、SSE payload 验证），但若字段名或嵌套不同，将在联调时需要调整。
- 曲绘获取依赖外部 `/chart/{id}` 返回 `illustration|preview|file` 字段，若后端不提供则无法展示。
- 注册/验证等流程若依赖 SSE 特殊事件（或验证码），目前以占位/提示处理，需要后端确认契约。

开发进度（当前摘录）
- 核心实现：完成
- 页面与组件：大部分完成，`Implement pages` 与 `SSE production handling` 置为进行中（需后端事件字段确认）
- 测试：根据用户指示不需要自动完成测试流程（保留为未完成）

下一步建议
- 与后端联调，确认 SSE 事件字段与 `/api/rooms/info` 的实际返回结构
- 若需，可将 Auth 切换为 token 策略并补充安全存储说明
- 添加 README 的部署与打包脚本（若要生产化）

联系方式
- 若需要我继续：我可以立即对 README 进行扩展、生成联调检查表，或将文档拆分到 `docs/` 目录下。请指示想要的文档深度.


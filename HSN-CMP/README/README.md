## HSNMM — HSN Backend v3（开发文档）

这是 HSN 后端 v3 的开发仓库（原型）。包含一个轻量的插件加载器（loader）、插件示例与一个基础面板插件 `base-plane`，以及静态前端页面样例。

本 README 包含快速启动、加载器与插件开发约定、配置格式与调试提示。

### 快速开始（Windows / PowerShell）

1. 创建并激活虚拟环境：

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

2. 启动 loader（默认监听 127.0.0.1:19999）：

```powershell
C:\Users\HSNPhira\Desktop\HSNMM\.venv\Scripts\python.exe loader.py
```

3. 使用 loader 管理插件：

- 列出插件：GET http://127.0.0.1:19999/api/loader/plugins
- 重新扫描并分配端口：POST http://127.0.0.1:19999/api/loader/scan
- 启动插件：POST http://127.0.0.1:19999/api/loader/plugin/{pid}/start

4. 打开前端页面（静态）：

用任意静态服务器打开 `pages/`，例如：

```powershell
python -m http.server 8000
# 访问: http://127.0.0.1:8000/pages/Login.html
```

### 配置与验证

- 所有配置文件放在 `configs/` 下。支持两种格式：旧的平面 JSON（键值对），以及新的 `meta` + `config[]` 结构（每项包含 key/type/default 等）。加载器和插件均兼容两种格式。
- 使用验证脚本检查 manifest 与 config：

```powershell
python scripts/validate_configs.py
```

### Loader 简要说明 & 常用 API

- 负责：扫描 `plugins/`、分配端口、以子进程启动插件、提供管理 API、以及静态配置读取接口。
- 重要 API：
  - GET `/api/loader/plugins` — 返回当前 manifest 与运行状态
  - POST `/api/loader/scan?start=true|false` — 重新扫描 plugins，分配端口，若 start=true 则按 priority 启动插件
  - GET `/api/loader/config/{fname:path}` — 读取 `configs/` 下的指定文件（防止目录遍历）
  - GET `/api/loader/configs` — 列出全部 config 文件
  - POST `/api/loader/plugin/{pid}/start|stop|restart` — 控制单个插件
  - POST `/api/loader/stop_all` — 停止所有插件
  - POST `/api/loader/shutdown` — 停止所有插件并退出 loader

### 插件运行约定

- 每个插件位于 `plugins/<id>/`，必须包含 `manifest.json` 与 `main.py`。
- `manifest.json` 必须至少包含：`id`, `priority`, `name_cn`, `description_cn`, `version`, `port`。
- 插件应当实现一个 HTTP `/stop` 路径，用于优雅退出（loader 在 stop 时会尝试调用该路径）。
- loader 启动插件时会 `cwd` 到插件目录并用 `python main.py` 启动，插件的 stdout/stderr 会被重定向到 `temp/<id>.log`，第一行会写入 `id:<id>` 以便识别。

### 调试建议（常见问题）

- 端口占用（Address already in use）：检查哪个进程占用了端口（`netstat -ano | findstr ":19999"`）并结束它，或在 `configs/loader.json` 中修改 `loader_api_port`。
- 插件快速退出：查看 `temp/<plugin>.log` 的输出（首行为 `id:<plugin>`），同时确认 `manifest.json` 的 `port` 是否正确分配。
- CORS：开发时 loader 与 base-plane 默认开启 CORS 允许任意来源，生产请收紧。

### 进阶/下一步

- 可将 loader 配置成系统服务以随系统启动自动运行。
- 可增强每个插件的依赖隔离（virtualenv/venv per plugin）。

如果需要我可以把这些说明拆分成独立的 docs/ 文件或生成 Markdown 格式的 API 参考。
# HSN backend v3 - Loader 原型

包含一个基础的插件加载器原型（`loader.py`），以及一个用于联调的示例插件 `plugins/example-plugin`。

快速启动（Windows PowerShell）：

```powershell
python -m pip install -r requirements.txt
python loader.py
```

默认加载器监听端口由 `configs/loader.json` 中的 `loader_api_port` 指定（默认为 19999）。

使用加载器 API：
- GET  http://127.0.0.1:19999/api/loader/plugins
- POST http://127.0.0.1:19999/api/loader/plugin/example-plugin/start
- POST http://127.0.0.1:19999/api/loader/plugin/example-plugin/stop

示例插件 `example-plugin` 的 `manifest.json` 初始 `port` 字段为 null，加载器启动时会为其分配一个可用端口并写回 `manifest.json`。

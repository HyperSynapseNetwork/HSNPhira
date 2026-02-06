HSNPhira — Original Spec ↔ AI-Ready Spec Mapping

> 本文档是独立的映射文件（Index / Mapping），用于把「原始完整规格」精确指向 AI-Ready System Spec。

规则：当实现需要任何细节，必须通过本 Mapping 回溯原始规格；禁止自行推断。




---

使用与约束声明（必须阅读）

本 Mapping 不定义新规则

一切 MUST / SHOULD / MAY 以 AI-Ready System Spec 为最高裁决

本文件只回答一个问题：“细节在原始文档的哪里？”

AI 若无法指出其实现对应的原始章节 → 视为不合规实现



---

1. 页面级映射

页面	原始规格位置

Home	页面 → 主页 → 左侧 / 右侧
Room List	页面 → 房间列表
Chart Rank	页面 → 谱面排行
User Rank	页面 → 用户排行
Account	页面 → 账户管理
Tools	页面 → 谱面下载工具 / Phira 下载站
Navigation	页面 → 导航页



---

2. Window 组件映射

Window 组件	原始规格位置

window.base	window组件及其附属组件 → window组件
window.link	window-link组件
window.auth.entry	window-auth窗口组件
window.chart.detail	window-chart窗口组件
window.setting.panel	window-setting窗口组件



---

3. Core 模块映射

Core 模块	原始规格位置

core.pageLoader	页面加载组件
core.eventBus	消息总线组件
core.versionUpdater	页面更新组件



---

4. UI 组件映射

UI 组件	原始规格位置

ui.button.capsule	统一按钮基础样式 → 胶囊状
ui.button.rect	统一按钮基础样式 → 圆角矩形状
ui.table.glass3d	table组件
ui.message.toast	message组件
header.component	header组件
footer.component	footer组件



---

5. 配置系统映射

配置类型	原始规格位置

App Config	规范 → 配置文件 → 基础网页配置
User Preference Schema	用户偏好配置文件规范
Theme / Visual	视效与样式规范



---

6. API 映射

API 分类	原始规格位置

Auth	api格式 → /api/auth/*
Rooms	/api/rooms/info / listen
Rankings	/chart/* /hot_rank/*
Status	服务状态查询 /api/status
History	/api/history
External Phira	Phira 外部 API



---

7. 加载 / 启动 / 动效映射

功能	原始规格位置

Page Loader 生命周期	页面加载组件 → 加载管理
Loading Animation	页面加载动画
Startup Flow	加载规范



---

8. i18n / SEO / Meta 映射

功能	原始规格位置

i18n	国际化支持
Meta / SEO	meta标签规范



---

冲突处理（重要）

Mapping 没有裁决权

任意冲突：无条件以 AI-Ready System Spec 为准

Mapping 的职责仅限：定位、索引、防脑补



---

> 建议在所有 AI 对话中： AI-Ready System Spec + 本 Mapping + 原始完整规格 三者同时提供。
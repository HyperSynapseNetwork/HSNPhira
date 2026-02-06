HSNPhira — AI-Ready System Specification

> 本文档是 AI system spec，用于约束与引导 AI 生成前端 / 组件 / 页面代码。

所有标注为 MUST 的规则不可违反。




---

0. Project Vibe & Core Goals

Vibe Keywords

Glassmorphism / Liquid Glass

3D tilt on hover

Unified theme color

Modular / Component-driven

Event-driven architecture

SSE real-time updates


Core Goals

HTML / CSS / JS 严格分离

页面、组件、逻辑完全模块化

所有交互通过统一通信机制

强一致性的视觉与交互体验



---

1. Global Rules (Non-Negotiable)

1.1 MUST Rules

所有页面跳转 MUST 默认使用 window-link

所有跨组件通信 MUST 经由 core.eventBus

所有提示信息 MUST 使用 ui.message.toast

所有可配置行为 MUST 进入配置文件或用户偏好文件


1.2 SHOULD Rules

所有 UI 组件 SHOULD 具备 hover / active 微交互

所有窗口 SHOULD 支持 3D 倾斜与模糊动画


1.3 MAY Rules

页面 MAY 根据设备启用不同动效策略



---

2. System Layering

2.1 Core Layer

core.pageLoader

core.eventBus

core.versionUpdater


2.2 UI Layer

ui.button.capsule

ui.button.rect

ui.table.glass3d

ui.message.toast


2.3 Window Layer

window.base

window.link

window.auth.entry

window.chart.detail

window.setting.panel


2.4 Page Layer

Home

Room List

Chart Rank

User Rank

Account

Tools



---

3. Naming Convention

3.1 Component Naming

格式：

<domain>.<type>.<feature>

示例：

core.eventBus

ui.message.toast

window.chart.detail


3.2 File Naming

JS: kebab-case

CSS: kebab-case

Config: snake_case.json



---

4. Communication Specification

4.1 Event Bus

所有事件 MUST 预先声明

事件支持 sync / async

提供生命周期钩子：

beforeEmit

afterEmit

onError




---

5. Configuration System

5.1 App Config

API mode

Base URL

External API

Background

Particle effects


5.2 User Preference Config

严格遵循 schema

支持 boolean / free / option / restricted



---

6. Visual & Interaction Rules

6.1 Theme

默认主题色：#a1e5ef + #61E8EA

毛玻璃可继承主题色


6.2 Animation

所有 hover 动效需平滑

Window 打开 / 关闭 MUST 有统一动画



---

7. Page Specifications

7.1 Home

左：文字 + 动画

右：服务器状态 + 群号


7.2 Room List

Glass table

SSE 实时更新


7.3 Rankings

支持分页

支持 window-chart 打开



---

8. Window Specifications

8.1 window.base

生命周期完整

支持嵌套

统一关闭逻辑


8.2 window.link

接管默认跳转

内嵌页面浏览能力


8.3 window.chart.detail

Chart 信息聚合

下载能力

排行榜展示



---

9. API Contracts (Summary)

/api/auth/*

/api/rooms/*

/chart/*

/hot_rank/*


> 详细字段定义见原始 API 文档章节




---

10. Loader & Startup Flow

1. pageLoader 初始化


2. 配置文件加载


3. 组件注册


4. 首次渲染


5. 动效启用




---

11. Appendix

Loading animation HTML / CSS

Meta SEO rules

i18n strategy



---

12. Original Spec Mapping (Authoritative Reference)

> 本章节用于将 原始完整规格文档 映射到本 AI-Ready Spec 中，作为“细节权威来源”。

当 AI 在实现中需要更具体行为、字段或 UI 细节时，应回溯对应的原始章节，而不是自行推断。



12.1 页面级映射

AI-Ready Spec	原始规格位置

7.1 Home	页面 → 主页 → 左侧 / 右侧
7.2 Room List	页面 → 房间列表
7.3 Rankings	页面 → 谱面排行 / 用户排行
Account Page	页面 → 账户管理
Tools Page	页面 → 谱面下载工具 / Phira下载站


12.2 Window 组件映射

AI-Ready Window	原始规格位置

window.base	window组件及其附属组件 → window组件
window.link	window-link组件
window.auth.entry	window-auth窗口组件
window.chart.detail	window-chart窗口组件
window.setting.panel	window-setting窗口组件


12.3 Core 模块映射

Core Module	原始规格位置

core.pageLoader	页面加载组件
core.eventBus	消息总线组件
core.versionUpdater	页面更新组件


12.4 UI 组件映射

UI Component	原始规格位置

ui.button.capsule	统一按钮基础样式 → 胶囊状
ui.button.rect	统一按钮基础样式 → 圆角矩形状
ui.table.glass3d	table组件
ui.message.toast	message组件
footer.component	footer组件
header.component	header组件


12.5 配置系统映射

配置类别	原始规格位置

App Config	规范 → 配置文件 → 基础网页配置
User Preference Schema	用户偏好配置文件规范
Theme / Visual Config	视效与样式规范


12.6 API 映射

API Group	原始规格位置

Auth APIs	api格式 → /api/auth/*
Room APIs	/api/rooms/info / listen
Rank APIs	/chart/* /hot_rank/*
Status APIs	服务状态查询 /api/status
External Phira API	Phira外部 api



---

> 规则声明：

AI-Ready Spec 中的 MUST / SHOULD / MAY 为最高约束层级

原始规格文档用于补充实现细节，不得推翻 MUST 规则

若两者出现冲突，以 AI-Ready Spec 为准
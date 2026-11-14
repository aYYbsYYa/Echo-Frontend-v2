# Echo-Frontend-v2 · Yeve Echo 前端 v2（完全重构版）

> 社交是向外的喧嚣，Echo 是向内的回响。

这是 Yeve Echo 的**第二代前端**，也是在线演示 <https://echo.yeve.top> 当前运行的版本。它在 v1（[Echo-Frontend](https://github.com/aYYbsYYa/Echo-Frontend)）的基础上完全重构：补齐心笺（时光树洞）与灵笺（AI 自我对话）两条产品线，把硬件戒指链路替换为浏览器原生语音，统一了全站术语、导航、身份与设计令牌，并把视觉升级为「海 / 天 / 森 / 镜 / 星空」五套可交互动效场景。

- 服务端：<https://github.com/aYYbsYYa/Echo-Backtend>
- 第一代前端：<https://github.com/aYYbsYYa/Echo-Frontend>

---

## 一、项目介绍

### 1.1 产品定位

Yeve Echo 是一款「表达优先、而非社交优先」的情绪表达 Web 应用。它剥离公开的点赞数、评论列表与好友动态——内容仍会被陌生人偶然读到，但所有互动反馈只对发布者本人可见。产品用五条路径覆盖不同层次的情绪需求：

| 场景 | 路由 | 功能 | 一句话 |
| :--- | :--- | :--- | :--- |
| 海 | `/ocean` | **浮笺** | 把心事装进瓶子交给潮水，可捞起陌生人的回声 |
| 天 | `/sky` | **飞笺** | 把当下折成纸飞机掷向天空，或接住一张轻轻问候 |
| 森 | `/forest` | **心笺** | 埋一颗时光种子，按封存时长长成树，到期才能重新打开 |
| 灵 | `/echo` | **灵笺** | 与「另一个自己」对话，倾听模式接住情绪，镜像模式照见思维 |
| 魂 | `/soul` | **Agent to Agent** | 让两个 AI 灵魂镜像匿名相遇，只呈现共鸣分析，不提供任何连接入口 |
| 我 | `/mine` | 我的海与风 | 私有的发布统计、被拾起次数、心意与留言时间线 |

### 1.2 使用方式

1. 打开站点即进入灵笺（`/` 与 `/welcome` 均重定向到 `/echo`），无需注册：应用使用固定演示身份 `demo_user_main`（`src/store/identity.ts:5-12`），启动时由路由守卫 `beforeEach` 引导。
2. 顶部导航「灵 / 魂 / 景」中，「景」是带键盘方向键与 Esc 支持的弹层菜单，用于在海、天、森三个场景间切换。
3. 写笺：点击「扔一张浮笺 / 折一张飞笺 / 埋一颗时光种子」打开信纸面板，可配图（≤5MB，支持 jpeg/png/webp/gif），提交后播放投掷动效。
4. 读笺：点击「捞一个上来 / 接住一张」随机获得一张陌生人的笺纸，动效结束后拆开。
5. 灵笺支持语音：按住录音（浏览器 `getUserMedia` + `MediaRecorder`，60 秒自动停止）转写为文字，AI 回复可点击朗读（后端 TTS 返回音频 blob）。
6. 灵魂回响：在 `/soul` 先生成灵魂画像，再点「开始灵魂匹配」，最后用「让两个灵魂碰一碰」触发双 Agent 匿名对话与共鸣分析；对话以流式方式逐字上屏，结束后收进「历史回响」。

---

## 二、技术架构

### 2.1 技术栈

| 层次 | 选型 | 版本 | 说明 |
| :--- | :--- | :--- | :--- |
| 框架 | Vue 3 | `^3.5.13` | Composition API + `<script setup>` |
| 语言 | TypeScript | `~5.7.3` | `strict` 全量开启，构建前置 `vue-tsc --noEmit` |
| 构建 | Vite | `^6.2.0` | `@vitejs/plugin-vue ^5.2.1` |
| 路由 | Vue Router | `^4.5.0` | History 模式，8 条路由全部懒加载 |
| 状态 | 手写 reactive 单例 | — | **无 Pinia**；`store/identity.ts`、`store/toast.ts` |
| 请求 | 原生 `fetch` | — | **无 axios**；`src/api/client.ts`（362 行）+ `types.ts`（214 行） |
| 样式 | 手写 CSS | — | `src/styles/base.css` 设计令牌 + 组件 `<style scoped>`；无 UI 框架、无 Tailwind |
| 动画 | CSS `@keyframes` + Vue `Transition/TransitionGroup` + `requestAnimationFrame` | — | 无动画库、无 Three.js/WebGL；Canvas 2D 仅用于心笺配图压缩 |

### 2.2 目录结构

```
src/
├─ api/            client.ts（全部接口 + NDJSON 流解析 + 媒体 URL 归一）、types.ts
├─ components/     20 个组件：场景背景、信纸、动效舞台、导航、Toast
├─ router.ts       8 条路由（全懒加载）+ beforeEach 引导
├─ store/          identity.ts（演示身份）、toast.ts（全局提示）
├─ styles/base.css 设计令牌：色板、字号、间距、缓动曲线
├─ utils/          通用工具
├─ views/          EchoView / SoulView / ForestView / MineView / HomeView
├─ App.vue
└─ main.ts
```

规模：33 个源文件、约 11,359 行（v1 为 11 个核心文件、约 2,600 行）。

### 2.3 场景与组件对应

| 场景 | 视图 | 关键组件 | 视觉实现 |
| :--- | :--- | :--- | :--- |
| 海（浮笺） | `HomeView.vue`（`mode=ocean`） | `OceanBackdrop` `BottleIcon` `ComposeSheet` `DiscoverStage` `LetterCard` | 潮水层 + 漂浮瓶身，投掷 3400ms、打捞 1700ms |
| 天（飞笺） | `HomeView.vue`（`mode=sky`） | `SkyBackdrop` `PlaneIcon` `ComposeSheet` `DiscoverStage` `LetterCard` | 纯 CSS 暮色星空、云层与滑翔纸飞机，投掷 2600ms |
| 森（心笺） | `ForestView.vue` | `ForestBackdrop` `TreeIcon` `CapsuleComposer` `CapsuleOpenStage` | 胶囊按 `treeSize()` 随封存时长分档长成三层树冠 SVG，埋藏 3600ms |
| 灵（灵笺） | `EchoView.vue` | `MirrorBackdrop` `LanternIcon` | 倾听/镜像双模式，灯笼漂浮背景，思考中显示三点气泡 |
| 魂（A2A） | `SoulView.vue` | `SoulBackdrop` `SoulIcon` `SoulDialogueStage` | 星空 + 两颗灵魂光点，碰撞舞台逐字上屏 |
| 全站 | — | `SharedNavigation` `ToastHub` | 灵/魂/景导航弹层（方向键 + Esc）、全局轻提示 |

### 2.4 与后端的接口契约

`BASE = import.meta.env.VITE_API_BASE_URL`（`src/api/client.ts:20`），后端以 `/api/*` 前缀挂载同名蓝图。相对图片路径由 `resolveMediaUrl()`（`client.ts:23`）拼回 API origin。

| 模块 | 端点 |
| :--- | :--- |
| 匿名身份 | `POST /api/users`、`GET /api/users/:id` |
| 浮笺 | `POST /api/bottles`、`GET /api/bottles/discover`、`GET /api/bottles/:id`、`POST /api/bottles/:id/likes`、`POST /api/bottles/:id/comments`、`GET /api/bottles/mine/:uid` |
| 飞笺 | 同构的 `/api/planes/*` |
| 心笺 | `POST /api/capsules`、`GET /api/capsules/mine/:uid`、`POST /api/capsules/:id/open`、`GET /api/capsules/:id/image` |
| 灵笺 | `POST/GET /api/echo/conversations[/:id]`、`POST /api/echo/conversations/:id/messages`、`PATCH /api/echo/conversations/:id/mode`、`GET /api/echo/users/:uid/conversations`、`GET/POST /api/echo/users/:uid/profile(/refresh)` |
| 灵魂回响 | `GET /api/agent/profile`、`POST /api/agent/match`、`POST /api/agent/dialogue`、`POST /api/agent/dialogue/stream`、`GET/DELETE /api/agent/dialogues[/:id]` |
| 语音 | `POST /api/audio/transcriptions/upload`（ASR，multipart）、`POST /api/audio/speech`（TTS，返回音频 blob） |

### 2.5 AI 交互的前端实现

| 能力 | 位置 | 机制 |
| :--- | :--- | :--- |
| 语音转文字 | `EchoView.vue:306-345` | `getUserMedia` + `MediaRecorder`，优先 `audio/webm;codecs=opus`，不支持则退化 ogg、再退化默认编码；60 秒自动停止；转写文本回填输入框（`:283-299`） |
| AI 语音播报 | `EchoView.vue:239-272` | 拉取 TTS blob → `new Audio(URL.createObjectURL(...))` 播放，支持停止与播放失败提示 |
| 双 Agent 流式上屏 | `SoulDialogueStage.vue:74-120` | 读取 `POST /api/agent/dialogue/stream` 的 **NDJSON** 事件队列，`pump()` 以 24ms/字逐字渲染，轮次间插入 760ms「凝思」停顿，`AbortController` 可中断，`echo/done` 幂等收尾 |
| 灵笺整轮对话 | `EchoView.vue:174-224` | 同步请求 + 乐观上屏 + 失败回滚，等待期显示三点思考气泡 |
| 状态与兜底 | 各视图 | `booting/bootError`、`profileLoading/profileError`、`historyLoading`、`empty/error` 阶段态；心笺未到期时后端返回 423，前端只提示「还没到打开的时候」，配图请求同样被拒绝 |
| 无障碍与性能 | 7 个样式文件 | `prefers-reduced-motion` 下动效时长压缩至 200–500ms |

---

## 三、安装与运行

### 3.1 前置条件

- Node.js 18+（建议 20/22 LTS）与 npm
- 一个运行中的后端：<https://github.com/aYYbsYYa/Echo-Backtend>（默认 `http://localhost:3000`）

### 3.2 步骤

```bash
npm install

cp .env.example .env        # Windows: copy .env.example .env
# 本地联调：VITE_API_BASE_URL=http://localhost:3000/api

npm run dev                 # http://localhost:5173
npm run build               # 先 vue-tsc 类型检查，再产出 dist/
npm run preview             # 本地预览构建产物
```

> 注意：`vite.config.ts` **没有配置 `/api` 代理**，跨域由后端的全局 CORS 放开；前端一律通过 `VITE_API_BASE_URL` 直连后端。

### 3.3 环境变量

| 变量 | 说明 | 本地示例 | 线上示例 |
| :--- | :--- | :--- | :--- |
| `VITE_API_BASE_URL` | 后端 API 前缀，必须包含 `/api` | `http://localhost:3000/api` | `https://echoapi.yyoo.fun/api` |

`.gitignore` 忽略 `.env` 与 `.env.*` 并保留 `.env.example`；本仓库不含任何密钥，大模型 API Key 只存在于后端。

### 3.4 部署要点

- 产物目录 `dist/`（未提交进仓库），未设置 `base`，资源以 `/assets/...` 绝对路径引用。
- History 模式路由需要静态托管配置 SPA 回退（404 → `index.html`）。
- 语音功能依赖 `getUserMedia`，浏览器要求安全上下文：`https` 或 `localhost`。

---

## 四、v1 → v2 的优化内容

| 维度 | v1 | v2（本版） |
| :--- | :--- | :--- |
| 产品覆盖 | 浮笺、飞笺、Soul Echo 三条链路 | 新增**心笺（时光树洞）**与**灵笺（AI 自我对话）**，共五条链路 + 我的页 |
| 术语 | 漂流瓶 / 纸飞机 / Soul Echo | 统一为**浮笺 / 飞笺 / 心笺 / 灵笺 / 灵魂回响**（提交 `refactor: 统一项目术语为浮笺和飞笺`） |
| 路由 | 6 条静态导入 + `localStorage` 守卫 | 8 条全部懒加载 + `beforeEach` 引导，首屏只加载当前视图 |
| 状态管理 | 声明 Pinia 但业务未使用 | 移除 Pinia，改为两个明确职责的 reactive 单例 |
| API 层 | 单文件 188 行 | 拆分 `client.ts`(362) + `types.ts`(214)，按模块分组并补齐心笺/语音端点 |
| 语音链路 | Web Bluetooth 智能戒指（依赖专用硬件） | 浏览器原生 `MediaRecorder` ASR + TTS 播报，零硬件门槛 |
| 身份 | Onboarding 填写资料 + 本地 SHA-256 ID | 固定演示身份，评委打开即体验，无需注册 |
| 导航 | 各视图内散落 | 抽出 `SharedNavigation`，「景」弹层支持方向键与 Esc |
| 视觉 | 单一 `main.css` | 设计令牌 + 五套场景背景组件 + 全站动效节奏常量 |
| 工程质量 | `type-check` 独立脚本 | 构建前置类型检查；`strict` + `noUnusedLocals` + `noUnusedParameters` |

已知遗留：`src/utils/id.ts` 的 `generateUserId` 在改用固定演示身份后已无调用点；仓库暂不含自动化测试与 CI。

---

## 五、代码规范

| 项目 | 配置 |
| :--- | :--- |
| TypeScript | `tsconfig.json`：`strict`、`noUnusedLocals`、`noUnusedParameters`、`verbatimModuleSyntax`、`isolatedModules`、`noEmit`、`target: ES2022`、`moduleResolution: bundler` |
| 构建门禁 | `npm run build` = `vue-tsc --noEmit -p tsconfig.json && vite build`，类型不过即构建失败 |
| 组件写法 | 统一 `<script setup lang="ts">`，样式一律 `<style scoped>`，跨组件共用值只允许来自 `src/styles/base.css` 令牌 |
| 请求约束 | 所有网络请求必须经 `src/api/client.ts`，禁止视图内直接 `fetch` |
| 动效约束 | 时长与缓动使用场景常量集中管理，任何动效必须提供 `prefers-reduced-motion` 降级 |

---

## 六、团队信息

**本次参赛队伍（传智杯）：Yeve Hoo**

| 成员 | 角色 | 分工 |
| :--- | :--- | :--- |
| 邓紫阳 | 队长 | 开发 |
| 刘艺红 | 队员 | 演示视频、PPT 与视觉物料 |

**原项目（黑客松版本）贡献者**

| 贡献者 | 分工 |
| :--- | :--- |
| aYYbsYYa | 前后端开发 |
| Speculator | 前后端开发 |
| Naije | 设计 |
| 是晞宝呀 | 设计 |

---

## 七、开发记录与仓库

- 原项目开发提交 18 次，时间跨度 2026-07-23 ~ 2026-07-25；2026-11 为本次赛项提交另加文档类提交。完整历史保留在 `main` 分支，未做压缩、改写或 rebase，可用 `git log --follow` 逐条核对。
- 主要演进：初始化与海洋动效 → 术语统一 → 场景标签与信纸卡片 → 时光树洞全功能 → 灵笺与灵魂碰撞 → 身份与路由重构 → 导航抽离 → 环境变量替代硬编码 → 媒体 URL 归一 → 错误处理与流式舞台打磨 → 灵笺语音互转（HEAD）。
- 本项目曾获 **百度秒哒 · 应用美学赛道 最佳交互奖**。

## 八、许可与说明

本项目为参赛作品，代码公开用于评审与学习交流。第三方大模型 API 密钥与语音模型权重均不随仓库分发，需按各自官方条款自行获取与配置。

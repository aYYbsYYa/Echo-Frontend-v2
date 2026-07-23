# Echo · 回响 —— 前端 v2（完全重构版）

Yeve Echo 匿名文字漂流社区的全新前端。夜景海洋 × 暮色天空的沉浸式场景，
手作极简动效：信纸卷起、投瓶入海、涟漪扩散、折纸起飞、打捞拆信。

## 技术栈

- Vue 3 + TypeScript + Vite
- Vue Router（`/welcome`、`/` 海、`/sky` 天、`/mine`）
- 零 UI 框架：全部视觉与动效为手写 CSS（含 `prefers-reduced-motion` 降级）

## 运行

```bash
npm install
npm run dev        # http://localhost:5173
```

后端需先启动（Echo-Backtend，默认 `http://localhost:3000`），
开发服务器已配置 `/api` 代理转发。

```bash
npm run build      # vue-tsc 类型检查 + 产物构建
```

## 设计说明

- **双场景**：海（浮笺）/ 天（飞笺）通过顶栏切换，背景 0.9s 交叉淡化。
- **发布动效**：信纸卷起 → 瓶身显现 → 落水涟漪 → 漂向远方（飞笺则为折叠 → 俯冲 → 爬升远去）。
- **打捞动效**：瓶从深海升起、水面波纹提示「轻点拆开」，信纸 3D 展开；
  飞笺带弧线飞入、悬停待接。
- **我的**：私有统计（被拾起次数 / 心意 / 留言）、开发组回信、逐条留言时间线。
- **匿名身份**：ID 由浏览器以资料 + 时间戳 + 随机盐生成（SHA-256 → base36），
  仅存 localStorage，启动时与服务端核对。
- 戒指录音转写（`/api/audio/transcriptions`）依赖 Web Bluetooth 硬件链路，本版未包含。

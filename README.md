# 冯良泽 · AI 产品经理

中文优先的 AI 产品作品集，展示 Agent、实时语音、解决方案和智能硬件产品能力。

首页介绍产品定位与三项简历经历，并提供脱敏 PDF 下载。作品页按问题、判断、取舍和指标拆解三个案例；方法论页介绍延迟和交付验收口径。三个公开 Demo 使用真实语音链路与模拟业务规则。

三个语音场景使用一屏式 Voice Agent 控制台，按 Inbound / Outbound 展示拨号、来电、接听、WebRTC 状态、partial transcript、知识库命中和事件轨迹。高级语音设置支持语言、音色、模型、输出格式、稳定性、相似度、风格和速度；Live 模式通过服务端 ElevenLabs 流式 TTS，前端不要求体验者输入 Key。

每个通话页内置 RTC 架构、业务流程、知识库、指标和事件日志。页面使用原创的抽象产品视觉，不依赖既有项目截图。

公开页面支持 `LIVE` 和 `SANDBOX` 两种运行模式。Live 模式由 LiveKit / Agent / ElevenLabs 服务端提供真实会话和指标；连接或麦克风不可用时，访客可以进入明确标记为 `SANDBOX / SIMULATED` 的文字演示，使用浏览器语音预览。实时通话只展示来源于本次会话的观测字段。

## 本地运行

```bash
npm install
npm run dev
```

## 构建与检查

```bash
npm run check
npm run build
```

## 公开入口

- GitHub Pages：`https://flappylz.github.io/ai-portfolio/`
- Codex Sites：`https://fengliangze-ai-portfolio.wellsfung.chatgpt.site/`
- Voice runtime：`https://fengliangze-ai-voice-runtime-kv.760871196.workers.dev/`（Cloudflare Worker edge proxy；Trace 使用真实 Workers KV，语音会话转发到 LiveKit / ElevenLabs runtime，失败时前端明确降级 Sandbox）

本轮视觉与交互依赖保持轻量，使用 IBM Plex Sans / Mono 字体和已审核的 shadcn/ui 设计规则。页面仍是 Vanilla JavaScript，未引入 React 组件树或未使用的 UI 依赖。

## 生产运行时

`runtime/agent/` 是实际的 LiveKit Agents Node Worker：它使用 LiveKit 推理 STT/LLM、ElevenLabs 流式 TTS、Silero VAD、知识库查询和人工转接工具，并把 partial/final transcript、模型、状态和指标通过 LiveKit Data Track 回传给前端。

```bash
cd runtime/agent
npm ci
npm run check
lk agent dev
```

生产部署需要在 LiveKit Agent Worker 和 Voice runtime 中配置同一组 `LIVEKIT_URL`、`LIVEKIT_API_KEY`、`LIVEKIT_API_SECRET`、`LIVEKIT_AGENT_ID`；ElevenLabs 使用 `ELEVENLABS_API_KEY` 和各场景 Voice ID。Worker 若配置名为 `TRACE_KV` 的 Durable KV binding，Trace 会跨 Worker isolate 保留；未配置时页面会明确显示 `worker_memory` / Sandbox 边界。

## 发布

- `main` 分支保存源码、内容和检查脚本。
- GitHub Actions 运行 `npm run check`、`npm run build`，并将 `dist/` 作为 GitHub Pages 发布工件。
- Codex Sites 使用同一份源码做公开镜像；Codex Cloud 负责构建和验证，不作为永久服务器。

公开站点使用脱敏或模拟数据，不在浏览器中放 API Key、Token、客户数据或内部链接。

# 冯良泽AI｜AI 产品作品集

中文优先的 AI 产品作品集，展示 Agent、实时语音、解决方案和智能硬件产品能力。

首页先展示 **Voice Applications**：三个应用入口分别通向运营商 Inbound 咨询、航空票面信息查询和足球人格测试。面试官进入后直接看到通话界面，再查看后面的产品拆解。

三个语音场景支持文本输入和浏览器麦克风，页面内展示工作流、知识库命中、ASR / Intent / KB / TTS 延迟和事件日志。高级语音设置支持语言、音色、模型、输出格式、稳定性、相似度、风格和速度；填写会话级 Key 后会调用 ElevenLabs Text-to-Speech API，否则使用浏览器语音回退。Key 不写入仓库。

其中 **Agent Launch Lab** 支持选择 Agent 模式、输入想法、运行本地模拟评测，并把版本推进到发布候选；**Delivery Control Room** 支持点选 PoC、验收和交付证据，生成当前状态。作品卡片使用原创的抽象产品视觉，不依赖既有项目截图。

公开 Demo 的推理使用本地模拟，语音使用浏览器原生 `speechSynthesis` 预览；不接入 11Labs、不放私有 API Key，也不展示客户敏感信息。

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

## 发布

- `main` 分支保存源码、内容和检查脚本。
- GitHub Actions 运行 `npm run check`、`npm run build`，再把 `dist/` 同步到 `gh-pages` 分支。
- GitHub Pages 从 `gh-pages` 根目录提供长期入口。
- Codex Sites 使用同一份源码做公开镜像；Codex Cloud 负责构建和验证，不作为永久服务器。

公开站点使用脱敏或模拟数据，不在浏览器中放 API Key、Token、客户数据或内部链接。

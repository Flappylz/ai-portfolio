# 冯良泽AI｜AI 产品作品集

中文优先的 AI 产品作品集，展示 Agent、实时语音、解决方案和智能硬件产品能力。

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

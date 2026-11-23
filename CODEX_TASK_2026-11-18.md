# 任务：把 ai-portfolio 从「技术 Demo」改回「AI 产品经理求职作品集」

你是 Codex。请对以下项目执行改造。这份指令自包含，不需要额外背景。

## 0. 项目与材料

- 项目路径：`/Users/admin/Documents/New project/deliverables/current/ai-portfolio/`
- 技术栈：Vanilla JS + Vite，无 React。主要文件：`src/main.js`（1308 行）、`src/styles.css`（854 行）、`src/data/projects.js`、`index.html`、`scripts/check-site.mjs`
- 详细诊断依据：`PORTFOLIO_REVIEW_2026-11-18.md`（同目录，先读一遍）
- 身份信息来源：`/Users/admin/Documents/New project/deliverables/current/冯良泽_声网AI产品经理_投递版简历.md`。**所有个人信息、经历、数字必须从这份简历提取，禁止自行编造。**

## 1. 目标（一句话）

让一个完全不了解冯良泽的面试官，打开首页 60 秒内说清"他是做 AI 语音 Agent 产品的产品经理，做过三个真实场景，强在端到端交付和观测"，并找到联系/简历入口。

现状问题：README 声明这是面试官作品集，实际做成了实时语音技术 Demo 工作台——首页直接是运营商客服通话台，全站没有作者身份，作品与方法论页面是 404。

## 2. 硬性约束（违反即失败）

1. 不要删除或重写 LiveKit WebRTC 链路、语义 VAD、打断、实时字幕、五状态反馈、SANDBOX 降级机制。这些是真实能力，只调整呈现方式。
2. 公开站点不得出现 API Key / Token / 客户数据；`scripts/check-site.mjs` 现有的安全规则（禁止 `API_KEY=`/`SECRET=`/`TOKEN=`/`sk-` 前缀/私钥/浏览器侧 ElevenLabs 密钥路径/截图路径引用）必须保留。
3. `scripts/check-site.mjs` 的 required 列表里所有字符串必须继续存在，包括 `appLauncher`、`voiceScenarioView`、`voice-details`、`runtimeMode`、`voiceCallStatus`、`LiveKit WebRTC`、`sandbox / simulated`、`hashchange`、`speechSynthesis`、`partial_transcript`、`tts_first_byte`、`data-voice-*` 系列、`github.com/Flappylz`、`fengliangze-ai-voice-runtime.wellsfung.chatgpt.site`。**不要为了满足新页面而删掉这些函数或标识。**
4. 保留 GitHub Pages + Codex Sites 双发布链路和二维码入口。
5. 所有个人经历与成果数字以简历为准，不确定的宁可不写，不要编。

## 3. 执行顺序（三轮，每轮结束必须验证后再进入下一轮）

### 第一轮：定位与结构（P0）

**任务 1 — 恢复三作品卡首页**
- `src/main.js:110` 的 `homeView()` 当前是 `return voiceScenarioView('carrier');`，改为 `return appLauncher();`
- `appLauncher()`（main.js:107-109）和它的样式（styles.css:227）已经写好，不要重写，直接启用。
- 把三张卡从"语音场景"重新定义为"产品案例"：在 `src/data/projects.js` 的 `apps` 里为每项补充一句话价值主张、一个可量化结果、一个案例入口。原文案可保留但要在前面加产品视角的标题。
- 卡片点击仍进入 `#/apps/voice?scenario=xxx`，不要改路由。

**任务 2 — 重建身份层**
- `index.html`：`<title>` 改为"冯良泽 · AI 产品经理"；`meta description` 改为中文作品集描述（从简历提炼）。
- `src/main.js:94-99` 的 `header()` 和 `footer()`：品牌名改为"冯良泽 · AI 产品经理"，副标题改为岗位定位（不再是 LIVE VOICE WORKBENCH）。
- 新增首屏身份区（在 `appLauncher()` 顶部）：姓名 + 目标岗位 + 一句话价值主张 + 3 个关键数字（从简历提取）+ 简历下载/联系 CTA。
- 导航改为：关于我 / 作品 / 方法论 / 联系。联系指向 mailto 和 GitHub，不要新增需要后端的表单。

**任务 3 — 恢复作品与方法论页面**
- `src/main.js:1291` 当前把 `#/projects` 和 `#/method` 都返回 `notFoundView()`，改为渲染真实页面。
- 作品页：三个案例的结构化拆解（背景与目标 / 我的职责与决策 / 关键取舍 / 结果与指标定义）。
- 方法论页：如何定义语音 Agent 体验指标、如何平衡延迟与准确率、如何做交付级观测。内容从简历和现有代码里的真实设计提炼。
- `scripts/check-site.mjs`：移除对 `产品拆解`、`工作方法`、`#/projects`、`demo-note` 四个字符串的禁止规则（forbiddenUi 数组），否则 CI 会挡住恢复。其余安全规则原样保留。

**第一轮验收**：`npm run check && npm run build` 通过；首页不再是通话台；导航四项都能打开且非 404。

### 第二轮：内容与可信度（P1）

**任务 4 — 案例四段式**
- 三个 `voiceScenarios` 每项补四个字段并渲染到对应案例页：① 问题与用户 ② 我的判断与方案 ③ 关键取舍（为什么快模型+慢校验、为什么要 barge-in）④ 结果与指标定义。用第一人称写"我做了什么"。

**任务 5 — 演示数据边界**
- `src/data/projects.js` 里写死的命中率 96%/91%/88%、`src/main.js` 里 `voiceInsights` 的"待识别"、以及 `defaultDialogueModel = 'openai/gpt-6.1-sol'` 这类不存在的模型名：统一加 `DEMO / SIMULATED` 标识，或移入默认折叠区并注明"演示数据，非真实业绩"。
- 首页因为走非 demo 分支（`demoRoute=false`）会直接露出这些内部指标，务必处理干净。
- 验收：面试官不会误把演示值当成真实业绩。

**任务 6 — 中文化**
- 保持 README 的"中文优先"承诺：导航、指标名、关键结论、CTA 一律中文，英文只做辅助注释（例：`FAST LLM（快模型）`）。

**第二轮验收**：`npm run check && npm run build` 通过；三个案例页都有完整四段式；演示数据都有标识。

### 第三轮：视觉与验证（P2 + P3）

**任务 7 — 字号下限**
- `src/styles.css` 中 8px 7 处、9px 13 处、10px 19 处、11px 28 处，共 67 处低于 12px。正文和标签统一提到 ≥12px，仅脚注/版权可用 11px。

**任务 8 — 收敛视觉**
- 强调色从紫/薄荷绿/柠檬绿/橙收敛为 1 主色 + 1 状态色；场景差异改用编号或图标区分。
- 圆角统一（卡片 16px、控件 10px），减少渐变和阴影堆叠。

**任务 9 — 首屏减负**
- 首屏只保留：身份 + 三个案例入口 + 一个 CTA。
- 模型路由、Trace、实时指标、完整语音设置收进案例详情页，默认折叠。

**第三轮验收**：`npm run check && npm run build` 通过；390px 移动端下三个案例卡可读可点；正文字号 ≥12px。

## 4. 最终完成标准

一个不了解冯良泽的面试官，打开首页 60 秒内，能说清"他是做 AI 语音 Agent 产品的产品经理，做过三个真实场景，强在端到端交付和观测"，并找到联系/简历入口。

## 5. 汇报要求

完成后请逐条报告：
1. 首页现在的首屏内容是什么
2. 导航四项的路由和渲染函数
3. `npm run check` 与 `npm run build` 的结果
4. 哪些个人信息/数字取自简历原文，哪些因为简历里没有而留空
5. 为了恢复页面，对 `scripts/check-site.mjs` 做了哪些改动，安全规则如何保留

import './styles.css';
import { agentModes, apps, capabilities, projects, voiceScenarios } from './data/projects.js';

const app = document.querySelector('#app');
const githubUrl = 'https://github.com/Flappylz';
const email = '760871196@qq.com';

const state = { modeId: 'discovery', status: 'draft', score: 0, input: '', response: '', deliveryChecks: [], deliverySummary: '', voiceScenario: 'carrier', voiceInput: '', voiceStatus: 'ready', voiceStep: 0, voiceMessages: [], voiceLogs: [], voiceRound: 0, voiceLanguage: 'zh', voiceVoice: 'JBFqnCBsd6RMkjVDRZzb', voiceModel: 'eleven_flash_v2_5', voiceStability: 0.5, voiceSimilarity: 0.75, voiceStyle: 0.2, voiceSpeed: 1, voiceApiKey: '', voiceApiState: 'browser fallback', voiceLatency: { asr: 320, intent: 42, kb: 28, tts: 480 }, events: [
  { time: '09:41:03', label: 'workspace initialized', tone: 'quiet' },
  { time: '09:41:11', label: 'agent schema loaded', tone: 'cyan' }
] };

const esc = (value) => String(value || '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;');
const asset = (path) => import.meta.env.BASE_URL + path;
const activeMode = () => agentModes.find((item) => item.id === state.modeId) || agentModes[0];
const extLink = (href, label, className) => '<a class="' + (className || '') + '" href="' + esc(href) + '" target="_blank" rel="noreferrer">' + label + '</a>';

function header() {
  return '<header class="site-header"><a class="brand" href="#/" aria-label="返回冯良泽AI首页"><span class="brand-mark"><i></i><i></i></span><span><strong>冯良泽AI</strong><small>AI PRODUCT BUILDER</small></span></a><nav class="site-nav" aria-label="主导航"><a class="nav-apps" href="#/apps">应用工作台</a><a href="#/projects">产品拆解</a><a href="#/method">工作方法</a>' + extLink(githubUrl, 'GitHub', 'nav-external') + '<a class="nav-cta" href="mailto:' + email + '">联系我</a></nav></header>';
}
function footer() {
  return '<footer class="site-footer"><div class="footer-brand"><span class="brand-mark"><i></i><i></i></span><div><strong>冯良泽AI</strong><p>从 0 到 1，把 AI 能力推进到真实使用。</p></div></div><div class="footer-links">' + extLink(githubUrl, 'GitHub') + '<a href="mailto:' + email + '">' + email + '</a><span>© 2026</span></div></footer>';
}
function shell(content) { return header() + '<main>' + content + '</main>' + footer(); }
function visual(accent) {
  return '<div class="abstract-visual accent-' + accent + '" aria-hidden="true"><span class="visual-grid"></span><span class="visual-orbit orbit-a"></span><span class="visual-orbit orbit-b"></span><span class="visual-node node-a"></span><span class="visual-node node-b"></span><span class="visual-node node-c"></span><span class="visual-line line-a"></span><span class="visual-line line-b"></span><b>0 → 1</b></div>';
}
function capabilityRail() {
  return capabilities.map((item) => '<article class="capability-card"><span class="capability-index">' + item.icon + '</span><h3>' + item.label + '</h3><p>' + item.text + '</p></article>').join('');
}
function projectCard(project, featured) {
  return '<article class="project-card ' + (featured ? 'featured' : '') + '" style="--project-accent: var(--' + project.accent + ')">' + visual(project.accent) + '<div class="project-card-body"><div class="project-card-top"><span class="project-index">' + project.number + '</span><span class="project-eyebrow">' + project.eyebrow + '</span></div><h3>' + project.title + '</h3><p>' + project.summary + '</p><div class="tag-row">' + project.tags.map((tag) => '<span>' + tag + '</span>').join('') + '</div><div class="card-actions"><a class="text-link" href="#/projects/' + project.slug + '">查看产品判断 <span>↗</span></a><span class="card-role">' + project.role + '</span></div></div></article>';
}
function labPanel(compact) {
  const mode = activeMode();
  const statusLabel = state.status === 'released' ? 'LIVE' : state.status === 'evaluated' ? 'EVALUATED' : 'DRAFT';
  const statusText = state.status === 'released' ? '已发布候选' : state.status === 'evaluated' ? '评测通过，可发布' : '定义中';
  const events = state.events.slice(-4).reverse().map((event) => '<li><span>' + event.time + '</span><b class="event-dot ' + event.tone + '"></b><em>' + event.label + '</em></li>').join('');
  return '<section class="launch-lab ' + (compact ? 'compact' : '') + '" id="agent-lab"><div class="lab-topbar"><div><span class="lab-kicker">INTERACTIVE PRODUCT PROOF</span><h2>Agent Launch Lab</h2></div><div class="live-indicator"><i></i><span>' + statusLabel + '</span><small>local prototype</small></div></div><div class="lab-grid"><aside class="lab-rail"><div class="rail-title"><span>BUILD MODE</span><b>0 → 1</b></div><ol class="build-steps"><li class="active"><span>01</span><div><b>Define</b><small>问题与目标</small></div></li><li class="' + (state.status !== 'draft' ? 'active' : '') + '"><span>02</span><div><b>Configure</b><small>能力与边界</small></div></li><li class="' + (state.status !== 'draft' ? 'active' : '') + '"><span>03</span><div><b>Evaluate</b><small>用例与 Badcase</small></div></li><li class="' + (state.status === 'released' ? 'active' : '') + '"><span>04</span><div><b>Ship</b><small>发布与迭代</small></div></li></ol><div class="rail-note"><span>MY ROLE</span><strong>产品判断 + 交付闭环</strong><p>把模型能力翻译成用户能理解、团队能协作、上线能验收的产品。</p></div></aside><div class="lab-console"><div class="console-head"><div><span class="mini-label">AGENT CONFIGURATION</span><h3>和我的 Agent 共创</h3></div><span class="version">v0.1 / ' + statusText + '</span></div><div class="mode-switcher" role="tablist" aria-label="选择 Agent 模式">' + agentModes.map((item) => '<button class="' + (item.id === state.modeId ? 'selected' : '') + '" type="button" data-mode="' + item.id + '" role="tab" aria-selected="' + (item.id === state.modeId) + '">' + item.name + '</button>').join('') + '</div><div class="agent-config"><div><span class="mini-label">PURPOSE</span><strong>' + mode.purpose + '</strong></div><div><span class="mini-label">SYSTEM PROMPT</span><p>“' + mode.prompt + '”</p></div></div><div class="conversation"><div class="message user-message"><span class="message-avatar">YOU</span><p>' + (state.input ? esc(state.input) : '我想做一个能真正落地的 AI 产品，先帮我把范围定清楚。') + '</p></div><div class="message agent-message"><span class="message-avatar">AI</span><p>' + (state.response ? esc(state.response) : '选择一个 Agent 模式，再运行一次评测，看看产品如何从想法进入可验证状态。') + '</p></div></div><div class="composer"><label for="agent-input" class="sr-only">输入想法</label><textarea id="agent-input" rows="2" placeholder="输入你想验证的想法…">' + esc(state.input) + '</textarea><div class="composer-actions"><span>本地模拟推理 · 无私有 Key</span><div><button class="icon-button" type="button" data-speak aria-label="浏览器语音预览">◉</button><button class="run-button" type="button" data-run>Run evaluation <span>↗</span></button></div></div></div></div><aside class="telemetry"><div class="telemetry-head"><div><span class="mini-label">RELEASE TELEMETRY</span><h3>产品状态</h3></div><span class="telemetry-code">LL-001</span></div><div class="state-stack"><div class="state-row done"><span class="state-icon">✓</span><div><b>Draft · 定义</b><small>范围和 Agent schema 已建立</small></div><em>done</em></div><div class="state-row ' + (state.status !== 'draft' ? 'done' : 'current') + '"><span class="state-icon">⌁</span><div><b>Evaluated · 评测</b><small>' + (state.status !== 'draft' ? '通过 3 个核心用例' : '等待运行评测') + '</small></div><em>' + (state.status !== 'draft' ? 'pass' : 'next') + '</em></div><div class="state-row ' + (state.status === 'released' ? 'done' : '') + '"><span class="state-icon">↗</span><div><b>Released · 发布</b><small>' + (state.status === 'released' ? '候选版本已发布' : '评测后生成发布候选') + '</small></div><em>' + (state.status === 'released' ? 'live' : 'hold') + '</em></div></div><div class="score-panel"><div class="score-label"><span>Evaluation score</span><b>' + (state.score || '—') + '<small>/100</small></b></div><div class="score-bar"><i style="width:' + (state.score || 12) + '%"></i></div><p>' + (state.score ? '核心路径通过，边界条件已记录。' : '先运行一次评测，生成可解释结果。') + '</p></div><ul class="event-log">' + events + '</ul><button class="publish-button" type="button" data-publish ' + (state.status === 'draft' ? 'disabled' : '') + '>Publish candidate <span>↗</span></button></aside></div><div class="lab-disclosure"><span>PUBLIC DEMO BOUNDARY</span><p>这里展示的是产品设计与交互能力：推理使用本地模拟，语音使用浏览器原生预览，不接入 11Labs 或任何私有 API Key。</p></div></section>';
}
function appCard(app) {
  const action = app.route
    ? '<a class="app-open" href="' + app.route + '">打开应用 <span>↗</span></a>'
    : '<a class="app-open" href="' + esc(app.url) + '" target="_blank" rel="noreferrer">打开公开 Demo <span>↗</span></a>';
  return '<article class="app-card app-' + app.accent + '" data-app-route="' + esc(app.route || app.url) + '" tabindex="0"><div class="app-card-art"><span>' + app.number + '</span><b>' + app.id.toUpperCase() + '</b><i></i><i></i><i></i></div><div class="app-card-body"><div class="app-card-head"><span class="app-status">' + app.label + '</span><span class="app-type">APP</span></div><h3>' + app.title + '</h3><p>' + app.description + '</p><div class="app-tags">' + app.tags.map((tag) => '<span>' + tag + '</span>').join('') + '</div>' + action + '</div></article>';
}
function appLauncher() {
  return '<section class="app-launcher section-pad" id="apps"><div class="launcher-head"><div><span class="section-label">VOICE APPLICATIONS</span><h2>选择一个场景，直接开始通话。</h2></div><p>只保留三个可体验的语音应用。进入后默认是电话交互界面，文本输入只作为备用入口。</p></div><div class="app-grid">' + apps.map(appCard).join('') + '</div></section>';
}
function homeView() {
  return shell('<section class="desk-hero section-pad"><div><span class="section-label">冯良泽AI / VOICE APPLICATIONS</span><h1>先打电话，<br /><em>再看产品能力。</em></h1><p>三个具体场景，进入即是通话界面：运营商来电、航空票面、足球人格测试。</p><div class="desk-actions"><a class="button primary" href="#/apps">选择通话场景 <span>↗</span></a><a class="button secondary" href="#/projects">看产品拆解 <span>↗</span></a></div></div><div class="desk-meta"><span><i></i>3 个通话应用</span><span>默认语音交互</span><span>工作流 / 知识库 / 日志</span></div></section>' + appLauncher() + '<section class="section-pad demo-note"><span class="section-label">CALL MODE</span><p>打开应用后先看到通话状态和麦克风入口；浏览器允许麦克风后即可开始说话。文字输入保留在“备用文字”折叠区。</p></section>');
}
function projectsView() {
  return shell('<section class="page-intro section-pad"><span class="section-label">ORIGINAL WORK / 0 → 1</span><h1>不把 Demo 当作品。<br /><em>把判断做成产品。</em></h1><p>下面四个案例都从问题、范围和交付边界出发，重点展示我如何把 AI 能力组织成可体验、可评测的产品系统。</p></section><section class="section-pad project-list">' + projects.map((project, index) => projectCard(project, index === 0)).join('') + '</section><section class="section-pad proof-band"><div><span class="section-label">AI FLUENCY</span><h2>熟悉 AI，体现在边界和验证里。</h2></div><div class="proof-list"><span>模型能力边界</span><span>Agent 状态管理</span><span>实时语音链路</span><span>工具调用</span><span>评测与 Badcase</span><span>安全与交付</span></div></section>');
}
function appsView() {
  return shell('<section class="page-intro section-pad app-page-intro"><span class="section-label">VOICE APPLICATIONS / 3 LIVE CALLS</span><h1>选择一个场景，开始通话。</h1><p>这三个入口都是具体业务 Demo，进入后默认使用语音交互。</p></section>' + appLauncher());
}
function activeVoiceScenario() { return voiceScenarios.find((item) => item.id === state.voiceScenario) || voiceScenarios[0]; }
function resetVoiceState(id) {
  if (state.voiceScenario === id && (state.voiceMessages.length || state.voiceLogs.length)) return;
  state.voiceScenario = id; state.voiceInput = ''; state.voiceStatus = 'ready'; state.voiceStep = 0; state.voiceMessages = []; state.voiceLogs = []; state.voiceRound = 0; state.voiceApiState = 'browser fallback';
}
function voiceScenarioView(id) {
  resetVoiceState(id);
  const scenario = activeVoiceScenario();
  const messages = state.voiceMessages.length ? state.voiceMessages.map((item) => '<div class="voice-message ' + item.role + '"><span>' + (item.role === 'user' ? 'YOU' : 'AGENT') + '</span><p>' + esc(item.text) + '</p></div>').join('') : '<div class="voice-empty">点击麦克风，或输入一句话开始这个场景。</div>';
  const logs = state.voiceLogs.slice(-6).reverse().map((item) => '<li><time>' + item.time + '</time><b class="event-dot ' + item.tone + '"></b><span>' + item.label + '</span></li>').join('');
  const steps = scenario.workflow.map((step, index) => '<div class="voice-step ' + (state.voiceStep >= index + 1 ? 'active' : '') + '"><b>0' + (index + 1) + '</b><span>' + step + '</span></div>').join('');
  const knowledge = scenario.knowledge.map((item) => '<li><div><b>' + item[0] + '</b><small>' + item[1] + '</small></div><em>' + item[2] + '</em></li>').join('');
  const lastAssistant = [...state.voiceMessages].reverse().find((item) => item.role === 'assistant');
  return shell('<section class="page-intro section-pad voice-page-intro"><span class="section-label">VOICE SCENARIO STUDIO / REALTIME APP</span><h1>' + scenario.title + '</h1><p>' + scenario.subtitle + '。选择语言和音色，打开高级参数，直接跑一轮可观测的语音流程。</p><div class="scenario-tabs">' + voiceScenarios.map((item) => '<a class="' + (item.id === scenario.id ? 'selected' : '') + '" href="#/apps/voice?scenario=' + item.id + '">' + item.title + '</a>').join('') + '</div></section><section class="section-pad voice-workbench"><div class="voice-main"><div class="voice-toolbar"><div><span class="mini-label">LIVE SESSION</span><h2>' + scenario.title + '</h2></div><div class="voice-state ' + state.voiceStatus + '"><i></i>' + state.voiceStatus.toUpperCase() + '</div></div><div class="voice-workflow">' + steps + '</div><div class="voice-call-screen"><div class="call-session-strip"><span>WEBRTC / WS FALLBACK</span><b>CONNECTION STABLE</b><small>session 0' + (state.voiceRound || '01') + '</small></div><div class="caller-orb">' + scenario.title.slice(0, 1) + '</div><div class="call-wave" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div><span>SECURE VOICE SESSION</span><strong>点击麦克风开始通话</strong><button class="call-mic" type="button" data-voice-mic>◉</button><div class="call-controls"><span>mic / VAD / barge-in</span><button type="button" data-voice-end>结束演示</button></div><small>进入后默认语音交互 · 文本仅作备用</small></div><div class="voice-transcript">' + messages + '</div><details class="text-fallback"><summary>备用文字输入</summary><div class="voice-samples">' + scenario.examples.map((item) => '<button type="button" data-voice-sample="' + esc(item) + '">' + item + '</button>').join('') + '</div><div class="voice-composer"><textarea id="voice-input" rows="2" placeholder="' + esc(scenario.prompt) + '">' + esc(state.voiceInput) + '</textarea><div class="voice-actions"><button class="button secondary" type="button" data-voice-mic>◉ 开始语音</button><button class="button primary" type="button" data-voice-send>发送并运行 <span>↗</span></button></div></div></details><div class="voice-detail-cta"><span>AFTER THE CALL</span><a href="#/projects/voice-agent-system">查看 RTC 管道、配置与整体架构拆解 ↗</a></div><div class="voice-audio-row"><span>' + (lastAssistant ? '最近一次 Agent 回复可播放' : '生成语音后可在这里播放') + '</span><button class="text-link" type="button" data-voice-speak ' + (lastAssistant ? '' : 'disabled') + '>重新播放</button><audio id="voice-audio" controls></audio></div><details class="voice-settings"><summary>高级语音设置 <span>语言 / 音色 / 模型 / 参数 / API</span></summary><div class="settings-grid"><div class="setting-group"><h3>语言与音色</h3><label>Language<select data-voice-language><option value="zh" ' + (state.voiceLanguage === 'zh' ? 'selected' : '') + '>中文 / zh</option><option value="en" ' + (state.voiceLanguage === 'en' ? 'selected' : '') + '>English / en</option><option value="ar" ' + (state.voiceLanguage === 'ar' ? 'selected' : '') + '>العربية / ar</option></select></label><label>Voice<select data-voice-voice><option value="JBFqnCBsd6RMkjVDRZzb" ' + (state.voiceVoice === 'JBFqnCBsd6RMkjVDRZzb' ? 'selected' : '') + '>George · neutral</option><option value="21m00Tcm4TlvDq8ikWAM" ' + (state.voiceVoice === '21m00Tcm4TlvDq8ikWAM' ? 'selected' : '') + '>Rachel · clear</option></select></label></div><div class="setting-group"><h3>模型与输出</h3><label>Model<select data-voice-model><option value="eleven_flash_v2_5" ' + (state.voiceModel === 'eleven_flash_v2_5' ? 'selected' : '') + '>Flash v2.5 · low latency</option><option value="eleven_multilingual_v2" ' + (state.voiceModel === 'eleven_multilingual_v2' ? 'selected' : '') + '>Multilingual v2 · stable</option></select></label><label>Output<select data-voice-format><option>MP3 44.1kHz</option><option>PCM 16kHz</option></select></label></div><div class="setting-group setting-sliders"><h3>Voice controls</h3><label>Stability <output data-output="stability">' + state.voiceStability + '</output><input type="range" min="0" max="1" step="0.05" value="' + state.voiceStability + '" data-voice-stability></label><label>Similarity <output data-output="similarity">' + state.voiceSimilarity + '</output><input type="range" min="0" max="1" step="0.05" value="' + state.voiceSimilarity + '" data-voice-similarity></label><label>Style <output data-output="style">' + state.voiceStyle + '</output><input type="range" min="0" max="1" step="0.05" value="' + state.voiceStyle + '" data-voice-style></label><label>Speed <output data-output="speed">' + state.voiceSpeed + '</output><input type="range" min="0.7" max="1.2" step="0.05" value="' + state.voiceSpeed + '" data-voice-speed></label></div><div class="setting-group setting-api"><h3>ElevenLabs API</h3><label>Session API key<input type="password" placeholder="粘贴后仅保存在本次页面会话" data-voice-api-key value="' + esc(state.voiceApiKey) + '" autocomplete="off"></label><p>有 Key 时调用 ElevenLabs Text-to-Speech API；没有 Key 时使用浏览器语音回退。Key 不写入仓库。</p><span class="api-state">' + state.voiceApiState + '</span></div></div></details></div><aside class="voice-observability"><div class="obs-head"><div><span class="mini-label">OBSERVABILITY</span><h3>运行观测</h3></div><span class="trace-id">TRACE ' + (state.voiceRound ? '0' + state.voiceRound : '—') + '</span></div><div class="metric-grid"><div><span>ASR</span><b>' + state.voiceLatency.asr + '<small>ms</small></b></div><div><span>Intent</span><b>' + state.voiceLatency.intent + '<small>ms</small></b></div><div><span>KB</span><b>' + state.voiceLatency.kb + '<small>ms</small></b></div><div><span>TTS</span><b>' + state.voiceLatency.tts + '<small>ms</small></b></div></div><div class="obs-section"><div class="obs-section-title"><span>KNOWLEDGE BASE</span><b>top hits</b></div><ul class="knowledge-list">' + knowledge + '</ul></div><div class="obs-section"><div class="obs-section-title"><span>EVENT LOG</span><b>' + state.voiceLogs.length + ' events</b></div><ul class="voice-log">' + logs + '</ul></div><div class="rtc-quick"><div class="obs-section-title"><span>RTC PIPELINE</span><b>demo telemetry</b></div><div class="rtc-quick-grid"><div><span>connection</span><b>stable</b></div><div><span>jitter</span><b>18 ms</b></div><div><span>packet loss</span><b>0.2%</b></div><div><span>interrupt</span><b>&lt; 180 ms</b></div></div></div><div class="obs-boundary"><span>MOCK / READ-ONLY</span><p>业务数据使用脱敏 Mock；航空场景只读查询，运营商复杂请求转人工，足球结果是娱乐型偏好画像。</p></div><div class="obs-links">' + (scenario.id === 'football' ? '<a href="https://worldcup-sbti-mvp.surge.sh/" target="_blank" rel="noreferrer">打开完整版足球人格 Demo ↗</a>' : '') + '</div></aside></section>');
}

function deliveryAppView() {
  const items = [
    ['scope', '范围已确认', '目标用户、输入、输出和不做什么'],
    ['poc', 'PoC 可复现', '核心路径、测试数据和环境说明'],
    ['acceptance', '验收标准', '通过条件、Badcase 和证据位置'],
    ['handoff', '交付资产', '版本、负责人、风险和下一步']
  ];
  const done = state.deliveryChecks.length;
  return shell('<section class="page-intro section-pad app-page-intro"><span class="section-label">DELIVERY CONTROL ROOM / LOCAL APP</span><h1>把交付状态<br /><em>变成可核验清单。</em></h1><p>点选四个关键门槛，生成一份面试官可以直接看到的 PoC / 验收 / 风险闭环。</p></section><section class="section-pad delivery-app"><div class="delivery-toolbar"><div><span class="mini-label">PROJECT STATUS</span><h2>AI 语音项目交付</h2></div><span class="delivery-progress">' + done + ' / 4 READY</span></div><div class="delivery-grid"><div class="delivery-checks">' + items.map((item) => '<button class="delivery-check ' + (state.deliveryChecks.includes(item[0]) ? 'checked' : '') + '" type="button" data-delivery-check="' + item[0] + '"><span class="check-box">' + (state.deliveryChecks.includes(item[0]) ? '✓' : '') + '</span><span><b>' + item[1] + '</b><small>' + item[2] + '</small></span></button>').join('') + '<button class="button primary delivery-summary-button" type="button" data-delivery-summary>生成交付摘要 <span>↗</span></button></div><aside class="delivery-summary"><span class="mini-label">DELIVERY EVIDENCE</span><h3>' + (state.deliverySummary || '还没有生成摘要') + '</h3><div class="delivery-meter"><i style="width:' + (done * 25) + '%"></i></div><p>' + (done === 4 ? '四项交付门槛已准备，可以进入客户验收或内部复盘。' : '每勾选一项，就多一份可核验的交付证据。') + '</p><div class="delivery-tags"><span>范围</span><span>测试</span><span>验收</span><span>风险</span></div></aside></div><div class="lab-disclosure"><span>LOCAL PRODUCT DEMO</span><p>这是一个可操作的交付治理原型，不代表任何客户项目已经验收或上线。</p></div></section>');
}
function detailView(project) {
  const rtc = project.rtcPipeline ? '<div class="detail-block rtc-detail"><span class="section-label">RTC PIPELINE / CONFIGURATION</span><h2>从麦克风到可交付通话。</h2><div class="rtc-pipeline">' + project.rtcPipeline.map((item, index) => '<div><b>0' + (index + 1) + '</b><span>' + item + '</span></div>').join('<i>→</i>') + '</div><div class="rtc-config-grid">' + project.configs.map((item) => '<div><span>' + item[0] + '</span><b>' + item[1] + '</b></div>').join('') + '</div><div class="rtc-detail-note">公开页面用浏览器语音能力展示交互、状态和观测面；生产接入需要在服务端落实 WebRTC / WebSocket、密钥隔离、重连和真实音频链路。</div></div>' : '';
  return shell('<section class="detail-hero section-pad"><a class="back-link" href="#/projects">← 返回产品拆解</a><div class="detail-title-row"><div><span class="section-label">' + project.number + ' / ' + project.eyebrow + '</span><h1>' + project.title + '</h1><p class="detail-lede">' + project.summary + '</p></div>' + visual(project.accent) + '</div><div class="detail-meta"><span>我的角色：' + project.role + '</span>' + project.tags.map((tag) => '<span>' + tag + '</span>').join('') + '</div></section><section class="section-pad detail-layout"><div class="detail-main"><div class="detail-block"><span class="section-label">PRODUCT DECISIONS</span><h2>我具体做了什么</h2><ul>' + project.facts.map((fact) => '<li>' + fact + '</li>').join('') + '</ul></div><div class="detail-block"><span class="section-label">SYSTEM MAP</span><h2>产品链路</h2><div class="architecture-flow">' + project.architecture.map((item, index) => '<div><b>0' + (index + 1) + '</b><span>' + item + '</span></div>').join('<i>→</i>') + '</div></div>' + rtc + '<div class="detail-block"><span class="section-label">EVALUATION</span><h2>怎么判断做对了</h2><ul>' + project.evaluation.map((item) => '<li>' + item + '</li>').join('') + '</ul></div></div><aside class="detail-aside"><div class="aside-card"><span class="aside-label">EXPERIENCE</span><h3>' + (project.slug === 'voice-agent-system' ? '先体验三类语音场景，再看这套 RTC 拆解。' : project.slug === 'agent-launch-lab' ? '先玩一次 Agent Launch Lab。' : '回到可体验的产品现场。') + '</h3><a class="button primary full" href="' + (project.slug === 'voice-agent-system' ? '#/apps/voice?scenario=carrier' : '#/apps') + '">进入应用 <span>↗</span></a>' + extLink(githubUrl, '查看 GitHub', 'button secondary full') + '</div><div class="aside-card boundary"><span class="aside-label">PUBLIC BOUNDARY</span><p>' + project.limitations + '</p><span class="status-chip">事实与边界已标注</span></div></aside></section>');
}
function methodView() {
  const steps = [['01', '研究与场景', '先找真实用户、业务目标和失败成本，再决定 AI 是否适合进入流程。'], ['02', '产品定义', '把模型能力翻译成用户旅程、状态、配置项、权限和可解释反馈。'], ['03', '原型与 Agent', '用可交互原型验证话术、状态机、工具调用、语音链路和关键边界。'], ['04', '评测与验收', '提前写测试用例、Badcase、指标和准出条件，不把演示效果当成上线结果。'], ['05', '交付与复盘', '保留版本、来源、风险、负责人和交付资产，让方案能被团队继续使用。']];
  return shell('<section class="page-intro section-pad"><span class="section-label">HOW I WORK / AI PRODUCT DELIVERY</span><h1>熟悉 AI，<br /><em>不靠堆关键词。</em></h1><p>我把 AI 产品工作拆成可以被观察、被测试、被验收的步骤。作品集里的每个案例都沿着这条链路展开。</p></section><section class="section-pad workflow-grid">' + steps.map((item) => '<article class="workflow-card"><span>' + item[0] + '</span><h3>' + item[1] + '</h3><p>' + item[2] + '</p></article>').join('') + '</section><section class="section-pad safety-panel"><div><span class="section-label">PUBLIC BOUNDARY</span><h2>公开 Demo 也要讲清楚边界。</h2></div><ul><li>不把计划、内部测试或客户转述写成已上线结果。</li><li>不把 API Key、Token、内部域名和客户数据放进浏览器。</li><li>区分演示原型、可运行 Demo 和生产系统。</li><li>用公开链接、PRD 和测试脚本支持结论。</li></ul></section><section class="section-pad ai-method-board"><div><span class="section-label">AI WORKFLOW</span><h2>研究 → 需求 → 原型 → 评测 → 交付</h2></div><div class="method-board-line">' + ['Research', 'Define', 'Prototype', 'Evaluate', 'Ship'].map((step, index) => '<div><b>0' + (index + 1) + '</b><span>' + step + '</span><small>' + ['找问题', '定范围', '做体验', '找失败', '可交付'][index] + '</small></div>').join('<i>→</i>') + '</div></section><section class="section-pad contact-strip compact"><span class="section-label">CONTACT</span><h2>想聊 AI 产品、语音交互或智能硬件？</h2><a class="button primary" href="mailto:' + email + '">' + email + ' <span>↗</span></a></section>');
}
function labView() {
  return shell('<section class="page-intro section-pad lab-page-intro"><span class="section-label">INTERACTIVE PRODUCT PROOF / 01</span><h1>让面试变成一次<br /><em>产品体验。</em></h1><p>选择一个 Agent、输入一个想法、跑一轮评测，再把候选版本发布出去。你看到的每个状态都对应我做产品时会保留的决策和证据。</p></section><section class="section-pad lab-page">' + labPanel(false) + '</section>');
}
function notFoundView() { return shell('<section class="page-intro section-pad"><span class="section-label">404 / PAGE NOT FOUND</span><h1>这条路径还没有产品。</h1><a class="button primary" href="#/">回到首页</a></section>'); }

function bindLabEvents() {
  document.querySelectorAll('[data-mode]').forEach((button) => button.addEventListener('click', () => { state.modeId = button.dataset.mode; state.response = ''; refreshLab(); }));
  const input = document.querySelector('#agent-input');
  if (input) input.addEventListener('input', (event) => { state.input = event.target.value; });
  const run = document.querySelector('[data-run]');
  if (run) run.addEventListener('click', () => { state.status = 'evaluated'; state.score = 92; state.response = activeMode().response; state.events.push({ time: new Date().toLocaleTimeString('zh-CN', { hour12: false }), label: '3 core scenarios passed', tone: 'lime' }); refreshLab(); });
  const publish = document.querySelector('[data-publish]');
  if (publish) publish.addEventListener('click', () => { if (state.status === 'draft') return; state.status = 'released'; state.events.push({ time: new Date().toLocaleTimeString('zh-CN', { hour12: false }), label: 'release candidate published', tone: 'orange' }); refreshLab(); });
  const speak = document.querySelector('[data-speak]');
  if (speak) speak.addEventListener('click', () => { if ('speechSynthesis' in window) { window.speechSynthesis.cancel(); const utterance = new SpeechSynthesisUtterance(state.response || activeMode().response); utterance.lang = 'zh-CN'; window.speechSynthesis.speak(utterance); speak.textContent = '♪'; } });
}
function bindDeliveryEvents() {
  document.querySelectorAll('[data-delivery-check]').forEach((button) => button.addEventListener('click', () => {
    const key = button.dataset.deliveryCheck;
    state.deliveryChecks = state.deliveryChecks.includes(key) ? state.deliveryChecks.filter((item) => item !== key) : state.deliveryChecks.concat(key);
    render();
  }));
  const summary = document.querySelector('[data-delivery-summary]');
  if (summary) summary.addEventListener('click', () => { state.deliverySummary = state.deliveryChecks.length === 4 ? 'READY FOR ACCEPTANCE' : 'IN PROGRESS / NEEDS EVIDENCE'; render(); });
}
function voiceLog(label, tone) {
  state.voiceLogs.push({ time: new Date().toLocaleTimeString('zh-CN', { hour12: false }), label, tone: tone || 'cyan' });
}
function browserSpeak(text) {
  if (!('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = state.voiceLanguage === 'en' ? 'en-US' : state.voiceLanguage === 'ar' ? 'ar-SA' : 'zh-CN';
  utterance.rate = Number(state.voiceSpeed);
  window.speechSynthesis.speak(utterance);
}
async function elevenLabsSpeak(text) {
  if (!state.voiceApiKey) { state.voiceApiState = 'browser fallback'; browserSpeak(text); return; }
  state.voiceApiState = 'ElevenLabs API';
  const started = performance.now();
  try {
    const response = await fetch('https://api.elevenlabs.io/v1/text-to-speech/' + state.voiceVoice, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'xi-api-key': state.voiceApiKey },
      body: JSON.stringify({ text, model_id: state.voiceModel, language_code: state.voiceLanguage, voice_settings: { stability: Number(state.voiceStability), similarity_boost: Number(state.voiceSimilarity), style: Number(state.voiceStyle), speed: Number(state.voiceSpeed), use_speaker_boost: true } })
    });
    if (!response.ok) throw new Error('ElevenLabs HTTP ' + response.status);
    const blob = await response.blob();
    const audio = document.querySelector('#voice-audio');
    if (audio) { audio.src = URL.createObjectURL(blob); audio.hidden = false; audio.play().catch(() => {}); }
    state.voiceLatency.tts = Math.max(1, Math.round(performance.now() - started));
    voiceLog('ElevenLabs TTS audio ready', 'lime');
  } catch (error) {
    state.voiceApiState = 'API error → browser fallback';
    state.voiceLatency.tts = Math.max(1, Math.round(performance.now() - started));
    voiceLog('TTS fallback: ' + error.message, 'orange');
    browserSpeak(text);
  }
}
function processVoiceInput(text) {
  const value = String(text || '').trim();
  if (!value || state.voiceStatus === 'thinking') return;
  const scenario = activeVoiceScenario();
  state.voiceInput = '';
  state.voiceMessages.push({ role: 'user', text: value });
  state.voiceStatus = 'thinking';
  state.voiceStep = Math.max(1, state.voiceStep);
  state.voiceRound += 1;
  state.voiceLatency.asr = 240 + Math.min(180, value.length * 4);
  state.voiceLatency.intent = 28 + (value.length % 19);
  state.voiceLatency.kb = 20 + (scenario.id === 'airline' ? 12 : 6);
  voiceLog('user utterance received', 'cyan');
  voiceLog('intent classified: ' + scenario.id, 'cyan');
  render();
  window.setTimeout(() => {
    state.voiceStep = Math.min(scenario.workflow.length, 4);
    state.voiceMessages.push({ role: 'assistant', text: scenario.reply });
    state.voiceStatus = 'ready';
    voiceLog('knowledge base top hit returned', 'lime');
    voiceLog('response committed / handoff boundary checked', 'lime');
    render();
    elevenLabsSpeak(scenario.reply);
  }, 420);
}
function bindVoiceEvents() {
  document.querySelectorAll('[data-voice-sample]').forEach((button) => button.addEventListener('click', () => {
    const input = document.querySelector('#voice-input');
    if (input) { input.value = button.dataset.voiceSample; state.voiceInput = input.value; input.focus(); }
  }));
  const input = document.querySelector('#voice-input');
  if (input) input.addEventListener('input', (event) => { state.voiceInput = event.target.value; });
  const send = document.querySelector('[data-voice-send]');
  if (send) send.addEventListener('click', () => processVoiceInput(state.voiceInput));
  const mic = document.querySelector('[data-voice-mic]');
  if (mic) mic.addEventListener('click', () => {
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Recognition) { state.voiceApiState = 'browser recognition unavailable'; voiceLog('microphone API unavailable; use text input', 'orange'); render(); return; }
    const recognition = new Recognition();
    recognition.lang = state.voiceLanguage === 'en' ? 'en-US' : state.voiceLanguage === 'ar' ? 'ar-SA' : 'zh-CN';
    recognition.interimResults = false;
    recognition.onstart = () => { state.voiceStatus = 'listening'; voiceLog('microphone listening', 'cyan'); render(); };
    recognition.onresult = (event) => { const transcript = event.results[0][0].transcript; processVoiceInput(transcript); };
    recognition.onerror = (event) => { state.voiceStatus = 'ready'; state.voiceApiState = 'microphone error'; voiceLog('microphone error: ' + event.error, 'orange'); render(); };
    recognition.onend = () => { if (state.voiceStatus === 'listening') { state.voiceStatus = 'ready'; render(); } };
    recognition.start();
  });
  const end = document.querySelector('[data-voice-end]');
  if (end) end.addEventListener('click', () => { state.voiceStatus = 'ready'; voiceLog('call ended by user', 'orange'); render(); });
  const speak = document.querySelector('[data-voice-speak]');
  if (speak) speak.addEventListener('click', () => { const last = [...state.voiceMessages].reverse().find((item) => item.role === 'assistant'); if (last) elevenLabsSpeak(last.text); });
  document.querySelectorAll('[data-voice-language]').forEach((el) => el.addEventListener('change', (event) => { state.voiceLanguage = event.target.value; }));
  document.querySelectorAll('[data-voice-voice]').forEach((el) => el.addEventListener('change', (event) => { state.voiceVoice = event.target.value; }));
  document.querySelectorAll('[data-voice-model]').forEach((el) => el.addEventListener('change', (event) => { state.voiceModel = event.target.value; }));
  const apiKey = document.querySelector('[data-voice-api-key]');
  if (apiKey) apiKey.addEventListener('input', (event) => { state.voiceApiKey = event.target.value; state.voiceApiState = event.target.value ? 'ready to call ElevenLabs' : 'browser fallback'; });
  const sliderMap = [['[data-voice-stability]', 'voiceStability', 'stability'], ['[data-voice-similarity]', 'voiceSimilarity', 'similarity'], ['[data-voice-style]', 'voiceStyle', 'style'], ['[data-voice-speed]', 'voiceSpeed', 'speed']];
  sliderMap.forEach(([selector, key, output]) => { const el = document.querySelector(selector); if (el) el.addEventListener('input', (event) => { state[key] = event.target.value; const target = document.querySelector('[data-output="' + output + '"]'); if (target) target.value = event.target.value; }); });
}

function bindAppCards() {
  document.querySelectorAll('[data-app-route]').forEach((card) => {
    const open = () => {
      const route = card.dataset.appRoute;
      if (route.startsWith('#')) window.location.hash = route.slice(1);
      else window.open(route, '_blank', 'noopener,noreferrer');
    };
    card.addEventListener('click', (event) => { if (!event.target.closest('a,button')) open(); });
    card.addEventListener('keydown', (event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); open(); } });
  });
}
function refreshLab() {
  const lab = document.querySelector('#agent-lab');
  if (!lab) return;
  lab.outerHTML = labPanel(lab.classList.contains('compact'));
  bindLabEvents();
  bindDeliveryEvents();
  bindVoiceEvents();
  bindAppCards();
}
function render() {
  const rawHash = window.location.hash.replace(/^#\/?/, '');
  const hashParts = rawHash.split('?');
  const hash = hashParts[0];
  const query = new URLSearchParams(hashParts[1] || '');
  const segments = hash.split('/').filter(Boolean);
  if (!segments.length) app.innerHTML = homeView();
  else if (segments[0] === 'apps' && segments[1] === 'agent') app.innerHTML = labView();
  else if (segments[0] === 'apps' && segments[1] === 'voice') app.innerHTML = voiceScenarioView(query.get('scenario') || 'carrier');
  else if (segments[0] === 'apps' && segments[1] === 'delivery') app.innerHTML = deliveryAppView();
  else if (segments[0] === 'apps') app.innerHTML = appsView();
  else if (segments[0] === 'lab') app.innerHTML = labView();
  else if (segments[0] === 'projects' && segments[1]) { const project = projects.find((item) => item.slug === segments[1]); app.innerHTML = project ? detailView(project) : notFoundView(); }
  else if (segments[0] === 'projects') app.innerHTML = projectsView();
  else if (segments[0] === 'method') app.innerHTML = methodView();
  else app.innerHTML = notFoundView();
  bindLabEvents();
  bindDeliveryEvents();
  bindVoiceEvents();
  bindAppCards();
  window.scrollTo({ top: 0, behavior: 'instant' });
}
window.addEventListener('hashchange', render);
render();

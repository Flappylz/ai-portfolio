import './styles.css';
import { agentModes, apps, capabilities, projects } from './data/projects.js';

const app = document.querySelector('#app');
const githubUrl = 'https://github.com/Flappylz';
const email = '760871196@qq.com';

const state = { modeId: 'discovery', status: 'draft', score: 0, input: '', response: '', deliveryChecks: [], deliverySummary: '', events: [
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
  return '<section class="app-launcher section-pad" id="apps"><div class="launcher-head"><div><span class="section-label">APPLICATION DESK</span><h2>直接打开产品 Demo。</h2></div><p>四个入口，分别展示 Agent、实时语音、智能硬件和 AI 项目交付。作品说明放在后面，先让你看到能运行的东西。</p></div><div class="app-grid">' + apps.map(appCard).join('') + '</div></section>';
}
function homeView() {
  return shell('<section class="desk-hero section-pad"><div><span class="section-label">冯良泽AI / APPLICATION DESK</span><h1>先看能运行的<br /><em>产品 Demo。</em></h1><p>这里放的是可以直接打开和操作的应用入口：Agent、实时语音、智能硬件、项目交付。</p><div class="desk-actions"><a class="button primary" href="#/apps">打开应用工作台 <span>↗</span></a><a class="button secondary" href="#/projects">看产品拆解 <span>↗</span></a></div></div><div class="desk-meta"><span><i></i>4 个应用入口</span><span>2 个公开 Demo</span><span>2 个本地交互应用</span></div></section>' + appLauncher() + '<section class="section-pad demo-note"><span class="section-label">HOW TO READ</span><p>每个入口都对应一个产品能力：先打开、再操作、最后看拆解。公开 Demo 会在新标签页打开；本地应用直接在站内运行。</p></section>');
}
function projectsView() {
  return shell('<section class="page-intro section-pad"><span class="section-label">ORIGINAL WORK / 0 → 1</span><h1>不把 Demo 当作品。<br /><em>把判断做成产品。</em></h1><p>下面四个案例都从问题、范围和交付边界出发，重点展示我如何把 AI 能力组织成可体验、可评测的产品系统。</p></section><section class="section-pad project-list">' + projects.map((project, index) => projectCard(project, index === 0)).join('') + '</section><section class="section-pad proof-band"><div><span class="section-label">AI FLUENCY</span><h2>熟悉 AI，体现在边界和验证里。</h2></div><div class="proof-list"><span>模型能力边界</span><span>Agent 状态管理</span><span>实时语音链路</span><span>工具调用</span><span>评测与 Badcase</span><span>安全与交付</span></div></section>');
}
function appsView() {
  return shell('<section class="page-intro section-pad app-page-intro"><span class="section-label">APPLICATION DESK / 4 LIVE ENTRIES</span><h1>应用入口在这里。</h1><p>先体验产品，再看产品拆解。公开 Demo 会在新标签页打开，本地应用直接在站内运行。</p></section>' + appLauncher());
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
  return shell('<section class="detail-hero section-pad"><a class="back-link" href="#/projects">← 返回产品拆解</a><div class="detail-title-row"><div><span class="section-label">' + project.number + ' / ' + project.eyebrow + '</span><h1>' + project.title + '</h1><p class="detail-lede">' + project.summary + '</p></div>' + visual(project.accent) + '</div><div class="detail-meta"><span>我的角色：' + project.role + '</span>' + project.tags.map((tag) => '<span>' + tag + '</span>').join('') + '</div></section><section class="section-pad detail-layout"><div class="detail-main"><div class="detail-block"><span class="section-label">PRODUCT DECISIONS</span><h2>我具体做了什么</h2><ul>' + project.facts.map((fact) => '<li>' + fact + '</li>').join('') + '</ul></div><div class="detail-block"><span class="section-label">SYSTEM MAP</span><h2>产品链路</h2><div class="architecture-flow">' + project.architecture.map((item, index) => '<div><b>0' + (index + 1) + '</b><span>' + item + '</span></div>').join('<i>→</i>') + '</div></div><div class="detail-block"><span class="section-label">EVALUATION</span><h2>怎么判断做对了</h2><ul>' + project.evaluation.map((item) => '<li>' + item + '</li>').join('') + '</ul></div></div><aside class="detail-aside"><div class="aside-card"><span class="aside-label">EXPERIENCE</span><h3>' + (project.slug === 'agent-launch-lab' ? '先玩一次 Agent Launch Lab。' : '回到可体验的产品现场。') + '</h3><a class="button primary full" href="#/lab">进入实验室 <span>↗</span></a>' + extLink(githubUrl, '查看 GitHub', 'button secondary full') + '</div><div class="aside-card boundary"><span class="aside-label">PUBLIC BOUNDARY</span><p>' + project.limitations + '</p><span class="status-chip">事实与边界已标注</span></div></aside></section>');
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
  bindAppCards();
}
function render() {
  const hash = window.location.hash.replace(/^#\/?/, '');
  const segments = hash.split('/').filter(Boolean);
  if (!segments.length) app.innerHTML = homeView();
  else if (segments[0] === 'apps' && segments[1] === 'agent') app.innerHTML = labView();
  else if (segments[0] === 'apps' && segments[1] === 'delivery') app.innerHTML = deliveryAppView();
  else if (segments[0] === 'apps') app.innerHTML = appsView();
  else if (segments[0] === 'lab') app.innerHTML = labView();
  else if (segments[0] === 'projects' && segments[1]) { const project = projects.find((item) => item.slug === segments[1]); app.innerHTML = project ? detailView(project) : notFoundView(); }
  else if (segments[0] === 'projects') app.innerHTML = projectsView();
  else if (segments[0] === 'method') app.innerHTML = methodView();
  else app.innerHTML = notFoundView();
  bindLabEvents();
  bindDeliveryEvents();
  bindAppCards();
  window.scrollTo({ top: 0, behavior: 'instant' });
}
window.addEventListener('hashchange', render);
render();

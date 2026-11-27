import './styles.css';
import '@fontsource-variable/ibm-plex-sans';
import '@fontsource/ibm-plex-mono';
import { createVoiceSettings, newVoiceSettings } from './voice-settings.js';
import { apps, voiceScenarios } from './data/projects.js';
import { ConnectionState, Room, RoomEvent, createLocalAudioTrack } from 'livekit-client';

const app = document.querySelector('#app');
const githubUrl = 'https://github.com/Flappylz';
const email = '760871196@qq.com';

const state = { modeId: 'discovery', status: 'draft', score: 0, input: '', response: '', deliveryChecks: [], deliverySummary: '', voiceScenario: 'carrier', voiceInput: '', voiceStatus: 'sandbox', voiceCallStatus: 'idle', voiceMuted: false, voiceSubtitleVisible: true, voiceStep: 0, voiceMessages: [], voiceConversation: [], voiceLogs: [], voiceLogQuery: '', voiceLogScope: 'all', voiceTraceStatus: 'not loaded', voiceTraceEvents: [], voiceTraceWriteQueue: Promise.resolve(), voiceRound: 0, voiceLanguage: 'zh', voiceVoice: 'default', voiceInteractionType: 'voice_call', voiceModel: 'eleven_flash_v2_5', voiceModelSource: 'openai_direct', voiceAgentModel: 'openai/gpt-6.1-sol', voiceFastModel: 'openai/gpt-6.1-sol', voiceSlowModel: 'openai/gpt-6.1-sol', voiceSlowStatus: 'idle', voiceQualityPath: 'fast voice → slow validation', voiceAsrModel: 'openai/gpt-live-transcribe', voiceAsrFallback: false, voiceRecognition: null, voiceRecognitionActive: false, voiceVad: 'silero_vad', voiceNoiseReduction: true, voiceAllowInterruption: true, voiceSilenceStrategy: false, voiceHangupStrategy: false, voiceVoiceprintRecognition: false, voiceGenderRecognition: false, voiceAddresseeAwareFiltering: false, voiceStartWithVoiceCall: false, voiceUserMessagePosition: 'right', voiceSessionRelevanceRejection: false, voiceMaxCallTime: 1800, voiceTone: 'neutral', voicePitch: 1, voiceEmotion: 'neutral', voiceStability: 0.5, voiceSimilarity: 0.75, voiceStyle: 0.2, voiceSpeed: 1, voiceVolume: 1, voicePreviewText: '请试听当前的 ElevenLabs 语音配置。', voiceOutputFormat: 'mp3_44100_128', voiceChunkSchedule: '50,120,160,290', voiceBargeIn: 'server_vad', voicePartial: '', voiceTtsText: '', voiceTtsPartial: '', voiceAmplitude: 0, voiceAudioContext: null, voiceAnalyserSources: [], voiceWaveFrame: null, voiceInsights: { emotion: '未启用', age: '未启用', gender: '未启用', confidence: null }, runtimeMode: 'sandbox', voiceApiState: 'sandbox / simulated', voiceLatency: { asr: null, intent: null, kb: null, slow: null, tts: null, e2e: null, interrupt: null }, voiceMetrics: { rtt: null, jitter: null, packetLoss: null, interrupt: null }, voiceSession: null, voiceRoom: null, voiceLocalTrack: null, voiceEventSocket: null, voiceTtsSocket: null, voiceAudio: null, voiceStatsTimer: null, voiceOutboundInit: false, events: [
  { time: '09:41:03', label: 'workspace initialized', tone: 'quiet' },
  { time: '09:41:11', label: 'agent schema loaded', tone: 'cyan' }
] };

const defaultDialogueModel = 'openai/gpt-6.1-sol';
const demoPreferences = {
  language: 'zh', voiceId: 'default', fastModel: defaultDialogueModel, slowModel: defaultDialogueModel,
  asrModel: 'openai/gpt-live-transcribe', ttsModel: 'eleven_flash_v2_5',
  voiceConfig: {
    ...newVoiceSettings, groundedFastPath: true, volume: 1, speed: 1, stability: .5, similarity: .75, style: 0,
    tone: 'neutral', emotion: 'neutral', noiseReduction: true,
    outputFormat: 'pcm_22050', chunkSchedule: '50,120,160,290'
  }
};
let demoRoute = false;
let selectedMobilePanel = 'call';
let demoCallStartedAt = 0;
let demoCallEndedAt = 0;
let activeModels = null;
let agentConfirmed = false;
let callAttempt = 0;
const traceBatches = new Map();
const isDemo = () => demoRoute;

const esc = (value) => String(value || '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;');
const asset = (path) => import.meta.env.BASE_URL + path;
const voiceRuntimeUrl = () => import.meta.env.VITE_VOICE_RUNTIME_URL || window.__VOICE_RUNTIME_URL || '';
const voiceRuntimeEndpoint = (path) => voiceRuntimeUrl() ? voiceRuntimeUrl().replace(/\/$/, '') + path : path;
const voiceRuntimeSocket = (path) => {
  const base = voiceRuntimeUrl();
  if (!base) return '';
  const url = new URL(base.replace(/^http/, 'ws').replace(/\/$/, '') + path);
  return url.toString();
};
const extLink = (href, label, className) => '<a class="' + (className || '') + '" href="' + esc(href) + '" target="_blank" rel="noreferrer">' + label + '</a>';

const settingsPanel = createVoiceSettings({
  endpoint: voiceRuntimeEndpoint,
  read: () => demoPreferences,
  scenario: () => activeVoiceScenario().id,
  change(key, value) {
    if (key.startsWith('config.')) demoPreferences.voiceConfig[key.slice(7)] = value;
    else demoPreferences[key] = value;
    if (key === 'config.volume') {
      state.voiceVolume = value;
      document.querySelectorAll('[data-livekit-audio]').forEach((audio) => { audio.volume = value; });
    }
    if (!['connecting', 'connected'].includes(state.voiceCallStatus)) render(true);
  }
});

function demoCallDuration() {
  const seconds = demoCallStartedAt ? Math.floor(((demoCallEndedAt || Date.now()) - demoCallStartedAt) / 1000) : 0;
  return [Math.floor(seconds / 60), seconds % 60].map((value) => String(value).padStart(2, '0')).join(':');
}

function resetDemoCall() {
  state.voiceApiState = 'ready';
  state.voiceQualityPath = '对话生成 → 并行核验';
  demoCallStartedAt = 0;
  demoCallEndedAt = 0;
  activeModels = null;
  agentConfirmed = false;
  state.voiceSession = null;
  state.voiceMuted = false;
  state.voiceConversation = [];
  state.voiceMessages = [];
  state.voiceLogs = [];
  state.voiceLogQuery = '';
  state.voiceLogScope = 'all';
  state.voiceTraceEvents = [];
  state.voiceTraceStatus = 'not loaded';
  state.voiceTraceWriteQueue = Promise.resolve();
  state.voiceStep = 0;
  state.voicePartial = '';
  state.voiceTtsPartial = '';
  state.voiceTtsText = '';
  state.voiceLatency = { asr: null, intent: null, kb: null, slow: null, tts: null, e2e: null, interrupt: null };
  state.voiceMetrics = { rtt: null, jitter: null, packetLoss: null, interrupt: null };
}

const resumeFile = 'resume/fengliangze-ai-product-manager.pdf';
const brandName = '冯良泽 · AI 产品经理';
const portfolioStats = [
  ['6 年', '产品经验'],
  ['近 3 年', '实时语音与 Agent'],
  ['20 人', '跨职能团队协作'],
];
const navItems = [
  ['projects', '作品'],
  ['method', '架构'],
  ['about', '关于'],
  ['contact', '联系'],
];
let activePage = '';

function header() {
  const links = navItems.map(([route, label]) => '<a href="#/' + route + '"' +
    (activePage === route ? ' aria-current="page"' : '') + '>' + label + '</a>').join('');
  return '<header class="site-header"><a class="brand" href="#/" aria-label="冯良泽作品集首页">' +
    '<span class="brand-mark" aria-hidden="true"><i></i><i></i></span><span><strong>' + brandName +
    '</strong><small>实时语音与智能呼叫中心</small></span></a><nav class="site-nav" aria-label="主导航">' +
    links + '</nav></header>';
}

function footer() {
  return '<footer class="site-footer"><div class="footer-brand"><div><strong>' + brandName +
    '</strong><p>实时语音 · Voice Agent · 产品交付</p></div></div><div class="footer-links">' +
    extLink(githubUrl, 'GitHub') + '<a href="mailto:' + email + '">邮件联系</a><span>© 2026</span></div></footer>';
}

function shell(content) {
  return header() + '<main id="main-content">' + content + '</main>' + footer();
}

function resumeLink() {
  return '<a class="button primary resume-download" href="' + asset(resumeFile) +
    '" download>下载脱敏简历 <span aria-hidden="true">↓</span></a>';
}

function appCard(item) {
  return '<article class="app-card" data-app-route="' + esc(item.route) + '">' +
    '<div class="app-card-art ' + esc(item.avatar?.accent || 'cyan') + '"><span>' + esc(item.number) + ' / ' + esc(item.type || 'VOICE') + '</span><b>' + esc(item.avatar?.roleCode || 'VOICE / 00') + '</b><div class="app-art-grid"></div><img src="' + asset(item.avatar?.image || '') + '" alt="" loading="lazy"><i></i><i></i><i></i></div>' +
    '<div class="app-card-body"><div class="app-card-head"><span class="app-type">' + esc(item.avatar?.shortRole || 'Voice Agent') + '</span><span class="app-status">LIVE DEMO</span></div>' +
    '<h3>' + esc(item.productTitle) + '</h3><p>' + esc(item.value) + '</p>' +
    '<div class="app-card-signal"><span>' + esc(item.avatar?.signal || '实时语音 · Agent') + '</span><strong>' + esc(item.result) + '</strong></div>' +
    '<div class="case-card-actions"><a class="app-open" href="' + item.route + '">进入通话舱 <span aria-hidden="true">↗</span></a>' +
    '<a href="' + item.caseRoute + '">拆解架构 <span aria-hidden="true">→</span></a></div></div></article>';
}

function appLauncher() {
  const facts = portfolioStats.map(([value, label]) => '<div><dt>' + label + '</dt><dd>' + value + '</dd></div>').join('');
  return shell('<section class="mission-console section-pad"><div class="mission-topline"><span><i></i> PORTFOLIO CONTROL ROOM / 2026</span><span>LIVE SYSTEM · 03 SCENARIOS READY</span></div>' +
    '<div class="mission-hero"><div><p class="portfolio-kicker">AI PRODUCT BUILDER · REALTIME VOICE</p><h1>把 AI 变成<br><em>可交付的通话。</em></h1><p class="portfolio-lede">三个可直接拨打的 Voice Agent，展示我如何从业务问题、角色设定和知识库，做到实时交互、可观测和可验收。</p><div class="mission-actions"><a class="button primary" href="#/apps/voice?scenario=carrier">启动第一个 Demo <span aria-hidden="true">↗</span></a><a class="button ghost" href="#/method">查看技术路线 <span aria-hidden="true">→</span></a></div></div><div class="mission-readout"><span class="readout-label">SYSTEM READOUT</span><strong>03</strong><span>voice applications</span><div class="readout-line"><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div><small>LiveKit / ElevenLabs / Agent / Trace</small></div></div>' +
    '<div class="mission-section-head"><div><span class="section-label">APPLICATION BAY</span><h2>选择一个通话场景</h2></div><p>每个入口都是真实可运行的交互页面。先体验，再打开架构和证据。</p></div>' +
    '<div class="app-grid">' + apps.map(appCard).join('') + '</div>' +
    '<div class="mission-proof"><div><span class="section-label">DELIVERY SIGNALS</span><h3>从体验到交付证据</h3><p>角色状态、ASR/TTS 字幕、RTC 指标、知识命中和完整 Trace 同时出现，面试官可以沿着一通电话看到产品决策。</p></div><dl class="portfolio-stats" aria-label="关键经历">' + facts + '</dl><div class="mission-proof-links"><a href="#/projects">查看作品拆解 →</a>' + resumeLink() + '</div></div></section>');
}

function homeView() {
  return appLauncher();
}

function appsView() {
  return appLauncher();
}

function aboutView() {
  return shell('<section class="page-intro section-pad portfolio-page"><h1>关于我</h1>' +
    '<p class="portfolio-lede">冯良泽，AI 产品经理。简历记录了 6 年产品经验，近 3 年聚焦实时语音、Agent 与智能呼叫中心交互。</p>' +
    '<h2>我负责的工作</h2><p>在百融云创，我主导 WebCall 产品方案，参与端到端语音 Agent 设计，并定义通话状态、TTS 配置契约和验收指标。此前在中信百信银行负责 3D 数字人直播间从产品设计到上线，在小冰协调研发、设计、美术和运营等 20 人团队推进正式版本。</p>' +
    '<p>教育经历包括北京大学艺术硕士和中国传媒大学广播电视编导本科。</p>' + resumeLink() +
    '</section>');
}

const caseSections = [
  ['problem', '问题与用户'],
  ['decision', '我的判断与方案'],
  ['tradeoff', '关键取舍'],
  ['result', '结果与指标定义'],
];

function caseStudyView(item) {
  const { caseStudy, workflow } = voiceScenarios.find((scenario) => scenario.id === item.id);
  const sections = caseSections.map(([key, title]) =>
    '<section><h3>' + title + '</h3><p>' + esc(caseStudy[key]) + '</p></section>').join('');
  return '<article class="portfolio-case"><header><div><span class="case-index">' + esc(item.number) + '</span>' +
    '<h2>' + esc(item.productTitle) + '</h2><p>' + esc(item.value) + '</p></div>' +
    '<a class="button primary" href="' + item.route + '">体验语音 <span aria-hidden="true">↗</span></a></header>' +
    '<div class="case-sections">' + sections + '</div>' +
    '<details class="case-technical"><summary>技术架构与验证口径</summary>' +
    '<p>麦克风 → LiveKit WebRTC → 语音识别与断句 → 规则直答或模型核验 → ElevenLabs 流式播报。' +
    '通话页可展开模型、指标与日志，核对同一次会话中的事件。</p><ol>' +
    workflow.map((step) => '<li>' + esc(step) + '</li>').join('') + '</ol>' +
    '<p>公开 Demo 使用真实语音链路，业务与题库使用演示数据。</p></details></article>';
}

function projectsView(id) {
  const selected = id ? apps.filter((item) => item.id === id) : apps;
  if (!selected.length) return notFoundView();
  const relatedCases = apps.map((item) => '<a href="' + item.caseRoute + '"' +
    (item.id === id ? ' aria-current="page"' : '') + '>' + esc(item.productTitle) + '</a>').join('');
  return shell('<section class="page-intro section-pad portfolio-page"><h1>作品</h1>' +
    '<p class="portfolio-lede">三个真实通话 Demo，分别演示呼入客服、票面规则解释与连续语音问答。</p>' +
    '<nav class="case-nav" aria-label="浏览案例">' + relatedCases + '</nav>' + selected.map(caseStudyView).join('') + '</section>');
}

function methodView() {
  return shell('<section class="page-intro section-pad portfolio-page"><h1>方法论</h1>' +
    '<p class="portfolio-lede">把语音体验拆成可以测试的通话行为，再决定优化哪一段。</p>' +
    '<section class="architecture-overview" aria-labelledby="architecture-title"><div class="architecture-heading"><div><span class="section-label">整体架构 · DELIVERY VOICE AGENT</span><h2 id="architecture-title">从音频进入，到业务结果可追溯</h2></div><p>采用“实时音频主链路 + 可审计业务链路”的双路设计。通话不被慢工具阻塞，关键字段、工具动作和播报文本都留下同一条 Trace。</p></div>' +
    '<div class="architecture-rail" aria-label="整体技术架构"><article><span>01 · 接入</span><h3>Browser / LiveKit</h3><p>浏览器麦克风、短期 Token、LiveKit WebRTC 房间与连接质量。</p><b>WebRTC · RTP · Data Track</b></article><i aria-hidden="true">→</i><article><span>02 · 感知</span><h3>VAD / ASR</h3><p>检测 speech-start / stop，保留 partial 与 final transcript，支持热词和字段提示。</p><b>Silero VAD · GPT Live Transcribe</b></article><i aria-hidden="true">→</i><article><span>03 · 决策</span><h3>Fast / Slow Agent</h3><p>快模型负责下一轮对话，慢模型并行核验事实、风险和工具结果。</p><b>gpt-6.1-sol · low → validation</b></article><i aria-hidden="true">→</i><article><span>04 · 执行</span><h3>Tools / TTS / Trace</h3><p>知识检索与业务工具独立执行，ElevenLabs 流式播报，事件写入 Durable KV。</p><b>ElevenLabs · Durable KV · Logs</b></article></div>' +
    '<div class="architecture-split"><article><span class="section-label">实时主链路 · 低延迟</span><h3>听 → 判断 → 说</h3><ol><li><b>VAD</b><span>确认用户是否说完，避免无意义抢话。</span></li><li><b>ASR</b><span>先出 partial，再提交 final，数字和专名进入字段校验。</span></li><li><b>Fast LLM</b><span>优先给出下一问或可核对的规则答案。</span></li><li><b>TTS</b><span>首包优先、可打断，旧音频在插话后立即停止。</span></li></ol></article><article><span class="section-label">业务副链路 · 可审计</span><h3>查 → 验 → 回灌</h3><ol><li><b>Reasoner</b><span>只负责路由和选择工具，不直接越过业务规则。</span></li><li><b>Knowledge / API</b><span>慢查询独立运行，结果带版本、耗时和命中依据。</span></li><li><b>Slow LLM</b><span>核对事实、风险和字段完整性，过期结果不回灌。</span></li><li><b>Trace</b><span>记录输入、事件、工具、字幕、音频和错误原因。</span></li></ol></article></div>' +
    '<div class="technical-route"><div class="technical-route-head"><div><span class="section-label">技术路线 · 可交付路径</span><h2>一条链路对应一组验收证据</h2></div><span class="route-badge">LIVEKIT + ELEVENLABS + KV</span></div><div class="technical-route-table"><div class="technical-route-row technical-route-columns"><span>阶段</span><span>实现</span><span>可观测证据</span><span>交付检查</span></div>' +
    [['01 · 建立', '创建 session、短期 token 和 room', 'session_created / token_issued / room_joined', '连接 ≤ 3s，失败说明原因'], ['02 · 上行', '麦克风 PCM 进入 WebRTC，浏览器采集 RTC stats', 'speech_started / partial_transcript / RTT', '字幕增量出现，静音不乱答'], ['03 · 路由', '快模型先答，慢模型并行核验，工具不阻塞通话', 'intent / knowledge_hit / tool_call / validation', '结果过期丢弃，写操作二次确认'], ['04 · 下行', 'ElevenLabs WebSocket 流式 TTS，首包优先', 'tts_started / tts_first_byte / tts_text', '有效回复首段 ≤ 1.8s，插话停止旧音频'], ['05 · 归档', '事件与完整对话写入 Durable KV，按 session 查询', 'traceId / final_transcript / ended / error', '挂断后可检索，跨实例仍可读']].map((row) => '<div class="technical-route-row"><span>' + row[0] + '</span><span>' + row[1] + '</span><span>' + row[2] + '</span><span>' + row[3] + '</span></div>').join('') + '</div></div>' +
    '<div class="architecture-boundary"><div><strong>已经接通</strong><span>LiveKit WebRTC、ElevenLabs 流式 TTS、gpt-6.1-sol fast/slow 路由、ASR/TTS 双向字幕、Durable KV 会话 Trace。</span></div><div><strong>公开边界</strong><span>三个 Demo 使用脱敏知识库和模拟业务数据，不查询真实航司库存、运营商账户或生产坐席。电话线路、转人工和写入动作保留服务端接口。</span></div></div></section>' +
    '<div class="method-grid">' +
    '<article><h2>先定义有效回复</h2><p>我把首段有效回复时延定义为用户停止说话到浏览器播出有用答复的时间。欢迎语和等待话术单独统计。验收先听答复是否解决问题，再测识别、生成、播报首包和整段时延。</p><p>业务交付还会跟踪接通率、有效对话率、任务成功率、转人工率与 P95 端到端时延。每项指标都要带时间窗、样本和分母。</p></article>' +
    '<article><h2>为速度和正确性设边界</h2><p>能被公开规则回答的问题，我用快路径返回可核对的事实，并在确认匹配后播出已合成的语音。涉及实时业务信息、缺字段或高风险动作时，交给模型解释、并行核验或澄清。打断优先停止旧播报，避免用户纠正后还在听旧答案。</p></article>' +
    '<article><h2>让问题能重放和复测</h2><p>我把接通、语音转写、命中、播报和结束串在同一个会话里。复测用相同的录音输入，对照真实远端音频、事件时间和答复内容。上线后分别观察成功率、异常类型和尾延迟，保留灰度与回滚口径。</p></article>' +
    '</div></section>');
}

function contactView() {
  return shell('<section class="page-intro section-pad portfolio-page"><h1>联系</h1>' +
    '<p class="portfolio-lede">可通过邮件联系我，或在 GitHub 查阅公开作品。</p>' +
    '<ul class="portfolio-contact"><li><a href="mailto:' + email + '">' + email + '</a></li><li>' +
    extLink(githubUrl, 'GitHub · Flappylz') + '</li></ul>' + resumeLink() +
    '<figure class="portfolio-qr"><img src="' + asset('assets/portfolio-qr.svg') +
    '" width="116" height="116" alt="扫描二维码访问作品集"><figcaption>手机扫码查看作品集</figcaption></figure></section>');
}

function activeVoiceScenario() { return voiceScenarios.find((item) => item.id === state.voiceScenario) || voiceScenarios[0]; }
function stopVoiceAnalyser() {
  if (state.voiceWaveFrame) window.cancelAnimationFrame(state.voiceWaveFrame);
  state.voiceWaveFrame = null;
  state.voiceAnalyserSources.forEach((item) => {
    try { item.source.disconnect(); } catch {}
    try { item.sink?.disconnect(); } catch {}
  });
  state.voiceAnalyserSources = [];
  if (state.voiceAudioContext) state.voiceAudioContext.close().catch(() => {});
  state.voiceAudioContext = null;
  state.voiceAmplitude = 0;
}
function ensureVoiceAudioContext() {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return null;
  if (!state.voiceAudioContext) state.voiceAudioContext = new AudioContextClass();
  if (state.voiceAudioContext.state === 'suspended') state.voiceAudioContext.resume().catch(() => {});
  return state.voiceAudioContext;
}
function updateVoiceWaveform() {
  const wave = document.querySelector('.call-wave');
  if (!wave) return;
  const bars = [...wave.querySelectorAll('i')];
  const samples = state.voiceAnalyserSources;
  let amplitude = 0;
  for (const item of samples) {
    item.analyser.getByteTimeDomainData(item.data);
    let sum = 0;
    for (const value of item.data) {
      const normalized = (value - 128) / 128;
      sum += normalized * normalized;
    }
    amplitude = Math.max(amplitude, Math.sqrt(sum / item.data.length));
  }
  const smoothed = state.voiceAmplitude * 0.72 + amplitude * 0.28;
  state.voiceAmplitude = smoothed;
  const active = smoothed > 0.018;
  wave.classList.toggle('sound-active', active);
  const pattern = [0.72, 1, 0.66, 0.9, 1.1, 0.78, 0.98, 0.62, 0.86];
  bars.forEach((bar, index) => {
    const level = active ? Math.min(1, smoothed * 5.6 * pattern[index % pattern.length]) : 0;
    bar.style.height = `${Math.round(6 + level * 30)}px`;
    bar.style.opacity = String(active ? 0.56 + level * 0.44 : 0.24);
  });
  const canvas = document.querySelector('.avatar-pulse-canvas');
  if (canvas) {
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const width = Math.max(1, Math.round(rect.width * dpr));
    const height = Math.max(1, Math.round(rect.height * dpr));
    if (canvas.width !== width || canvas.height !== height) { canvas.width = width; canvas.height = height; }
    const context = canvas.getContext('2d');
    if (context) {
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      context.clearRect(0, 0, rect.width, rect.height);
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;
      const base = Math.min(rect.width, rect.height) * .28;
      const color = getComputedStyle(document.body).getPropertyValue('--accent').trim() || '#8ac9ff';
      const pulse = base * (1 + Math.min(.24, smoothed * 1.7));
      context.strokeStyle = color;
      context.globalAlpha = active ? .42 : .14;
      context.lineWidth = 1;
      context.beginPath();
      context.arc(centerX, centerY, pulse, -Math.PI * .75, Math.PI * .22);
      context.stroke();
      context.globalAlpha = active ? .22 : .08;
      context.beginPath();
      context.arc(centerX, centerY, pulse * 1.18, Math.PI * .18, Math.PI * 1.12);
      context.stroke();
      if (active) {
        context.fillStyle = color;
        for (let index = 0; index < 9; index += 1) {
          const angle = (performance.now() / 2600) + index * .71;
          const radius = pulse * (1.05 + (index % 3) * .08);
          const size = 1 + smoothed * 3 * ((index % 2) + .5);
          context.globalAlpha = .2 + smoothed * .55;
          context.beginPath();
          context.arc(centerX + Math.cos(angle) * radius, centerY + Math.sin(angle) * radius, size, 0, Math.PI * 2);
          context.fill();
        }
      }
      context.globalAlpha = 1;
    }
  }
  state.voiceWaveFrame = window.requestAnimationFrame(updateVoiceWaveform);
}
function addVoiceAnalyserForTrack(track) {
  if (!track?.mediaStreamTrack) return;
  const context = ensureVoiceAudioContext();
  if (!context) return;
  const analyser = context.createAnalyser();
  analyser.fftSize = 256;
  analyser.smoothingTimeConstant = 0.74;
  const source = context.createMediaStreamSource(new MediaStream([track.mediaStreamTrack]));
  const sink = context.createGain();
  sink.gain.value = 0;
  source.connect(analyser);
  analyser.connect(sink);
  sink.connect(context.destination);
  state.voiceAnalyserSources.push({ source, analyser, sink, data: new Uint8Array(analyser.fftSize) });
  if (!state.voiceWaveFrame) state.voiceWaveFrame = window.requestAnimationFrame(updateVoiceWaveform);
}
function addVoiceAnalyserForElement(element) {
  if (!element) return;
  const context = ensureVoiceAudioContext();
  if (!context) return;
  try {
    const analyser = context.createAnalyser();
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.74;
    const source = context.createMediaElementSource(element);
    const sink = context.createGain();
    // MediaElementSource replaces the element's normal output path. Keep the
    // signal audible while the analyser observes the same stream.
    sink.gain.value = 1;
    source.connect(analyser);
    analyser.connect(sink);
    sink.connect(context.destination);
    state.voiceAnalyserSources.push({ source, analyser, sink, data: new Uint8Array(analyser.fftSize), element });
    if (!state.voiceWaveFrame) state.voiceWaveFrame = window.requestAnimationFrame(updateVoiceWaveform);
  } catch {
    // A media element can only be connected to one AudioContext source.
  }
}
function removeVoiceAnalyserForElement(element) {
  if (!element) return;
  const matches = state.voiceAnalyserSources.filter((item) => item.element === element);
  matches.forEach((item) => {
    try { item.source.disconnect(); } catch {}
    try { item.sink?.disconnect(); } catch {}
  });
  state.voiceAnalyserSources = state.voiceAnalyserSources.filter((item) => item.element !== element);
}
function resetVoiceState(id) {
  const next = voiceScenarios.find((item) => item.id === id) || voiceScenarios[0];
  if (state.voiceScenario === id && (state.voiceMessages.length || state.voiceLogs.length)) return;
  if (state.voiceRoom) state.voiceRoom.disconnect();
  if (state.voiceRecognition) { try { state.voiceRecognition.abort(); } catch {} }
  stopVoiceAnalyser();
  if (state.voiceEventSocket) state.voiceEventSocket.close();
  if (state.voiceStatsTimer) window.clearInterval(state.voiceStatsTimer);
  state.voiceScenario = id; state.voiceInput = ''; state.voiceStatus = next.direction === 'outbound' ? 'ringing' : 'idle'; state.voiceCallStatus = next.direction === 'outbound' ? 'ringing' : 'idle'; state.voiceStep = 0; state.voiceMessages = []; state.voiceConversation = []; state.voiceLogs = []; state.voiceLogQuery = ''; state.voiceLogScope = 'all'; state.voiceTraceStatus = 'not loaded'; state.voiceTraceEvents = []; state.voiceTraceWriteQueue = Promise.resolve(); state.voiceVolume = 1; state.voicePreviewText = '请试听当前的 ElevenLabs 语音配置。'; state.voiceRound = 0; state.runtimeMode = isDemo() ? 'ready' : voiceRuntimeUrl() ? 'live' : 'sandbox'; state.voiceApiState = isDemo() ? '待接通' : voiceRuntimeUrl() ? 'live ready' : 'sandbox / simulated'; state.voicePartial = ''; state.voiceTtsText = ''; state.voiceTtsPartial = ''; state.voiceAsrFallback = false; state.voiceRecognition = null; state.voiceRecognitionActive = false; state.voiceInsights = { emotion: '未启用', age: '未启用', gender: '未启用', confidence: null }; state.voiceLatency = { asr: null, intent: null, kb: null, slow: null, tts: null, e2e: null, interrupt: null }; state.voiceMetrics = { rtt: null, jitter: null, packetLoss: null, interrupt: null }; state.voiceSlowStatus = 'idle'; state.voiceQualityPath = '对话生成 → 并行核验'; state.voiceSession = null; state.voiceRoom = null; state.voiceEventSocket = null; state.voiceStatsTimer = null; state.voiceOutboundInit = false;
}
function voiceScenarioView(id) {
  resetVoiceState(id);
  const scenario = activeVoiceScenario();
  const fastModel = isDemo() ? activeModels?.fastModel || demoPreferences.fastModel : state.voiceFastModel || state.voiceAgentModel;
  const slowModel = isDemo() ? activeModels?.slowModel || demoPreferences.slowModel : state.voiceSlowModel;
  const asrModel = isDemo() ? activeModels?.asrModel || demoPreferences.asrModel : state.voiceAsrModel;
  const ttsModel = isDemo() ? activeModels?.ttsModel || demoPreferences.ttsModel : state.voiceModel;
  const messages = state.voiceConversation.length ? state.voiceConversation.map((item) => '<div class="voice-message ' + item.role + '"><span>' + (item.role === 'user' ? '你' : '助手') + '<small>' + esc(item.time) + '</small></span><p>' + esc(item.text) + '</p></div>').join('') : '<div class="voice-empty">' + (scenario.direction === 'outbound' ? '接听后，Agent 会主动开始提问。' : '拨号后，Agent 会先播放欢迎语。') + '</div>';
  const logs = state.voiceLogs.slice(-6).reverse().map((item) => '<li><time>' + item.time + '</time><b class="event-dot ' + item.tone + '"></b><span>' + item.label + '</span></li>').join('');
  const steps = scenario.workflow.map((step, index) => '<div class="voice-step ' + (state.voiceStep >= index + 1 ? 'active' : '') + '"><b>0' + (index + 1) + '</b><span>' + step + '</span></div>').join('');
  const knowledge = scenario.knowledge.map(([title, description]) =>
    '<li><div><b>' + title + '</b><small>' + description + '</small></div></li>').join('');
  const metric = (value, unit) => value === null ? '<b class="metric-null">—</b>' : '<b>' + value + '<small>' + unit + '</small></b>';
  const sessionLabel = state.voiceSession?.sessionId ? state.voiceSession.sessionId.slice(0, 14) : '尚未建立';
  const insightCards = [['情绪', state.voiceInsights.emotion, 'emotion'], ['年龄', state.voiceInsights.age, 'age'], ['性别', state.voiceInsights.gender, 'gender']].map((item) => '<div class="insight-card"><span>' + item[0] + '</span><b>' + esc(item[1]) + '</b><small>' + (state.voiceInsights.confidence ? state.voiceInsights.confidence + '% 置信度' : '演示占位') + '</small></div>').join('');
  const architecture = ['浏览器麦克风 / 文本', 'LiveKit WebRTC 房间', 'ASR + VAD + Agent 状态机', '快模型即时应答', '慢模型并行核验', '知识库 / 工具调用', 'ElevenLabs 流式 TTS', '字幕、指标与 Trace'];
  const sequenceRows = [
    ['01', '建立会话', 'Browser', 'LiveKit', '短期 token、room、traceId'],
    ['02', '上行音频', 'Browser', 'ASR / VAD', 'partial transcript + speech_started'],
    ['03', '识别意图', 'ASR / VAD', 'Fast LLM', '低延迟路由与下一问'],
    ['04', '检索与核验', 'Fast LLM', 'KB / Slow LLM', '知识命中、规则校验、风险标记'],
    ['05', '流式播报', 'Agent', 'ElevenLabs', 'tts_started → first_byte → audio chunks'],
    ['06', '下行播放', 'ElevenLabs', 'LiveKit → Browser', '字幕、波形、barge-in 可观测'],
    ['07', '收尾归档', 'Agent', 'Trace Store', '完整会话、指标与错误原因'],
  ];
  const sequenceDiagram = '<div class="sequence-block"><div class="sequence-block-head"><div><span class="section-label">通话时序</span><h3>通话各阶段的事件与证据</h3></div></div><div class="sequence-lanes"><span>步骤</span><span>事件</span><span>来源</span><span>去向</span><span>证据</span></div>' + sequenceRows.map((row) => '<div class="sequence-row"><b>' + row[0] + '</b><strong>' + row[1] + '</strong><span>' + row[2] + '</span><i>→</i><span>' + row[3] + '</span><small>' + row[4] + '</small></div>').join('') + '</div>';
  const detailPages = '<details class="voice-detail-pages" id="voice-details" data-detail-key="technical"><summary>技术架构与场景规则</summary><article class="voice-detail-page"><div><span class="section-label">技术架构 · ' + scenario.title + '</span><h2>实时语音链路</h2></div><div class="detail-flow">' + architecture.map((item, index) => '<div><b>0' + (index + 1) + '</b><span>' + item + '</span></div>').join('<i>→</i>') + '</div>' + sequenceDiagram + '<div class="detail-evidence-grid"><div><span>AGENT</span><b>' + esc(fastModel) + '</b><small>当前对话模型</small></div><div><span>语音识别（ASR）</span><b>' + esc(asrModel) + '</b><small>当前转写模型</small></div><div><span>TTS</span><b>' + esc(ttsModel) + '</b><small>ElevenLabs 流式模型</small></div><div><span>传输</span><b>LiveKit WebRTC</b><small>WebSocket TTS fallback</small></div><div><span>STATUS</span><b>' + state.voiceCallStatus.toUpperCase() + '</b><small>' + state.runtimeMode.toUpperCase() + '</small></div><div><span>TRACE</span><b>' + esc(state.voiceSession?.traceId || sessionLabel) + '</b><small>事件可追溯</small></div></div></article><article class="voice-detail-page"><div><span class="section-label">业务流程与知识库</span><h2>场景规则和实施边界</h2></div><div class="detail-two-col"><div><h3>业务流程</h3><ol class="business-flow">' + scenario.workflow.map((item, index) => '<li><b>0' + (index + 1) + '</b><span>' + item + '</span></li>').join('') + '</ol></div><div><h3>知识库</h3><ul class="detail-knowledge">' + knowledge + '</ul></div></div><div class="detail-boundary"><span>数据边界</span><p>公开数据为模拟场景；真实票价、套餐、库存、客户资料和生产权限不会进入前端。失败时保留已确认信息，并进入文本降级或人工转接。</p></div></article></details>';
  const latestMessage = [...state.voiceMessages].reverse()[0];
  const liveCaptionText = state.voicePartial || state.voiceTtsPartial || state.voiceTtsText || latestMessage?.text || '';
  const liveCaptionRole = state.voicePartial ? 'YOU · ASR PARTIAL' : (state.voiceTtsPartial || state.voiceTtsText || latestMessage?.role === 'assistant' ? 'AGENT · LIVE CAPTION' : 'LIVE CAPTION');
  const captionRow = (who, text, placeholder, type) =>
    '<div class="live-subtitle ' + type + (text ? ' has-text' : ' placeholder') + '"><span>' + who + '</span><p>' + esc(text || placeholder) + '</p></div>';
  const latestUser = state.voiceConversation.findLast((item) => item.role === 'user')?.text;
  const demoCaptions = '<div class="voice-captions-area" aria-label="双向实时字幕">' +
    captionRow('你' + (state.voicePartial ? ' · 正在转写' : ''), state.voicePartial || latestUser, '你的话会实时转写', 'user') +
    captionRow('语音助手', state.voiceTtsPartial || state.voiceTtsText, '助手的播报会在这里显示', 'assistant') + '</div>';
  const liveCaption = state.voiceSubtitleVisible && isDemo() ? demoCaptions : state.voiceSubtitleVisible ? '<div class="live-subtitle ' + (liveCaptionText ? 'has-text' : 'placeholder') + '" role="status" aria-live="polite"><span>' + liveCaptionRole + '</span><p>' + esc(liveCaptionText || '说话时，实时字幕会显示在这里') + '</p></div>' : '';
  const transcriptPanel = state.voiceSubtitleVisible ? '<div class="voice-transcript"><div class="transcript-head"><span>' + (isDemo() ? '完整通话记录' : 'ASR / TTS TRANSCRIPT') + ' · ' + state.voiceConversation.length + ' 轮</span><b>' + state.voiceCallStatus.toUpperCase() + '</b></div><div class="transcript-layer partial"><span>实时转写（ASR）</span><p>' + esc(state.voicePartial || '等待用户说话…') + '</p></div><div class="conversation-thread" aria-live="polite">' + messages + '</div><div class="transcript-layer tts"><span>播报字幕（TTS）</span><p>' + esc(state.voiceTtsPartial || state.voiceTtsText || '等待 Agent 播报…') + '</p></div></div>' : '<div class="subtitle-hidden">字幕已隐藏。你仍可以在右侧日志与指标面板查看事件。</div>';
  const avatar = scenario.avatar || { image: '', roleCode: 'VOICE / 00', shortRole: 'Voice Agent', alt: scenario.title, accent: 'cyan', signal: 'Realtime voice' };
  const agentAvatar = '<div class="agent-identity"><div class="agent-avatar ' + esc(avatar.accent || scenario.accent) + '"><img src="' + asset(avatar.image) + '" alt="' + esc(avatar.alt) + '"></div><div><b>' + esc(scenario.agentName || scenario.title) + '</b><small>' + esc(scenario.agentRole || 'Voice Agent') + '</small></div></div>';
  const option = (value, current, label) => '<option value="' + esc(value) + '"' + (current === value ? ' selected' : '') + '>' + label + '</option>';
  const settingsDisclosure = (title, hint, body, open = false) => '<details class="settings-disclosure"' + (open ? ' open' : '') + '><summary><span>' + title + '</span><small>' + hint + '</small><b>⌄</b></summary><div class="settings-disclosure-body">' + body + '</div></details>';
  const baseSettings = '<div class="settings-stack">' +
    settingsDisclosure('通话基础', '语言 / 音色 / 语气',
      '<label>Interaction Type<select data-voice-interaction-type>' + option('voice_call', state.voiceInteractionType, 'Voice Call') + option('voice_assistant', state.voiceInteractionType, 'Voice Assistant') + '</select></label>' +
      '<label>Language<select data-voice-language>' + option('zh', state.voiceLanguage, '中文 / zh') + option('en', state.voiceLanguage, 'English / en') + option('ar', state.voiceLanguage, 'العربية / ar') + '</select></label>' +
      '<label>Voice<select data-voice-voice>' + option('default', state.voiceVoice, 'Server default') + option('JBFqnCBsd6RMkjVDRZzb', state.voiceVoice, 'George · neutral') + option('21m00Tcm4TlvDq8ikWAM', state.voiceVoice, 'Rachel · clear') + '</select></label>' +
      '<label>Tone<select data-voice-tone>' + option('neutral', state.voiceTone, '中性') + option('warm', state.voiceTone, '温暖') + option('professional', state.voiceTone, '专业') + option('energetic', state.voiceTone, '活跃') + '</select></label>' +
      '<label>Emotion<select data-voice-emotion>' + option('neutral', state.voiceEmotion, '中性') + option('calm', state.voiceEmotion, '平静') + option('happy', state.voiceEmotion, '积极') + option('empathetic', state.voiceEmotion, '共情') + '</select></label>', true) +
    settingsDisclosure('模型路由', 'ASR / fast / slow / TTS',
      '<label>TTS model<select data-voice-model>' + option('eleven_flash_v2_5', state.voiceModel, 'Eleven Flash V2.5 · low latency') + option('eleven_turbo_v2_5', state.voiceModel, 'Eleven Turbo V2.5 · balanced') + option('eleven_v4_turbo', state.voiceModel, 'Eleven V4 Turbo · quality') + '</select></label>' +
      '<label>Fast model<select data-voice-fast-model>' + option('openai/gpt-6.1-sol', state.voiceFastModel, 'gpt-6.1-sol · low') + option('openai/gpt-4.1-mini', state.voiceFastModel, 'gpt-4.1-mini · 快') + option('openai/gpt-4.1', state.voiceFastModel, 'gpt-4.1 · 快') + option('openai/gpt-4o-mini', state.voiceFastModel, 'gpt-4o-mini · 轻量') + '</select></label>' +
      '<label>Slow model<select data-voice-slow-model>' + option('openai/gpt-6.1-sol', state.voiceSlowModel, 'gpt-6.1-sol · low') + option('openai/gpt-4.1-mini', state.voiceSlowModel, 'gpt-4.1-mini · 深度') + option('openai/gpt-4.1', state.voiceSlowModel, 'gpt-4.1 · 深度') + option('openai/gpt-4o-mini', state.voiceSlowModel, 'gpt-4o-mini · 轻量') + '</select></label>' +
      '<label>ASR model<select data-voice-asr-model>' + option('Web Speech API / Chrome sandbox', state.voiceAsrModel, 'Browser fallback · sandbox') + option('openai/gpt-live-transcribe', state.voiceAsrModel, 'OpenAI gpt-live-transcribe · direct') + option('openai/gpt-4o-transcribe', state.voiceAsrModel, 'OpenAI gpt-4o-transcribe · direct') + '</select></label>') +
    settingsDisclosure('声音参数', 'ElevenLabs streaming',
      '<label>Pitch · browser preview <output data-output="pitch">' + state.voicePitch + '</output><input type="range" min="0.8" max="1.2" step="0.05" value="' + state.voicePitch + '" data-voice-pitch></label>' +
      '<label>Volume · playback <output data-output="volume">' + state.voiceVolume + '</output><input type="range" min="0" max="1" step="0.05" value="' + state.voiceVolume + '" data-voice-volume></label>' +
      '<label>Speed <output data-output="speed">' + state.voiceSpeed + '</output><input type="range" min="0.7" max="1.2" step="0.05" value="' + state.voiceSpeed + '" data-voice-speed></label>' +
      '<label>Stability <output data-output="stability">' + state.voiceStability + '</output><input type="range" min="0" max="1" step="0.05" value="' + state.voiceStability + '" data-voice-stability></label>' +
      '<label>Similarity <output data-output="similarity">' + state.voiceSimilarity + '</output><input type="range" min="0" max="1" step="0.05" value="' + state.voiceSimilarity + '" data-voice-similarity></label>' +
      '<label>Style <output data-output="style">' + state.voiceStyle + '</output><input type="range" min="0" max="1" step="0.05" value="' + state.voiceStyle + '" data-voice-style></label>' +
      '<label>Output format<select data-voice-output-format>' + option('mp3_44100_128', state.voiceOutputFormat, 'mp3_44100_128') + option('pcm_16000', state.voiceOutputFormat, 'pcm_16000') + '</select></label>' +
      '<label>Chunk schedule<input data-voice-chunk-schedule value="' + state.voiceChunkSchedule + '" aria-label="Chunk schedule" /></label>' +
      '<div class="voice-preview-block"><span class="field-kicker">VOICE PREVIEW</span><textarea data-voice-preview-text rows="2" placeholder="输入一段试听文案">' + esc(state.voicePreviewText) + '</textarea><button type="button" class="voice-preview-button" data-voice-preview>试听当前音色</button></div>') +
    settingsDisclosure('实时控制', 'VAD / interruption / noise',
      '<label>Barge-in<select data-voice-barge-in>' + option('server_vad', state.voiceBargeIn, 'Server VAD') + option('semantic_vad', state.voiceBargeIn, 'Semantic VAD') + '</select></label>' +
      '<label>VAD Settings<select data-voice-vad>' + option('silero_vad', state.voiceVad, 'Silero VAD') + option('server_vad', state.voiceVad, 'Server VAD') + option('semantic_vad', state.voiceVad, 'Semantic VAD') + '</select></label>' +
      '<label class="toggle-field"><span>Noise Reduction</span><input type="checkbox" data-voice-noise ' + (state.voiceNoiseReduction ? 'checked' : '') + '></label>' +
      '<label class="toggle-field"><span>Allow Interruption</span><input type="checkbox" data-voice-interruption ' + (state.voiceAllowInterruption ? 'checked' : '') + '></label>' +
      '<label class="toggle-field"><span>Silence Strategy</span><input type="checkbox" data-voice-silence ' + (state.voiceSilenceStrategy ? 'checked' : '') + '></label>') +
    settingsDisclosure('会话策略', '识别 / 归档 / 结束',
      '<label class="toggle-field"><span>Voiceprint Recognition</span><input type="checkbox" data-voice-voiceprint ' + (state.voiceVoiceprintRecognition ? 'checked' : '') + '></label>' +
      '<label class="toggle-field"><span>Gender Recognition</span><input type="checkbox" data-voice-gender ' + (state.voiceGenderRecognition ? 'checked' : '') + '></label>' +
      '<label class="toggle-field"><span>Addressee-Aware Speech Filtering</span><input type="checkbox" data-voice-addressee ' + (state.voiceAddresseeAwareFiltering ? 'checked' : '') + '></label>' +
      '<label class="toggle-field"><span>Hang-Up Strategy</span><input type="checkbox" data-voice-hangup ' + (state.voiceHangupStrategy ? 'checked' : '') + '></label>' +
      '<label class="toggle-field"><span>Start with a Voice Call</span><input type="checkbox" data-voice-start-call ' + (state.voiceStartWithVoiceCall ? 'checked' : '') + '></label>' +
      '<label>User Message Position<select data-voice-message-position>' + option('right', state.voiceUserMessagePosition, 'Right') + option('bottom', state.voiceUserMessagePosition, 'Bottom') + '</select></label>' +
      '<label class="toggle-field"><span>Session Relevance Rejection</span><input type="checkbox" data-voice-relevance ' + (state.voiceSessionRelevanceRejection ? 'checked' : '') + '></label>' +
      '<label>Max Call Time<input type="number" min="30" max="7200" step="30" value="' + state.voiceMaxCallTime + '" data-voice-max-time><small>seconds</small></label>') +
    '<div class="settings-delivery-note"><span>DELIVERY CONTROL</span><p>LiveKit WebRTC、ElevenLabs streaming 和可查询 Trace 会随短期 session 配置发送到 runtime。</p></div></div>';
  const settings = baseSettings;
  const traceSource = state.voiceTraceEvents.length ? state.voiceTraceEvents : isDemo() && state.voiceSession ? traceBatches.get(state.voiceSession.sessionId)?.display || [] : state.voiceLogs.map((item) => ({ type: 'ui', ts: item.time, label: item.label, tone: item.tone }));
  const traceQuery = state.voiceLogQuery.trim().toLowerCase();
  const filteredTrace = traceSource.filter((event) => {
    const scopeMatch = state.voiceLogScope === 'all' || event.type === state.voiceLogScope;
    const haystack = traceEventLabel(event).toLowerCase();
    return scopeMatch && (!traceQuery || haystack.includes(traceQuery));
  });
  const traceRows = filteredTrace.slice().reverse().map((event) => '<li><time>' + esc(traceEventTime(event)) + '</time><b class="event-dot ' + (event.type === 'error' ? 'orange' : event.type === 'ended' ? 'quiet' : 'cyan') + '"></b><span>' + esc(traceEventLabel(event)) + '</span></li>').join('') || '<li class="trace-empty">没有匹配的事件</li>';
  const tracePanel = '<details class="observe-detail trace-query-panel" data-detail-key="trace"><summary>' + (isDemo() ? '会话日志' : 'SESSION LOG QUERY') + ' <span>' + filteredTrace.length + ' / ' + traceSource.length + '</span></summary><div class="trace-query-tools"><input type="search" placeholder="搜索事件、文本或错误码" value="' + esc(state.voiceLogQuery) + '" data-voice-log-query><select data-voice-log-scope><option value="all" ' + (state.voiceLogScope === 'all' ? 'selected' : '') + '>全部事件</option><option value="partial_transcript" ' + (state.voiceLogScope === 'partial_transcript' ? 'selected' : '') + '>实时转写（ASR）</option><option value="final_transcript" ' + (state.voiceLogScope === 'final_transcript' ? 'selected' : '') + '>最终转写</option><option value="tts_text" ' + (state.voiceLogScope === 'tts_text' ? 'selected' : '') + '>播报文本（TTS）</option><option value="knowledge_hit" ' + (state.voiceLogScope === 'knowledge_hit' ? 'selected' : '') + '>知识库命中</option><option value="error" ' + (state.voiceLogScope === 'error' ? 'selected' : '') + '>错误</option></select><button type="button" class="trace-refresh" data-voice-trace-load ' + (!state.voiceSession?.sessionId ? 'disabled' : '') + '>刷新日志</button></div><div class="trace-query-status">' + esc(state.voiceTraceStatus) + ' · trace ' + esc(state.voiceSession?.traceId || '尚未建立') + '</div><ul class="voice-log trace-query-results">' + traceRows + '</ul></details>';
  const conversationArchive = '<details class="observe-detail conversation-archive" data-detail-key="archive"><summary>' + (isDemo() ? '完整对话' : 'FULL CONVERSATION') + ' <span>' + state.voiceConversation.length + ' 轮</span></summary><div class="archive-meta">按时间保留最终转写和播报</div><div class="archive-thread">' + messages + '</div></details>';
  const callActive = isDemo() ? ['connecting', 'connected'].includes(state.voiceCallStatus) || Boolean(state.voiceRoom) : ['connecting', 'connected', 'error'].includes(state.voiceCallStatus);
  const micStatus = state.voiceLocalTrack
    ? (isDemo() && state.voiceMuted ? '麦克风已静音' : '麦克风已开启')
    : isDemo() && state.voiceCallStatus === 'ended' ? '麦克风已关闭'
    : state.voiceApiState.includes('microphone') ? '等待麦克风权限' : '拨号时自动申请麦克风';
  const muteButton = callActive ? '<button class="call-action mute ' + (state.voiceMuted ? 'active' : '') + '" type="button" data-voice-mute aria-pressed="' + state.voiceMuted + '" aria-label="' + (state.voiceMuted ? '取消静音' : '静音') + '">' + (state.voiceMuted ? '取消静音' : '静音') + '</button>' : '';
  const endButton = callActive ? '<button class="call-action end" type="button" data-voice-end aria-label="结束通话">结束</button>' : '';
  const callButton = scenario.direction === 'outbound' ? '<button class="call-action answer ' + (['connected', 'connecting'].includes(state.voiceCallStatus) ? 'reconnect' : '') + '" type="button" data-voice-answer aria-label="' + (state.voiceCallStatus === 'ringing' ? '接听来电' : state.voiceCallStatus === 'ended' ? '再次来电' : '已接听') + '">' + (state.voiceCallStatus === 'ringing' ? '接听' : state.voiceCallStatus === 'ended' ? '重拨' : '已接听') + '</button><button class="call-action reject ' + (state.voiceCallStatus === 'ringing' ? '' : 'reconnect') + '" type="button" data-voice-reject aria-label="拒接来电">拒接</button>' : '<button class="call-action answer ' + (state.voiceCallStatus === 'connected' || state.voiceCallStatus === 'connecting' ? 'reconnect' : '') + '" type="button" data-voice-call aria-label="' + (state.voiceCallStatus === 'idle' || state.voiceCallStatus === 'ended' ? '开始拨号' : '重新连接') + '">' + (state.voiceCallStatus === 'idle' || state.voiceCallStatus === 'ended' ? '拨号' : '重连') + '</button>';
  const callHeadline = scenario.direction === 'outbound' && state.voiceCallStatus === 'ringing' ? '有一通语音来电' : state.voiceStatus === 'listening' ? '正在听你说' : state.voiceStatus === 'thinking' ? '正在整理回答' : state.voiceStatus === 'speaking' ? 'Agent 正在播报' : state.voiceCallStatus === 'connected' ? '通话已连接，开始说话' : state.voiceCallStatus === 'connecting' ? '正在建立安全连接' : state.voiceCallStatus === 'error' ? (isDemo() ? '通话暂未接通' : '连接异常，已切换降级体验') : state.voiceCallStatus === 'ended' ? '通话已结束' : '准备建立通话';
  const settingsButton = '<button type="button" class="voice-settings-trigger" data-open-voice-settings aria-haspopup="dialog">语音设置 <span aria-hidden="true">↗</span></button>';
  const mobileNav = '<nav class="voice-mobile-nav" aria-label="工作台面板">' +
    [['call','通话'], ['scenario','场景'], ['metrics','指标'], ['logs','日志']].map(([key, title]) =>
      '<button type="button" data-voice-panel="' + key + '"' + (key === selectedMobilePanel ? ' aria-current="true"' : '') + '>' + title + '</button>').join('') +
    '<button type="button" data-open-voice-settings aria-haspopup="dialog">设置</button></nav>';
  const stages = { idle:'待拨号', ringing:'来电中', connecting:'正在连接', connected:'通话中', listening:'正在听', speaking:'正在播报', thinking:'正在处理', interrupted:'播报已打断', reconnecting:'正在重连', error:'连接异常', ended:'已结束' };
  const chipText = isDemo() ? stages[state.voiceStatus] || stages[state.voiceCallStatus] || '待拨号' : state.voiceStatus.toUpperCase();
  const oldSettings = '<details class="voice-settings compact-settings"><summary>语音配置 <span>语言 / 音色 / 参数</span></summary>' + settings + '</details>';
  const sessionReadout = isDemo()
    ? '<time class="voice-call-timer" aria-label="通话时长">' + demoCallDuration() + '</time>'
    : '<small>trace ' + esc(state.voiceSession?.traceId || sessionLabel) + '</small>';
  const modelLabel = state.runtimeMode === 'sandbox' ? '模拟配置' : agentConfirmed ? '本次通话模型' : '即将使用的模型';
  const withEffort = (model, lane) => {
    const effort = activeModels?.[lane + 'ReasoningEffort'] || demoPreferences.voiceConfig[lane + 'ReasoningEffort'];
    return esc(model) + (isDemo() && effort && !model.includes('/gpt-4') ? ' · ' + esc(effort) : '');
  };
  const fastDisplay = withEffort(fastModel, 'fast');
  const slowDisplay = withEffort(slowModel, 'slow');
  const displayVoice = isDemo() ? settingsPanel.voiceName(activeModels?.voiceId || demoPreferences.voiceId) : state.voiceVoice;
  const detailsLink = '<div class="voice-case-links"><a class="detail-link" href="#/projects/' + scenario.id + '">案例拆解</a>' +
    '<a class="detail-link detail-link-primary" href="#voice-details">展开技术详情</a></div>';
  const modelDetail = '<details class="observe-detail" data-detail-key="models"><summary>' + modelLabel +
    '</summary><div class="current-model-card"><span>' + modelLabel + '</span><div class="model-pair"><div><small>' + (isDemo() ? '对话模型' : 'FAST / VOICE') + '</small><b>' + fastDisplay + '</b></div><div><small>' + (isDemo() ? '核验模型' : 'SLOW / VALIDATE') + '</small><b>' + slowDisplay + '</b></div></div><small>路径：' + esc(state.voiceQualityPath) + ' · TTS: ' + esc(ttsModel) + ' · LLM source: ' + esc(isDemo() ? activeModels?.modelSource || '待连接' : state.voiceModelSource) + '</small></div></details>';
  const metricDetail = '<details class="observe-detail" data-detail-key="metrics"><summary>实时指标</summary><div class="metric-grid realtime"><div><span>语音识别（ASR）</span>' + metric(state.voiceLatency.asr, 'ms') + '</div><div><span>快模型</span>' + metric(state.voiceLatency.intent, 'ms') + '</div><div><span>核验模型</span>' + metric(state.voiceLatency.slow, 'ms') + '</div><div><span>知识库</span>' + metric(state.voiceLatency.kb, 'ms') + '</div><div><span>合成首包（TTS）</span>' + metric(state.voiceLatency.tts, 'ms') + '</div><div><span>服务端首段时延</span>' + metric(state.voiceLatency.e2e ?? (isDemo() || state.voiceLatency.tts === null || state.voiceLatency.asr === null || state.voiceLatency.intent === null ? null : state.voiceLatency.asr + state.voiceLatency.intent + state.voiceLatency.tts), 'ms') + '</div></div><div class="rtc-status-grid"><div><span>网络往返（RTT）</span><b>' + (state.voiceMetrics?.rtt ?? '—') + '</b></div><div><span>抖动</span><b>' + (state.voiceMetrics?.jitter ?? '—') + '</b></div><div><span>丢包</span><b>' + (state.voiceMetrics?.packetLoss ?? '—') + '</b></div><div><span>打断</span><b>' + (state.voiceMetrics?.interrupt ?? '—') + '</b></div></div></details>';
  const sandboxControl = state.runtimeMode === 'sandbox' && state.voiceCallStatus !== 'ended' ?
    '<details class="sandbox-entry" data-detail-key="sandbox"><summary>模拟文字对话</summary><p>模拟内容及耗时用于演示。</p>' +
    '<label>咨询内容<textarea id="voice-input" rows="2" placeholder="' + esc(scenario.prompt) + '">' + esc(state.voiceInput) +
    '</textarea></label><button class="call-action" type="button" data-voice-send>发送模拟问题</button></details>' :
    state.voiceCallStatus === 'error' ? '<button class="call-action" type="button" data-voice-sandbox>使用模拟对话</button>' : '';
  const runtimeLabel = state.runtimeMode === 'live' ? '实时通话' : state.runtimeMode === 'sandbox' ? '模拟演示' : '待接通';
  const observation = '<aside class="voice-observe-panel"><div class="panel-title"><span>会话观测</span><b>' +
    runtimeLabel + '</b></div>' + modelDetail + metricDetail +
    '<details class="observe-detail" data-detail-key="knowledge"><summary>知识库 <span>演示规则</span></summary><ul class="knowledge-list">' + knowledge +
    '</ul></details><details class="observe-detail" data-detail-key="events"><summary>事件摘要 <span>' + state.voiceLogs.length + ' 条</span></summary>' +
    '<ul class="voice-log">' + logs + '</ul></details>' + tracePanel + conversationArchive +
    (isDemo() ? '' : '<div class="insight-grid">' + insightCards + '</div>') +
    '<div class="obs-boundary"><span>' + (state.runtimeMode === 'sandbox' ? '模拟演示 · SANDBOX / SIMULATED' : runtimeLabel) +
    '</span><p>' + (state.runtimeMode === 'sandbox' ? '当前数据用于演示。' : state.runtimeMode === 'ready' ?
      '接通后可展开查看实测参数。' : '指标来自本次会话。知识库使用演示规则。') + '</p></div></aside>';
  return shell('<section class="voice-screen section-pad" ' + (isDemo() ? 'data-mobile-panel="' + selectedMobilePanel + '" ' : '') + 'data-direction="' + scenario.direction + '"><div class="voice-screen-head"><div><span class="section-label">' + (isDemo() ? (scenario.direction === "outbound" ? "外呼" : "呼入") : "INTERACTIVE AI VOICE DEMO / " + scenario.direction.toUpperCase()) + '</span><h1>' + scenario.title + '</h1><p>' + scenario.subtitle + '</p></div><div class="voice-top-actions"><span class="runtime-chip ' + state.runtimeMode + '">' + (isDemo() && state.runtimeMode === 'ready' ? '待接通' : state.runtimeMode.toUpperCase()) + (state.runtimeMode === 'sandbox' ? ' / SIMULATED' : '') + '</span><div class="scenario-tabs" role="tablist" aria-label="语音场景">' + voiceScenarios.map((item) => '<a role="tab" aria-selected="' + (item.id === scenario.id) + '" class="' + (item.id === scenario.id ? 'selected' : '') + '" href="#/apps/voice?scenario=' + item.id + '">' + item.title + '</a>').join('') + '</div></div></div>' + (isDemo() ? mobileNav : '') + '<div class="voice-console"><aside class="voice-context-panel"><div class="panel-title"><span>' + (isDemo() ? '场景' : 'SCENARIO') + '</span><b>' + scenario.direction.toUpperCase() + '</b></div><div class="context-intro"><span class="scenario-icon ' + esc(avatar.accent) + '"><img src="' + asset(avatar.image) + '" alt=""></span><div><h2>' + scenario.title + '</h2><p>' + esc(avatar.roleCode + ' · ' + avatar.signal) + '</p></div></div>' + (isDemo() ? settingsButton : '') + '<details class="observe-detail context-detail" data-detail-key="context"><summary>连接与配置</summary><div class="context-meta"><span>会话编号</span><b>' + esc(sessionLabel) + '</b><span>传输</span><b>' + (state.runtimeMode === 'sandbox' ? '本地模拟' : 'LiveKit WebRTC') + '</b><span>合成模型（TTS）</span><b>' + esc(ttsModel) + '</b><span>快模型</span><b>' + esc(fastModel) + '</b><span>核验模型</span><b>' + esc(slowModel) + '</b><span>语音识别（ASR）</span><b>' + esc(asrModel) + '</b><span>音色</span><b>' + esc(displayVoice === 'default' ? isDemo() ? '场景默认' : 'server default' : displayVoice) + '</b></div></details><div class="panel-title workflow-title"><span>' + (isDemo() ? '业务流程' : 'WORKFLOW') + '</span><b>' + state.voiceStep + '/' + scenario.workflow.length + '</b></div><div class="voice-workflow compact">' + steps + '</div>' + (isDemo() ? '' : oldSettings) + detailsLink + '</aside><section class="voice-stage"><div class="stage-top"><div>' + agentAvatar + '<span class="mini-label">通话</span><b>' + (scenario.direction === 'outbound' ? 'Agent 主动来电' : '用户主动拨号') + '</b></div><span class="voice-state ' + state.voiceStatus + '"><i></i>' + chipText + '</span></div><div class="call-session-strip"><span>' + (state.voiceCallStatus === 'idle' ? '待接通' : '实时传输（WebRTC）') + '</span><b>' + (state.voiceCallStatus === 'connected' ? '已接通' : (stages[state.voiceCallStatus] || state.voiceCallStatus)) + '</b>' + sessionReadout + '</div><div class="caller-orb ' + state.voiceCallStatus + ' ' + state.voiceStatus + ' ' + esc(avatar.accent) + '"><canvas class="avatar-pulse-canvas" aria-hidden="true"></canvas><div class="avatar-rings" aria-hidden="true"><i></i><i></i><i></i></div><img src="' + asset(avatar.image) + '" alt="' + esc(avatar.alt) + '"><span class="avatar-code">' + esc(avatar.roleCode) + '</span></div><div class="call-wave ' + state.voiceStatus + '" data-audio-state="' + state.voiceStatus + '" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div><div class="voice-state-caption"><span>' + esc(avatar.shortRole) + '</span><b>' + esc(avatar.signal) + '</b></div>' + liveCaption + '<strong role="status" aria-live="polite">' + callHeadline + '</strong><div class="call-actions" role="group" aria-label="通话控制"><button class="call-action caption-toggle" type="button" data-voice-captions aria-pressed="' + state.voiceSubtitleVisible + '" aria-label="' + (state.voiceSubtitleVisible ? '隐藏字幕' : '显示字幕') + '">' + (state.voiceSubtitleVisible ? '字幕开' : '字幕关') + '</button>' + callButton + muteButton + endButton + (state.runtimeMode !== 'sandbox' ? sandboxControl : '') + '</div><small>' + micStatus + ' · ASR: ' + esc(asrModel) + ' · ' + state.voiceApiState + '</small>' + (state.runtimeMode === 'sandbox' ? sandboxControl : '') + transcriptPanel + '</section>' + observation + '</div></section>' + detailPages);
}

function notFoundView() { return shell('<section class="page-intro section-pad"><span class="section-label">页面未找到</span><h1>找不到这个页面</h1><a class="button primary" href="#/">回到首页</a></section>'); }

function voiceLog(label, tone) {
  state.voiceLogs.push({ time: new Date().toLocaleTimeString('zh-CN', { hour12: false }), label, tone: tone || 'cyan' });
}
function addConversationMessage(role, text, source = 'live', meta = {}) {
  const value = String(text || '').trim();
  if (!value) return;
  const previous = state.voiceConversation.at(-1);
  if (previous && previous.role === role && previous.text === value && previous.source === source) return;
  const time = new Date().toLocaleTimeString('zh-CN', { hour12: false });
  const message = { id: `${Date.now()}-${state.voiceConversation.length}`, time, role, text: value, source, ...meta };
  state.voiceConversation.push(message);
  state.voiceMessages.push({ role, text: value });
}
function browserSpeak(text) {
  if (!('speechSynthesis' in window)) { state.voiceStatus = 'connected'; render(true); return; }
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  state.voiceStatus = 'speaking';
  utterance.onend = () => { state.voiceStatus = 'connected'; render(true); };
  utterance.onerror = () => { state.voiceStatus = 'connected'; render(true); };
  utterance.lang = state.voiceLanguage === 'en' ? 'en-US' : state.voiceLanguage === 'ar' ? 'ar-SA' : 'zh-CN';
  utterance.rate = Number(state.voiceSpeed);
  window.speechSynthesis.speak(utterance);
}
async function elevenLabsSpeak(text) {
  state.voiceTtsText = text;
  state.voiceStatus = 'speaking';
  voiceLog('TTS text queued: ' + text.slice(0, 60), 'cyan');
  render(true);
  const socketUrl = voiceRuntimeSocket('/api/voice/tts?scenario=' + encodeURIComponent(activeVoiceScenario().id) + '&voiceId=' + encodeURIComponent(state.voiceVoice === 'default' ? '' : state.voiceVoice) + '&modelId=' + encodeURIComponent(state.voiceModel) + '&language=' + encodeURIComponent(state.voiceLanguage) + '&outputFormat=' + encodeURIComponent(state.voiceOutputFormat) + '&chunkSchedule=' + encodeURIComponent(state.voiceChunkSchedule) + '&bargeIn=' + encodeURIComponent(state.voiceBargeIn) + '&tone=' + encodeURIComponent(state.voiceTone) + '&emotion=' + encodeURIComponent(state.voiceEmotion) + '&pitch=' + state.voicePitch + '&volume=' + state.voiceVolume + '&stability=' + state.voiceStability + '&similarity=' + state.voiceSimilarity + '&style=' + state.voiceStyle + '&speed=' + state.voiceSpeed);
  if (!socketUrl) { state.voiceApiState = 'sandbox / browser preview'; browserSpeak(text); return; }
  const started = performance.now();
  state.voiceApiState = state.runtimeMode === 'live' ? 'server TTS connecting' : 'sandbox session / server TTS connecting';
  try {
    const socket = new WebSocket(socketUrl);
    state.voiceTtsSocket = socket;
    const chunks = [];
    socket.addEventListener('open', () => {
      socket.send(JSON.stringify({ type: 'text', text, flush: true }));
      socket.send(JSON.stringify({ type: 'end' }));
    });
    socket.addEventListener('message', (event) => {
      let message;
      try { message = JSON.parse(event.data); } catch { return; }
      if (message.type === 'tts_first_byte') {
        state.voiceLatency.tts = message.ttfbMs || Math.max(1, Math.round(performance.now() - started));
        state.voiceApiState = 'server TTS streaming';
        voiceLog('tts first byte ' + state.voiceLatency.tts + ' ms', 'cyan');
        render(true);
      }
      if (message.type === 'audio' && message.audio) chunks.push(base64ToBytes(message.audio));
      if (message.type === 'tts_final') {
        const blob = new Blob(chunks, { type: 'audio/mpeg' });
        if (state.voiceAudio) state.voiceAudio.pause();
        state.voiceAudio = new Audio(URL.createObjectURL(blob));
        state.voiceAudio.volume = Number(state.voiceVolume);
        state.voiceAudio.playbackRate = Number(state.voicePitch);
        state.voiceAudio.onended = () => { state.voiceStatus = 'connected'; render(true); };
        state.voiceAudio.onerror = () => { state.voiceStatus = 'connected'; voiceLog('audio playback error', 'orange'); render(true); };
        addVoiceAnalyserForElement(state.voiceAudio);
        state.voiceAudio.play().catch(() => {});
        state.voiceApiState = 'server TTS ready';
        voiceLog('server TTS audio ready', 'lime');
        render(true);
      }
      if (message.type === 'error' || message.error || message.code === 1008) {
        const reason = message.error || message.message || message.code || 'upstream';
        state.voiceApiState = String(reason).includes('api_key') ? 'ElevenLabs auth invalid' : 'server TTS unavailable';
        voiceLog('TTS error: ' + reason, 'orange');
        browserSpeak(text);
        render(true);
      }
    });
    socket.addEventListener('error', () => { state.voiceApiState = 'server TTS unavailable'; voiceLog('TTS socket unavailable', 'orange'); browserSpeak(text); render(true); });
  } catch (error) {
    state.voiceApiState = 'server TTS unavailable';
    voiceLog('TTS error: ' + error.message, 'orange');
    browserSpeak(text);
  }
}
function base64ToBytes(value) {
  const binary = atob(value);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}
function recordDemoEvent(event, persist = false) {
  const session = state.voiceSession;
  if (!session || (event.sessionId && event.sessionId !== session.sessionId)) return;
  let batch = traceBatches.get(session.sessionId);
  if (!batch) {
    batch = { session, events: [], display: [], queue: Promise.resolve(), timer: null };
    traceBatches.set(session.sessionId, batch);
  }
  const traceEvent = { ...event, eventId: event.eventId || crypto.randomUUID(), ts: event.ts || new Date().toISOString() };
  batch.display.push(traceEvent);
  if (!persist) return;
  batch.events.push(traceEvent);
  batch.timer ??= window.setTimeout(() => flushDemoEvents(batch), 2500);
}

async function flushDemoEvents(batch) {
  if (!batch) return;
  window.clearTimeout(batch.timer);
  batch.timer = null;
  const pending = batch.events.splice(0);
  if (!pending.length) return batch.queue;
  let sent = 0;
  batch.queue = batch.queue.then(async () => {
    for (let index = 0; index < pending.length; index += 30) {
      const events = pending.slice(index, index + 30);
      const response = await fetch(voiceRuntimeEndpoint('/api/voice/session/' + encodeURIComponent(batch.session.sessionId) + '/event'), {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ traceId: batch.session.traceId, events }),
        signal: AbortSignal.timeout(8000)
      });
      if (!response.ok) throw new Error('TRACE_WRITE_HTTP_' + response.status);
      sent += events.length;
    }
    batch.error = null;
  }).catch((error) => {
    batch.events.unshift(...pending.slice(sent));
    batch.error = error.message;
  });
  return batch.queue;
}

async function finishVoiceCall(reason, update = true) {
  const session = state.voiceSession;
  const batch = session && traceBatches.get(session.sessionId);
  callAttempt += 1;
  window.clearInterval(state.voiceStatsTimer);
  state.voiceStatsTimer = null;
  state.voiceCallStatus = 'ended';
  state.voiceStatus = 'ended';
  demoCallEndedAt = Date.now();
  state.voiceLocalTrack?.stop();
  state.voiceLocalTrack = null;
  const room = state.voiceRoom;
  state.voiceRoom = null;
  document.querySelectorAll('[data-livekit-audio]').forEach((element) => {
    element.pause();
    element.srcObject = null;
    element.remove();
  });
  void room?.disconnect();
  state.voiceEventSocket?.close();
  state.voiceEventSocket = null;
  stopVoiceAnalyser();
  if (update) render(true);
  if (session) {
    await flushDemoEvents(batch);
    if (batch?.events.length) await flushDemoEvents(batch);
    try {
      const response = await fetch(voiceRuntimeEndpoint('/api/voice/end'), {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: session.sessionId, reason }), signal: AbortSignal.timeout(10000)
      });
      if (!response.ok) throw new Error('TRACE_END_HTTP_' + response.status);
    } catch (error) {
      if (update && state.voiceSession === session) voiceLog(error.message, 'orange');
    }
  }
  if (update && session && state.voiceSession === session) await loadSessionTrace();
  if (batch?.error && update && state.voiceSession === session) {
    state.voiceTraceStatus += ' · 有事件待同步';
    render(true);
  }
  if (session && !batch?.error) traceBatches.delete(session.sessionId);
}

function postRoomTraceEvent(event) {
  if (!voiceRuntimeUrl() || state.runtimeMode !== 'live' || !state.voiceSession?.sessionId || !event?.type) return Promise.resolve();
  const sessionId = state.voiceSession.sessionId;
  const traceId = state.voiceSession.traceId;
  const request = () => fetch(voiceRuntimeEndpoint('/api/voice/session/' + encodeURIComponent(sessionId) + '/event'), {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...event, traceId, sessionId })
  }).then((response) => {
    if (!response.ok) throw new Error('TRACE_WRITE_HTTP_' + response.status);
  });
  state.voiceTraceWriteQueue = state.voiceTraceWriteQueue
    .catch(() => {})
    .then(request)
    .catch(() => {});
  return state.voiceTraceWriteQueue;
}
async function loadSessionTrace() {
  if (!voiceRuntimeUrl() || !state.voiceSession?.sessionId) {
    state.voiceTraceStatus = 'unavailable';
    render(true);
    return;
  }
  state.voiceTraceStatus = 'loading';
  render(true);
  try {
    const sessionId = state.voiceSession.sessionId;
    const response = await fetch(voiceRuntimeEndpoint('/api/voice/session/' + encodeURIComponent(sessionId) + '/trace'), { signal: AbortSignal.timeout(10000) });
    if (sessionId !== state.voiceSession?.sessionId) return;
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || 'TRACE_HTTP_' + response.status);
    state.voiceTraceEvents = Array.isArray(payload.events) ? payload.events : [];
    state.voiceTraceStatus = isDemo() ? `已读取 ${state.voiceTraceEvents.length} 条 · ${payload.persistence || '服务端'}` : `loaded ${state.voiceTraceEvents.length}`;
  } catch (error) {
    state.voiceTraceStatus = `local ${state.voiceLogs.length} · server trace unavailable`;
    voiceLog('trace query failed: ' + error.message, 'orange');
  }
  render(true);
}
function traceEventLabel(event) {
  const value = event?.code || event?.text || event?.transcript || event?.reason || event?.label || '';
  return event?.type === 'ui' ? String(value || 'event').slice(0, 180) : [event?.type || 'event', value].filter(Boolean).join(' · ').slice(0, 180);
}
function traceEventTime(event) {
  if (!event?.ts) return '--:--:--';
  const parsed = Date.parse(event.ts);
  return Number.isNaN(parsed) ? String(event.ts).slice(0, 12) : new Date(parsed).toLocaleTimeString('zh-CN', { hour12: false });
}
function applyRuntimeEvent(event, source = 'runtime') {
  if (!event || typeof event !== 'object') return;
  if (isDemo()) {
    if (event.sessionId && event.sessionId !== state.voiceSession?.sessionId) return;
    if (source === 'runtime' && !['session_created', 'token_issued', 'ice_checking', 'call_answered'].includes(event.type)) return;
    recordDemoEvent(event, source === 'room');
    if (state.voiceCallStatus === 'ended') return;
    if (source === 'runtime' && state.voiceRoom) { render(true); return; }
    if (event.type === 'agent_joined') {
      agentConfirmed = true;
      activeModels = {
        fastModel: event.fastModel || event.agentModel || activeModels?.fastModel,
        slowModel: event.slowModel || activeModels?.slowModel,
        asrModel: event.asrModel || activeModels?.asrModel,
        ttsModel: event.ttsModel || activeModels?.ttsModel,
        voiceId: event.voiceId || activeModels?.voiceId,
        fastReasoningEffort: event.voiceConfig?.fastReasoningEffort || activeModels?.fastReasoningEffort,
        slowReasoningEffort: event.voiceConfig?.slowReasoningEffort || activeModels?.slowReasoningEffort,
        modelSource: event.modelSource || activeModels?.modelSource
      };
      state.voiceStep = Math.max(state.voiceStep, 1);
    }
    if (event.type === 'speech_started') {
      state.voiceLatency = { asr: null, intent: null, kb: null, slow: null, tts: null, e2e: null, interrupt: null };
      state.voiceQualityPath = '对话生成 → 并行核验';
    }
    if (event.type === 'final_transcript') state.voiceStep = Math.max(state.voiceStep, 2);
    if (event.type === 'knowledge_hit') {
      state.voiceStep = Math.max(state.voiceStep, 3);
      if (Number.isFinite(event.latencyMs)) state.voiceLatency.kb = event.latencyMs;
      if (event.source === 'grounded_fast_path') state.voiceQualityPath = '知识库直答';
    }
    if (event.type === 'tts_text' && state.voiceConversation.some((item) => item.role === 'user')) {
      state.voiceStep = Math.max(state.voiceStep, 4);
    }
    if (event.type === 'handoff') state.voiceStep = 5;
    if (event.type === 'ended') { void finishVoiceCall(event.reason || 'agent'); return; }
  } else if (source === 'room') postRoomTraceEvent(event);
  const labels = {
    session_created: 'session created', token_issued: 'short-lived token issued', ice_checking: 'ICE checking',
    room_joined: 'LiveKit room joined', agent_joined: 'agent joined', audio_track_ready: 'audio track ready',
    listening: 'agent listening', speech_started: 'speech started', speech_stopped: 'speech stopped',
    knowledge_hit: 'knowledge base hit', tool_call: 'tool called', tts_started: 'tts started', speaking: 'agent speaking',
    barge_in: 'barge-in detected', interrupted: 'response interrupted', reconnecting: 'reconnecting', ended: 'call ended', partial_transcript: 'ASR partial transcript', final_transcript: 'ASR final transcript', tts_text_delta: 'TTS streaming transcript', tts_text: 'TTS text committed', deep_started: 'slow lane started', deep_result: 'slow lane result ready', deep_result_used: 'slow lane result used', deep_error: 'slow lane fallback', emotion_detected: 'emotion detected', demographics_detected: 'demographics detected'
  };
  if (!['tts_first_byte', 'audio', 'tts_text_delta'].includes(event.type)) voiceLog((labels[event.type] || event.type) + (event.type === 'error' && event.code ? ': ' + String(event.code).slice(0, 96) : ''), event.type === 'error' ? 'orange' : 'cyan');
  if (event.type === 'error') {
    const code = String(event.code || event.message || 'runtime error');
    state.voiceStatus = 'error';
    state.voiceCallStatus = 'error';
    state.voiceApiState = code;
    if (!isDemo() && /429|quota|stt|speech|recogniz|agent_error/i.test(code)) {
      state.voiceAsrFallback = true;
      if (/stt|speech|recogniz/i.test(code)) state.voiceAsrModel = 'Web Speech API / Chrome fallback';
      state.voiceApiState = /429|quota|agent_error/i.test(code) ? 'server Agent unavailable → Chrome ASR + demo reply' : 'server ASR unavailable → Chrome fallback';
      window.setTimeout(() => startBrowserRecognition({ fallback: true }), 0);
    }
  }
  if (event.type === 'ringing') { state.voiceStatus = 'ringing'; state.voiceCallStatus = 'ringing'; }
  if (['dialing', 'ice_checking', 'connecting', 'room_joined'].includes(event.type)) { state.voiceStatus = 'connecting'; state.voiceCallStatus = 'connecting'; }
  if (event.type === 'agent_joined') { state.voiceStatus = 'connected'; state.voiceCallStatus = 'connected'; }
  if (['audio_track_ready', 'listening', 'speech_stopped'].includes(event.type)) { state.voiceStatus = 'connected'; state.voiceCallStatus = 'connected'; }
  if (event.type === 'speech_started' || event.type === 'partial_transcript') state.voiceStatus = 'listening';
  if (event.type === 'thinking' || event.type === 'tool_call') state.voiceStatus = 'thinking';
  if (event.type === 'deep_started') state.voiceSlowStatus = 'running';
  if (event.type === 'deep_result') { state.voiceSlowStatus = 'ready'; if (!isDemo()) state.voiceSlowModel = event.model || state.voiceSlowModel; if (state.voiceQualityPath !== '知识库直答') state.voiceQualityPath = event.trigger === 'partial' ? '提前检索 → 已核验' : '对话生成 → 并行核验'; }
  if (event.type === 'deep_result_used') { state.voiceSlowStatus = 'used'; state.voiceQualityPath = '对话生成 → 使用核验结果'; }
  if (event.type === 'deep_error') { state.voiceSlowStatus = 'fallback'; if (state.voiceQualityPath !== '知识库直答') state.voiceQualityPath = '切换演示规则'; }
  if (['speaking', 'tts_started'].includes(event.type)) state.voiceStatus = 'speaking';
  if (['barge_in', 'interrupted'].includes(event.type)) state.voiceStatus = 'interrupted';
  if (event.type === 'reconnecting') { state.voiceStatus = 'reconnecting'; state.voiceCallStatus = 'connecting'; }
  if (event.type === 'ended') { state.voiceStatus = 'ended'; state.voiceCallStatus = 'ended'; }
  if (event.ttfbMs != null) state.voiceLatency.tts = event.ttfbMs;
  const metrics = event.metrics || event.metric || event;
  for (const [key, target] of [['asrMs', 'asr'], ['llmMs', 'intent'], ['slowLlmMs', 'slow'], ['ttsTtfbMs', 'tts'], ['e2eMs', 'e2e']]) {
    if (metrics[key] != null) state.voiceLatency[target] = metrics[key];
  }
  for (const [key, target] of [['rtt', 'rtt'], ['jitter', 'jitter'], ['packetLoss', 'packetLoss'], ['interruptMs', 'interrupt']]) {
    if (metrics[key] != null) state.voiceMetrics[target] = metrics[key];
  }
  if (event.step != null) state.voiceStep = event.step;
  if (event.partial || event.type === 'partial_transcript') state.voicePartial = event.partial || event.transcript || event.text || '';
  if (event.type === 'final_transcript' && (event.transcript || event.text)) { state.voicePartial = ''; addConversationMessage(event.role || 'user', event.transcript || event.text, 'asr', { model: event.asrModel || state.voiceAsrModel }); }
  if (event.type === 'tts_started') state.voiceTtsPartial = '';
  if (event.type === 'tts_text_delta') { state.voiceTtsPartial = event.transcript || event.text || state.voiceTtsPartial; state.voiceTtsText = state.voiceTtsPartial; }
  if (event.type === 'tts_text' || event.type === 'tts_started') { state.voiceTtsText = event.text || event.transcript || state.voiceTtsText; state.voiceTtsPartial = state.voiceTtsText; }
  if (event.transcript && event.role && !['partial_transcript', 'final_transcript', 'tts_text_delta', 'tts_text'].includes(event.type)) addConversationMessage(event.role, event.transcript, 'runtime');
  if (event.type === 'tts_text' && (event.text || event.transcript)) addConversationMessage(event.role || 'assistant', event.text || event.transcript, 'tts', { model: event.ttsModel || state.voiceModel });
  if (event.insights) state.voiceInsights = { ...state.voiceInsights, ...event.insights };
  if (!isDemo()) {
    if (event.agentModel) state.voiceAgentModel = event.agentModel;
    if (event.fastModel) { state.voiceFastModel = event.fastModel; state.voiceAgentModel = event.fastModel; }
    if (event.slowModel) state.voiceSlowModel = event.slowModel;
    if (event.asrModel) state.voiceAsrModel = event.asrModel;
    if (event.ttsModel) state.voiceModel = event.ttsModel;
    if (event.modelSource) state.voiceModelSource = event.modelSource;
  }
  if (event.emotion) state.voiceInsights = { ...state.voiceInsights, emotion: event.emotion, confidence: event.confidence || state.voiceInsights.confidence };
  if (event.age || event.gender) state.voiceInsights = { ...state.voiceInsights, age: event.age || state.voiceInsights.age, gender: event.gender || state.voiceInsights.gender, confidence: event.confidence || state.voiceInsights.confidence };
  render(true);
}
function subscribeRuntimeEvents(sessionId) {
  if (!voiceRuntimeUrl() || !sessionId) return;
  if (state.voiceEventSocket) state.voiceEventSocket.close();
  const socket = new WebSocket(voiceRuntimeSocket('/api/voice/events?sessionId=' + encodeURIComponent(sessionId)));
  state.voiceEventSocket = socket;
  socket.addEventListener('message', (event) => { if (state.voiceEventSocket !== socket) return; try { applyRuntimeEvent(JSON.parse(event.data), 'runtime'); } catch {} });
  socket.addEventListener('error', () => voiceLog('event stream unavailable', 'orange'));
}
async function requestMicrophoneTrack() {
  let pending;
  try {
    pending = createLocalAudioTrack({ echoCancellation: true, noiseSuppression: state.voiceNoiseReduction, autoGainControl: true });
  } catch (error) {
    state.voiceApiState = 'microphone permission required';
    voiceLog('microphone permission unavailable: ' + (error?.message || 'denied'), 'orange');
    return null;
  }
  let timeoutId;
  let timedOut = false;
  pending.then((track) => { if (timedOut) track.stop(); }).catch(() => {});
  try {
    const track = await Promise.race([
      pending,
      new Promise((_, reject) => { timeoutId = window.setTimeout(() => { timedOut = true; reject(new Error('MIC_PERMISSION_TIMEOUT')); }, 20000); })
    ]);
    window.clearTimeout(timeoutId);
    state.voiceApiState = 'microphone permission granted';
    state.voiceAsrFallback = false;
    voiceLog('microphone permission granted', 'lime');
    return track;
  } catch (error) {
    window.clearTimeout(timeoutId);
    state.voiceApiState = 'microphone permission required';
    voiceLog('microphone permission unavailable: ' + (error?.message || 'denied'), 'orange');
    return null;
  }
}

async function ensureLiveMicrophone() {
  if (!state.voiceRoom || state.voiceCallStatus !== 'connected') return false;
  if (state.voiceLocalTrack) {
    try { await state.voiceLocalTrack.unmute(); } catch {}
    state.voiceMuted = false;
    state.voiceApiState = 'live microphone ready';
    voiceLog('live microphone ready', 'lime');
    render(true);
    return true;
  }
  state.voiceApiState = 'requesting microphone permission';
  voiceLog('requesting microphone permission', 'cyan');
  render(true);
  const track = await requestMicrophoneTrack();
  if (!track) { render(true); return false; }
  try {
    await state.voiceRoom.localParticipant.publishTrack(track);
    state.voiceLocalTrack = track;
    addVoiceAnalyserForTrack(track);
    state.voiceMuted = false;
    state.voiceApiState = 'live microphone ready';
    voiceLog('microphone track published', 'lime');
    render(true);
    return true;
  } catch (error) {
    track.stop();
    state.voiceApiState = 'microphone publish failed';
    voiceLog('microphone publish failed: ' + (error?.message || 'unknown'), 'orange');
    render(true);
    return false;
  }
}

async function toggleLiveMute() {
  if (!state.voiceLocalTrack) {
    state.voiceMuted = !state.voiceMuted;
    voiceLog(state.voiceMuted ? 'microphone muted' : 'microphone unmuted', 'cyan');
    render(true);
    return;
  }
  try {
    if (state.voiceLocalTrack.isMuted || state.voiceMuted) {
      await state.voiceLocalTrack.unmute();
      state.voiceMuted = false;
      state.voiceApiState = 'live microphone ready';
      voiceLog('microphone unmuted', 'cyan');
    } else {
      await state.voiceLocalTrack.mute();
      state.voiceMuted = true;
      state.voiceApiState = 'live microphone muted';
      voiceLog('microphone muted', 'cyan');
    }
  } catch (error) {
    voiceLog('microphone toggle failed: ' + (error?.message || 'unknown'), 'orange');
  }
  render(true);
}

async function connectLiveKit(session, preloadedTrack = null, attempt = callAttempt) {
  if (!session?.token || !session.room || !session.serverUrl) throw new Error('LIVEKIT_SESSION_INCOMPLETE');
  if (state.voiceRoom) state.voiceRoom.disconnect();
  const room = new Room({ adaptiveStream: true, dynacast: true });
  state.voiceRoom = room;
  room.on(RoomEvent.ConnectionStateChanged, (connectionState) => {
    if (state.voiceRoom !== room) return;
    voiceLog('LiveKit connection: ' + connectionState, connectionState === ConnectionState.Connected ? 'lime' : 'cyan');
    if (connectionState === ConnectionState.Connected && (!isDemo() || agentConfirmed)) {
      state.voiceCallStatus = 'connected';
      state.voiceStatus = 'connected';
    }
    if (connectionState === ConnectionState.Reconnecting) { state.voiceCallStatus = 'connecting'; state.voiceStatus = 'reconnecting'; }
    if (connectionState === ConnectionState.Disconnected && state.voiceCallStatus !== 'ended') { state.voiceCallStatus = 'error'; state.voiceStatus = 'error'; }
    render(true);
  });
  room.on(RoomEvent.TrackSubscribed, (track) => {
    if (state.voiceRoom === room && track.kind === 'audio') {
      const media = track.attach();
      media.setAttribute('data-livekit-audio', 'true');
      media.autoplay = true;
      media.volume = Number(state.voiceVolume);
      document.body.appendChild(media);
      addVoiceAnalyserForElement(media);
      voiceLog('remote audio track attached', 'lime');
    }
  });
  room.on(RoomEvent.TrackUnsubscribed, (track) => {
    if (track.kind === 'audio') {
      track.detach().forEach((element) => { removeVoiceAnalyserForElement(element); element.remove(); });
      voiceLog('remote audio track detached', 'quiet');
    }
  });
  room.on(RoomEvent.DataReceived, (payload, participant, _kind, topic) => {
    if (state.voiceRoom !== room || (isDemo() && (topic !== 'voice-agent.events' || !participant?.isAgent))) return;
    try { applyRuntimeEvent(JSON.parse(new TextDecoder().decode(payload)), 'room'); } catch {}
  });
  await room.connect(session.serverUrl, session.token);
  if (isDemo() && attempt !== callAttempt) { preloadedTrack?.stop(); await room.disconnect(); return; }
  if (isDemo()) demoCallStartedAt = Date.now();
  let localTrack = preloadedTrack;
  try {
    if (!localTrack && isDemo()) throw new Error('MIC_PERMISSION_REQUIRED');
    if (!localTrack) localTrack = await createLocalAudioTrack({ echoCancellation: true, noiseSuppression: state.voiceNoiseReduction, autoGainControl: true });
    await room.localParticipant.publishTrack(localTrack);
    state.voiceLocalTrack = localTrack;
    state.voiceMuted = false;
    state.voiceAsrFallback = false;
    state.voiceApiState = 'live microphone ready';
    addVoiceAnalyserForTrack(localTrack);
    voiceLog('microphone track published', 'lime');
  } catch (error) {
    // A browser can deny microphone permission while the LiveKit room and
    // remote Agent are already connected. Keep the session LIVE so receive
    // audio, ElevenLabs TTS and room telemetry remain usable. The mic button
    // stays available for a user-initiated retry.
    if (localTrack && state.voiceLocalTrack !== localTrack) localTrack.stop();
    if (isDemo()) throw error;
    voiceLog('microphone permission unavailable: ' + (error?.message || 'denied'), 'orange');
    state.voiceApiState = 'live session / microphone permission required';
  }
  if (!isDemo()) {
    state.voiceCallStatus = 'connected';
    state.voiceStatus = 'connected';
  }
  startLiveKitStats(room);
  render(true);
}

function startLiveKitStats(room) {
  if (state.voiceStatsTimer) window.clearInterval(state.voiceStatsTimer);
  const sample = async () => {
    const pcManager = room?.engine?.pcManager;
    if (!pcManager) return;
    try {
      const reports = await Promise.all([pcManager.publisher?.getStats?.(), pcManager.subscriber?.getStats?.()]);
      const stats = reports.filter(Boolean).flatMap((report) => [...report.values()]);
      const pairs = stats.filter((item) => item.type === 'candidate-pair' && (item.selected || item.nominated));
      const pair = pairs[0] || stats.find((item) => item.type === 'candidate-pair');
      const inbound = stats.filter((item) => item.type === 'inbound-rtp' && item.kind === 'audio');
      const outbound = stats.filter((item) => item.type === 'outbound-rtp' && item.kind === 'audio');
      const packetCount = inbound.reduce((sum, item) => sum + (item.packetsReceived || 0) + (item.packetsLost || 0), 0);
      const lost = inbound.reduce((sum, item) => sum + (item.packetsLost || 0), 0);
      const jitter = inbound.map((item) => item.jitter).filter((value) => Number.isFinite(value));
      const remoteRtt = outbound.map((item) => item.remoteRoundTripTime).filter((value) => Number.isFinite(value));
      const rtt = Number.isFinite(pair?.currentRoundTripTime) ? Math.round(pair.currentRoundTripTime * 1000) : (remoteRtt[0] ? Math.round(remoteRtt[0] * 1000) : null);
      const jitterMs = jitter.length ? Math.round(Math.max(...jitter) * 1000) : null;
      const loss = packetCount ? Number((lost / packetCount * 100).toFixed(2)) : null;
      if (rtt !== null) state.voiceMetrics.rtt = rtt;
      if (jitterMs !== null) state.voiceMetrics.jitter = jitterMs;
      if (loss !== null) state.voiceMetrics.packetLoss = loss;
      state.voiceApiState = 'live telemetry';
      render(true);
    } catch (error) {
      voiceLog('RTC stats unavailable: ' + error.message, 'orange');
    }
  };
  sample();
  state.voiceStatsTimer = window.setInterval(sample, 1500);
}
async function createRuntimeSession(mode, attempt = callAttempt) {
  const scenario = activeVoiceScenario();
  const response = await fetch(voiceRuntimeEndpoint('/api/voice/session'), {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(isDemo() ? { ...demoPreferences, scenario: scenario.id, direction: scenario.direction, runtimeMode: mode } : { scenario: scenario.id, direction: scenario.direction, language: state.voiceLanguage, voiceId: state.voiceVoice, agentModel: state.voiceFastModel || state.voiceAgentModel, fastModel: state.voiceFastModel || state.voiceAgentModel, slowModel: state.voiceSlowModel, asrModel: state.voiceAsrModel, ttsModel: state.voiceModel, runtimeMode: mode, voiceConfig: { interactionType: state.voiceInteractionType, vad: state.voiceVad, noiseReduction: state.voiceNoiseReduction, allowInterruption: state.voiceAllowInterruption, silenceStrategy: state.voiceSilenceStrategy, voiceprintRecognition: state.voiceVoiceprintRecognition, genderRecognition: state.voiceGenderRecognition, addresseeAwareFiltering: state.voiceAddresseeAwareFiltering, hangupStrategy: state.voiceHangupStrategy, startWithVoiceCall: state.voiceStartWithVoiceCall, userMessagePosition: state.voiceUserMessagePosition, sessionRelevanceRejection: state.voiceSessionRelevanceRejection, maxCallTime: state.voiceMaxCallTime, tone: state.voiceTone, emotion: state.voiceEmotion, pitch: state.voicePitch, volume: state.voiceVolume, stability: state.voiceStability, similarity: state.voiceSimilarity, style: state.voiceStyle, speed: state.voiceSpeed, outputFormat: state.voiceOutputFormat, chunkSchedule: state.voiceChunkSchedule, bargeIn: state.voiceBargeIn } })
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error || 'SESSION_HTTP_' + response.status);
  const session = payload.session || payload;
  if (attempt !== callAttempt) {
    void fetch(voiceRuntimeEndpoint('/api/voice/end'), {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: session.sessionId, reason: 'cancelled' })
    }).catch(() => {});
    throw new Error('CALL_CANCELLED');
  }
  state.voiceSession = session;
  if (isDemo()) {
    activeModels = { ...session, fastReasoningEffort: session.voiceConfig?.fastReasoningEffort, slowReasoningEffort: session.voiceConfig?.slowReasoningEffort };
  }
  state.runtimeMode = state.voiceSession.runtimeMode || mode;
  if (!isDemo() && state.runtimeMode === 'live') {
    if (state.voiceSession.agentModel) state.voiceAgentModel = state.voiceSession.agentModel;
    if (state.voiceSession.fastModel) state.voiceFastModel = state.voiceSession.fastModel;
    if (state.voiceSession.slowModel) state.voiceSlowModel = state.voiceSession.slowModel;
    if (state.voiceSession.asrModel) state.voiceAsrModel = state.voiceSession.asrModel;
    if (state.voiceSession.ttsModel) state.voiceModel = state.voiceSession.ttsModel;
  }
  state.voiceApiState = state.runtimeMode === 'live' ? 'live session' : 'sandbox / simulated';
  subscribeRuntimeEvents(state.voiceSession.sessionId);
  return state.voiceSession;
}
async function ensureOutboundSession() {
  if (isDemo() || activeVoiceScenario().direction !== 'outbound' || state.voiceSession || state.voiceOutboundInit || !voiceRuntimeUrl()) return;
  state.voiceOutboundInit = true;
  try {
    const session = await createRuntimeSession('live');
    state.voiceCallStatus = session.status || 'ringing';
    state.voiceStatus = 'ringing';
    render(true);
  } catch (error) {
    state.runtimeMode = 'sandbox';
    state.voiceApiState = 'sandbox / simulated';
    voiceLog('runtime unavailable: ' + error.message, 'orange');
    render(true);
  }
}
function processVoiceInput(text) {
  const value = String(text || '').trim();
  if (!value || state.voiceStatus === 'thinking') return;
  const scenario = activeVoiceScenario();
  state.voiceInput = '';
  state.voicePartial = value;
  state.voiceCallStatus = 'connected';
  addConversationMessage('user', value, state.runtimeMode === 'live' ? 'browser-asr-fallback' : 'text');
  state.voiceStatus = 'thinking';
  state.voiceStep = Math.max(1, state.voiceStep);
  state.voiceRound += 1;
  const attempt = callAttempt;
  const wasDemo = isDemo();
  state.voiceLatency.asr = state.runtimeMode === 'live' ? null : 240 + Math.min(180, value.length * 4);
  state.voiceLatency.intent = state.runtimeMode === 'live' ? null : 28 + (value.length % 19);
  state.voiceLatency.kb = state.runtimeMode === 'live' ? null : 20 + (scenario.id === 'airline' ? 12 : 6);
  state.voiceInsights = state.runtimeMode === 'live'
    ? { emotion: '等待服务端识别', age: '等待服务端识别', gender: '等待服务端识别', confidence: null }
    : { emotion: value.includes('断线') || value.includes('投诉') ? '焦虑 / frustrated' : '平静 / neutral', age: '30–39（模拟）', gender: '未判断（模拟）', confidence: 72 };
  voiceLog('user utterance received', 'cyan');
  voiceLog('intent classified: ' + scenario.id, 'cyan');
  render(true);
  window.setTimeout(() => {
    if (wasDemo && attempt !== callAttempt) return;
    state.voiceStep = Math.min(scenario.workflow.length, 4);
    addConversationMessage('assistant', scenario.reply, 'demo-reply', { model: state.voiceModel });
    state.voicePartial = '';
    state.voiceStatus = 'connected';
    voiceLog('knowledge base top hit returned', 'lime');
    voiceLog('response committed / handoff boundary checked', 'lime');
    render(true);
    if (voiceRuntimeUrl() && (!isDemo() || state.runtimeMode === 'live')) elevenLabsSpeak(scenario.reply);
    else { state.voiceApiState = 'sandbox / browser preview'; browserSpeak(scenario.reply); }
  }, 420);
}
function startBrowserRecognition({ fallback = false } = {}) {
  const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!Recognition) {
    state.voiceApiState = 'browser recognition unavailable';
    voiceLog('microphone API unavailable; use text input', 'orange');
    render(true);
    return;
  }
  if (state.voiceRecognitionActive) return;
  const recognition = new Recognition();
  state.voiceRecognition = recognition;
  state.voiceRecognitionActive = true;
  state.voiceAsrFallback = state.voiceAsrFallback || fallback;
  if (fallback) state.voiceAsrModel = 'Web Speech API / Chrome fallback';
  recognition.lang = state.voiceLanguage === 'en' ? 'en-US' : state.voiceLanguage === 'ar' ? 'ar-SA' : 'zh-CN';
  recognition.interimResults = true;
  recognition.continuous = false;
  recognition.maxAlternatives = 1;
  recognition.onstart = () => {
    if (state.voiceCallStatus === 'error') state.voiceCallStatus = 'connected';
    state.voiceStatus = 'listening';
    voiceLog(fallback ? 'Chrome ASR fallback listening' : 'microphone listening', 'cyan');
    render(true);
  };
  recognition.onresult = (event) => {
    let interim = '';
    let finalText = '';
    for (let index = event.resultIndex; index < event.results.length; index += 1) {
      const text = event.results[index][0].transcript;
      if (event.results[index].isFinal) finalText += text;
      else interim += text;
    }
    const transcript = interim || finalText;
    if (transcript) {
      state.voicePartial = transcript;
      state.voiceStatus = 'listening';
      render(true);
    }
    if (finalText) processVoiceInput(finalText);
  };
  recognition.onerror = (event) => {
    state.voiceRecognitionActive = false;
    if (state.voiceRecognition === recognition) state.voiceRecognition = null;
    state.voiceStatus = state.voiceCallStatus === 'connected' ? 'connected' : 'ready';
    state.voiceApiState = fallback ? 'Chrome ASR fallback error' : 'microphone error';
    voiceLog('microphone error: ' + event.error, 'orange');
    render(true);
  };
  recognition.onend = () => {
    state.voiceRecognitionActive = false;
    if (state.voiceRecognition === recognition) state.voiceRecognition = null;
    if (state.voiceStatus === 'listening') state.voiceStatus = 'connected';
    render(true);
  };
  try {
    recognition.start();
  } catch (error) {
    state.voiceRecognitionActive = false;
    state.voiceRecognition = null;
    state.voiceApiState = 'browser recognition unavailable';
    voiceLog('microphone start failed: ' + error.message, 'orange');
    render(true);
  }
}
async function startDemoCall(direction) {
  if (state.voiceRoom) await finishVoiceCall('redial', false);
  resetDemoCall();
  const attempt = ++callAttempt;
  state.voiceNoiseReduction = demoPreferences.voiceConfig.noiseReduction;
  state.voiceVolume = demoPreferences.voiceConfig.volume;
  state.voiceCallStatus = 'connecting';
  state.voiceStatus = 'connecting';
  state.runtimeMode = 'ready';
  state.voiceApiState = 'requesting microphone permission';
  const context = ensureVoiceAudioContext();
  if (context?.state === 'suspended') void context.resume().catch(() => {});
  voiceLog('requesting microphone permission', 'cyan');
  render(true);
  const track = await requestMicrophoneTrack();
  if (attempt !== callAttempt) { track?.stop(); return; }
  if (!track) {
    state.voiceCallStatus = 'error';
    state.voiceStatus = 'error';
    render(true);
    return;
  }
  try {
    const session = await createRuntimeSession('live', attempt);
    if (session.runtimeMode !== 'live') throw new Error('语音服务暂不可用');
    if (direction === 'outbound') {
      const response = await fetch(voiceRuntimeEndpoint('/api/voice/answer'), {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: session.sessionId }), signal: AbortSignal.timeout(10000)
      });
      if (!response.ok) throw new Error((await response.json()).error || 'ANSWER_FAILED');
    }
    if (attempt === callAttempt) await connectLiveKit(session, track, attempt);
    else track.stop();
  } catch (error) {
    track.stop();
    if (attempt !== callAttempt) return;
    if (state.voiceSession) await finishVoiceCall('connect_failed', false);
    state.voiceCallStatus = 'error';
    state.voiceStatus = 'error';
    state.voiceApiState = error.message;
    voiceLog(error.message, 'orange');
    render(true);
  }
}

function bindVoiceEvents() {
  document.querySelectorAll('[data-open-voice-settings]').forEach((button) => {
    button.addEventListener('click', () => settingsPanel.open(button));
  });
  document.querySelectorAll('[data-voice-panel]').forEach((button) => {
    button.addEventListener('click', () => {
      selectedMobilePanel = button.dataset.voicePanel;
      render(true);
    });
  });
  document.querySelectorAll('.detail-link-primary').forEach((link) => link.addEventListener('click', (event) => {
    event.preventDefault();
    const details = document.querySelector('#voice-details');
    if (details) {
      details.open = true;
      details.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }));
  const actionBar = document.querySelector('.call-actions');
  if (actionBar && !isDemo() && !voiceRuntimeUrl() && !actionBar.querySelector('[data-voice-mic]')) {
    const micButton = document.createElement('button');
    micButton.type = 'button';
    micButton.className = 'call-action voice-input';
    micButton.dataset.voiceMic = '';
    micButton.textContent = voiceRuntimeUrl() ? '启用麦克风' : '开始语音';
    micButton.disabled = state.voiceCallStatus !== 'connected';
    actionBar.insertBefore(micButton, actionBar.firstChild);
  }
  document.querySelectorAll('[data-voice-sample]').forEach((button) => button.addEventListener('click', () => {
    const input = document.querySelector('#voice-input');
    if (input) { input.value = button.dataset.voiceSample; state.voiceInput = input.value; input.focus(); }
  }));
  const input = document.querySelector('#voice-input');
  if (input) input.addEventListener('input', (event) => { state.voiceInput = event.target.value; });
  document.querySelector('[data-voice-sandbox]')?.addEventListener('click', () => {
    callAttempt += 1;
    resetDemoCall();
    state.runtimeMode = 'sandbox';
    state.voiceApiState = 'sandbox / simulated';
    state.voiceStatus = 'connected';
    state.voiceCallStatus = 'connected';
    voiceLog('模拟模式已启动', 'quiet');
    render(true);
    const entry = document.querySelector('.sandbox-entry');
    if (entry) entry.open = true;
  });
  const send = document.querySelector('[data-voice-send]');
  if (send) send.addEventListener('click', () => processVoiceInput(state.voiceInput));
  const connect = async () => {
    if (isDemo()) { await startDemoCall('inbound'); return; }
    state.voiceCallStatus = 'connecting';
    state.voiceStatus = 'connecting';
    state.voiceApiState = voiceRuntimeUrl() ? 'requesting server session' : 'sandbox / simulated';
    const audioContext = ensureVoiceAudioContext();
    if (audioContext?.state === 'suspended') await audioContext.resume().catch(() => {});
    let preloadedTrack = null;
    if (voiceRuntimeUrl() && activeVoiceScenario().direction === 'inbound') {
      state.voiceApiState = 'requesting microphone permission';
      voiceLog('requesting microphone permission', 'cyan');
      render(true);
      preloadedTrack = await requestMicrophoneTrack();
    }
    voiceLog('session created', 'cyan');
    render();
    if (voiceRuntimeUrl()) {
      try {
        const session = state.voiceSession || await createRuntimeSession('live');
        if (session.direction === 'outbound' && session.status === 'ringing') throw new Error('OUTBOUND_REQUIRES_ANSWER');
        if (session.runtimeMode === 'live') await connectLiveKit(session, preloadedTrack);
        else { if (preloadedTrack) preloadedTrack.stop(); state.voiceCallStatus = 'connecting'; state.voiceStatus = 'connecting'; }
        voiceLog('live session connected', 'lime');
        render();
        return;
      } catch (error) {
        if (error.message === 'OUTBOUND_REQUIRES_ANSWER') { state.voiceCallStatus = 'ringing'; state.voiceStatus = 'ringing'; render(); return; }
        if (preloadedTrack) { preloadedTrack.stop(); preloadedTrack = null; }
        state.runtimeMode = 'sandbox';
        state.voiceApiState = 'live unavailable → sandbox';
        voiceLog('live unavailable: ' + error.message, 'orange');
      }
    }
    window.setTimeout(() => {
      state.voiceCallStatus = 'connected';
      state.voiceStatus = 'connected';
      state.voiceStep = 1;
      voiceLog('webrtc connected (sandbox)', 'lime');
      render();
      if (voiceRuntimeUrl()) elevenLabsSpeak(activeVoiceScenario().welcome || activeVoiceScenario().reply);
      else browserSpeak(activeVoiceScenario().welcome || activeVoiceScenario().reply);
    }, 520);
  };
  const call = document.querySelector('[data-voice-call]');
  if (call) call.addEventListener('click', connect);
  const answer = document.querySelector('[data-voice-answer]');
  if (answer) answer.addEventListener('click', async () => {
    if (isDemo()) { await startDemoCall('outbound'); return; }
    state.voiceCallStatus = 'connecting';
    state.voiceStatus = 'connecting';
    const audioContext = ensureVoiceAudioContext();
    if (audioContext?.state === 'suspended') await audioContext.resume().catch(() => {});
    let preloadedTrack = null;
    if (voiceRuntimeUrl()) {
      state.voiceApiState = 'requesting microphone permission';
      voiceLog('requesting microphone permission', 'cyan');
      render(true);
      preloadedTrack = await requestMicrophoneTrack();
    }
    render();
    try {
      if (voiceRuntimeUrl() && state.voiceSession?.sessionId) {
        const response = await fetch(voiceRuntimeEndpoint('/api/voice/answer'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sessionId: state.voiceSession.sessionId }) });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error || 'ANSWER_FAILED');
        state.voiceSession = payload.session || state.voiceSession;
        if (state.voiceSession.runtimeMode === 'live') await connectLiveKit(state.voiceSession, preloadedTrack);
      } else {
        state.runtimeMode = 'sandbox';
        state.voiceApiState = 'sandbox / simulated';
        state.voiceCallStatus = 'connected';
        state.voiceStatus = 'connected';
        state.voiceStep = 1;
        voiceLog('outbound call answered (sandbox)', 'lime');
        if (voiceRuntimeUrl()) elevenLabsSpeak(activeVoiceScenario().welcome || activeVoiceScenario().reply);
        render();
      }
    } catch (error) {
      // The public Worker is edge distributed. If an outbound answer request
      // lands on a different instance before Durable KV is enabled, the
      // in-memory session lookup may return SESSION_NOT_FOUND. The LiveKit
      // token returned at ring time is still valid, so connect with that
      // already-issued session instead of silently downgrading the call.
      if (state.voiceSession?.runtimeMode === 'live' && state.voiceSession?.token) {
        try {
          await connectLiveKit(state.voiceSession, preloadedTrack);
          state.voiceCallStatus = 'connected';
          state.voiceStatus = 'connected';
          voiceLog('outbound answer connected with issued LiveKit token', 'lime');
          render();
          return;
        } catch (liveError) {
          voiceLog('outbound LiveKit answer failed: ' + liveError.message, 'orange');
        }
      }
      if (preloadedTrack) preloadedTrack.stop();
      state.runtimeMode = 'sandbox';
      state.voiceApiState = 'sandbox / simulated';
      voiceLog('answer fallback: ' + error.message, 'orange');
      state.voiceCallStatus = 'connected';
      state.voiceStatus = 'connected';
      render();
    }
  });
  const reject = document.querySelector('[data-voice-reject]');
  if (reject) reject.addEventListener('click', async () => { if (voiceRuntimeUrl() && state.voiceSession?.sessionId) await fetch(voiceRuntimeEndpoint('/api/voice/end'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sessionId: state.voiceSession.sessionId, reason: 'rejected' }) }).catch(() => {}); state.voiceCallStatus = 'ended'; state.voiceStatus = 'ended'; voiceLog('outbound call rejected', 'orange'); render(); });
  const mute = document.querySelector('[data-voice-mute]');
  if (mute) mute.addEventListener('click', () => toggleLiveMute());
  const mic = document.querySelector('[data-voice-mic]');
  if (mic) mic.addEventListener('click', () => voiceRuntimeUrl() && state.voiceRoom ? ensureLiveMicrophone() : startBrowserRecognition({ fallback: state.voiceAsrFallback }));
  const end = document.querySelector('[data-voice-end]');
  if (end) end.addEventListener('click', async () => {
    if (isDemo()) {
      if (state.runtimeMode === 'sandbox') window.speechSynthesis?.cancel();
      await finishVoiceCall('user');
      return;
    }
    if (state.voiceStatsTimer) { window.clearInterval(state.voiceStatsTimer); state.voiceStatsTimer = null; }
    if (state.voiceLocalTrack) { state.voiceLocalTrack.stop(); state.voiceLocalTrack = null; }
    if (state.voiceRoom) { state.voiceRoom.disconnect(); state.voiceRoom = null; }
    stopVoiceAnalyser();
    if (state.voiceEventSocket) { state.voiceEventSocket.close(); state.voiceEventSocket = null; }
    if (voiceRuntimeUrl() && state.voiceSession?.sessionId) {
      await state.voiceTraceWriteQueue.catch(() => {});
      await fetch(voiceRuntimeEndpoint('/api/voice/end'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sessionId: state.voiceSession.sessionId, reason: 'user' }) }).catch(() => {});
    }
    state.voiceCallStatus = 'ended';
    state.voiceStatus = 'ended';
    voiceLog('call ended by user', 'orange');
    render();
    await loadSessionTrace();
  });
  const speak = document.querySelector('[data-voice-speak]');
  if (speak) speak.addEventListener('click', () => { const last = [...state.voiceMessages].reverse().find((item) => item.role === 'assistant'); if (last) elevenLabsSpeak(last.text); });
  const captions = document.querySelector('[data-voice-captions]');
  if (captions) captions.addEventListener('click', () => { state.voiceSubtitleVisible = !state.voiceSubtitleVisible; render(true); });
  document.querySelectorAll('[data-voice-interaction-type]').forEach((el) => el.addEventListener('change', (event) => { state.voiceInteractionType = event.target.value; }));
  document.querySelectorAll('[data-voice-language]').forEach((el) => el.addEventListener('change', (event) => { state.voiceLanguage = event.target.value; }));
  document.querySelectorAll('[data-voice-voice]').forEach((el) => el.addEventListener('change', (event) => { state.voiceVoice = event.target.value; }));
  document.querySelectorAll('[data-voice-model]').forEach((el) => el.addEventListener('change', (event) => { state.voiceModel = event.target.value; }));
  document.querySelectorAll('[data-voice-fast-model]').forEach((el) => el.addEventListener('change', (event) => { state.voiceFastModel = event.target.value; state.voiceAgentModel = event.target.value; }));
  document.querySelectorAll('[data-voice-slow-model]').forEach((el) => el.addEventListener('change', (event) => { state.voiceSlowModel = event.target.value; }));
  document.querySelectorAll('[data-voice-agent-model]').forEach((el) => el.addEventListener('change', (event) => { state.voiceAgentModel = event.target.value; state.voiceFastModel = event.target.value; }));
  document.querySelectorAll('[data-voice-asr-model]').forEach((el) => el.addEventListener('change', (event) => { state.voiceAsrModel = event.target.value; }));
  document.querySelectorAll('[data-voice-output-format]').forEach((el) => el.addEventListener('change', (event) => { state.voiceOutputFormat = event.target.value; }));
  document.querySelectorAll('[data-voice-chunk-schedule]').forEach((el) => el.addEventListener('input', (event) => { state.voiceChunkSchedule = event.target.value.replace(/[^0-9,]/g, ''); }));
  document.querySelectorAll('[data-voice-barge-in]').forEach((el) => el.addEventListener('change', (event) => { state.voiceBargeIn = event.target.value; }));
  document.querySelectorAll('[data-voice-tone]').forEach((el) => el.addEventListener('change', (event) => { state.voiceTone = event.target.value; }));
  document.querySelectorAll('[data-voice-emotion]').forEach((el) => el.addEventListener('change', (event) => { state.voiceEmotion = event.target.value; }));
  document.querySelectorAll('[data-voice-vad]').forEach((el) => el.addEventListener('change', (event) => { state.voiceVad = event.target.value; }));
  document.querySelectorAll('[data-voice-noise]').forEach((el) => el.addEventListener('change', (event) => { state.voiceNoiseReduction = event.target.checked; }));
  document.querySelectorAll('[data-voice-interruption]').forEach((el) => el.addEventListener('change', (event) => { state.voiceAllowInterruption = event.target.checked; }));
  document.querySelectorAll('[data-voice-silence]').forEach((el) => el.addEventListener('change', (event) => { state.voiceSilenceStrategy = event.target.checked; }));
  document.querySelectorAll('[data-voice-voiceprint]').forEach((el) => el.addEventListener('change', (event) => { state.voiceVoiceprintRecognition = event.target.checked; }));
  document.querySelectorAll('[data-voice-gender]').forEach((el) => el.addEventListener('change', (event) => { state.voiceGenderRecognition = event.target.checked; }));
  document.querySelectorAll('[data-voice-addressee]').forEach((el) => el.addEventListener('change', (event) => { state.voiceAddresseeAwareFiltering = event.target.checked; }));
  document.querySelectorAll('[data-voice-hangup]').forEach((el) => el.addEventListener('change', (event) => { state.voiceHangupStrategy = event.target.checked; }));
  document.querySelectorAll('[data-voice-start-call]').forEach((el) => el.addEventListener('change', (event) => { state.voiceStartWithVoiceCall = event.target.checked; }));
  document.querySelectorAll('[data-voice-message-position]').forEach((el) => el.addEventListener('change', (event) => { state.voiceUserMessagePosition = event.target.value; }));
  document.querySelectorAll('[data-voice-relevance]').forEach((el) => el.addEventListener('change', (event) => { state.voiceSessionRelevanceRejection = event.target.checked; }));
  document.querySelectorAll('[data-voice-max-time]').forEach((el) => el.addEventListener('change', (event) => { state.voiceMaxCallTime = Math.max(30, Math.min(7200, Number(event.target.value) || 1800)); }));
  const traceLoad = document.querySelector('[data-voice-trace-load]');
  if (traceLoad) traceLoad.addEventListener('click', () => loadSessionTrace());
  const logQuery = document.querySelector('[data-voice-log-query]');
  if (logQuery) {
    logQuery.addEventListener('input', (event) => { state.voiceLogQuery = event.target.value; });
    logQuery.addEventListener('keydown', (event) => { if (event.key === 'Enter') render(true); });
  }
  const logScope = document.querySelector('[data-voice-log-scope]');
  if (logScope) logScope.addEventListener('change', (event) => { state.voiceLogScope = event.target.value; render(true); });
  const previewText = document.querySelector('[data-voice-preview-text]');
  if (previewText) previewText.addEventListener('input', (event) => { state.voicePreviewText = event.target.value; });
  const preview = document.querySelector('[data-voice-preview]');
  if (preview) preview.addEventListener('click', () => elevenLabsSpeak(state.voicePreviewText || activeVoiceScenario().welcome || activeVoiceScenario().reply));
  const sliderMap = [['[data-voice-stability]', 'voiceStability', 'stability'], ['[data-voice-similarity]', 'voiceSimilarity', 'similarity'], ['[data-voice-style]', 'voiceStyle', 'style'], ['[data-voice-speed]', 'voiceSpeed', 'speed'], ['[data-voice-pitch]', 'voicePitch', 'pitch'], ['[data-voice-volume]', 'voiceVolume', 'volume']];
  sliderMap.forEach(([selector, key, output]) => { const el = document.querySelector(selector); if (el) el.addEventListener('input', (event) => { state[key] = event.target.value; const target = document.querySelector('[data-output="' + output + '"]'); if (target) target.textContent = event.target.value; if (key === 'voiceVolume') { document.querySelectorAll('[data-livekit-audio]').forEach((audio) => { audio.volume = Number(state.voiceVolume); }); if (state.voiceAudio) state.voiceAudio.volume = Number(state.voiceVolume); } if (key === 'voicePitch' && state.voiceAudio) state.voiceAudio.playbackRate = Number(state.voicePitch); }); });
  ensureOutboundSession();
}

function bindAppCards() {
  document.querySelectorAll('[data-app-route]').forEach((card) => {
    const open = () => {
      const route = card.dataset.appRoute;
      if (route.startsWith('#')) window.location.hash = route.slice(1);
      else window.open(route, '_blank', 'noopener,noreferrer');
    };
    card.addEventListener('click', (event) => { if (!event.target.closest('a,button')) open(); });
  });
}
function render(preserveScroll = false) {
  const previousScrollY = window.scrollY;
  const rawHash = window.location.hash.replace(/^#\/?/, '');
  const hashParts = rawHash.split('?');
  const hash = hashParts[0];
  const query = new URLSearchParams(hashParts[1] || '');
  const segments = hash.split('/').filter(Boolean);
  activePage = segments[0] === 'apps' ? 'projects' : segments[0] || '';
  const nextDemo = segments[0] === 'apps' && segments[1] === 'voice';
  const scenario = voiceScenarios.find((item) => item.id === query.get('scenario'))?.id || 'carrier';
  if (nextDemo !== demoRoute || (nextDemo && scenario !== state.voiceScenario)) {
    if (demoRoute && state.runtimeMode === 'sandbox') window.speechSynthesis?.cancel();
    settingsPanel.close();
    callAttempt += 1;
    if (state.voiceSession && state.voiceCallStatus !== 'ended') void finishVoiceCall('navigation', false);
    resetDemoCall();
    state.runtimeMode = nextDemo ? 'ready' : 'sandbox';
    if (!nextDemo) state.voiceApiState = 'sandbox / simulated';
    selectedMobilePanel = 'call';
  }
  demoRoute = nextDemo;
  document.body.classList.toggle('voice-demo-route', demoRoute);
  document.body.classList.toggle('mission-control-route', !demoRoute);
  const previousFocused = isDemo() && preserveScroll && app.contains(document.activeElement)
    ? [...document.activeElement.attributes].find((attr) => attr.name.startsWith('data-voice-') || attr.name === 'data-open-voice-settings')
    : null;
  const detailSelector = 'details[data-detail-key]';
  const detailStates = isDemo() && preserveScroll
    ? new Map([...app.querySelectorAll(detailSelector)].map((detail) => [detail.dataset.detailKey, detail.open])) : new Map();
  const panels = ['.voice-context-panel', '.voice-observe-panel', '.voice-transcript', '.conversation-thread'];
  const scrolls = isDemo() && preserveScroll ? panels.map((selector) => app.querySelector(selector)?.scrollTop || 0) : [];
  if (!segments.length) app.innerHTML = homeView();
  else if (segments[0] === 'apps' && segments[1] === 'voice') app.innerHTML = voiceScenarioView(scenario);
  else if (segments[0] === 'apps') app.innerHTML = appsView();
  else if (segments[0] === 'about' && segments.length === 1) app.innerHTML = aboutView();
  else if (segments[0] === 'projects' && segments.length <= 2) app.innerHTML = projectsView(segments[1]);
  else if (segments[0] === 'method' && segments.length === 1) app.innerHTML = methodView();
  else if (segments[0] === 'contact' && segments.length === 1) app.innerHTML = contactView();
  else app.innerHTML = notFoundView();
  if (isDemo() && preserveScroll) {
    app.querySelectorAll(detailSelector).forEach((detail) => {
      const open = detailStates.get(detail.dataset.detailKey);
      if (open !== undefined) detail.open = open;
    });
    panels.forEach((selector, index) => {
      const panel = app.querySelector(selector);
      if (panel && scrolls[index]) panel.scrollTop = scrolls[index];
    });
    if (previousFocused) app.querySelector('[' + previousFocused.name + '="' + CSS.escape(previousFocused.value) + '"]')?.focus({ preventScroll: true });
  }
  if (isDemo()) bindVoiceEvents();
  bindAppCards();
  window.scrollTo({ top: preserveScroll ? previousScrollY : 0, behavior: 'instant' });
}
window.addEventListener('hashchange', () => render());
render();

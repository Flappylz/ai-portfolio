import './styles.css';
import { apps, voiceScenarios } from './data/projects.js';
import { ConnectionState, Room, RoomEvent, createLocalAudioTrack } from 'livekit-client';

const app = document.querySelector('#app');
const githubUrl = 'https://github.com/Flappylz';
const email = '760871196@qq.com';

const state = { modeId: 'discovery', status: 'draft', score: 0, input: '', response: '', deliveryChecks: [], deliverySummary: '', voiceScenario: 'carrier', voiceInput: '', voiceStatus: 'sandbox', voiceCallStatus: 'idle', voiceMuted: false, voiceSubtitleVisible: true, voiceStep: 0, voiceMessages: [], voiceConversation: [], voiceLogs: [], voiceLogQuery: '', voiceLogScope: 'all', voiceTraceStatus: 'not loaded', voiceTraceEvents: [], voiceRound: 0, voiceLanguage: 'zh', voiceVoice: 'default', voiceModel: 'eleven_flash_v2_5', voiceAgentModel: 'openai/gpt-4.1-mini', voiceFastModel: 'openai/gpt-4.1-mini', voiceSlowModel: 'openai/gpt-5.6-sol', voiceSlowStatus: 'idle', voiceQualityPath: 'fast voice → slow validation', voiceAsrModel: 'Web Speech API / Chrome sandbox', voiceAsrFallback: false, voiceRecognition: null, voiceRecognitionActive: false, voiceVad: 'silero_vad', voiceNoiseReduction: true, voiceAllowInterruption: true, voiceSilenceStrategy: false, voiceHangupStrategy: false, voiceStartWithVoiceCall: false, voiceUserMessagePosition: 'right', voiceSessionRelevanceRejection: false, voiceMaxCallTime: 1800, voiceTone: 'neutral', voicePitch: 1, voiceEmotion: 'neutral', voiceStability: 0.5, voiceSimilarity: 0.75, voiceStyle: 0.2, voiceSpeed: 1, voiceOutputFormat: 'mp3_44100_128', voiceChunkSchedule: '50,120,160,290', voiceBargeIn: 'server_vad', voicePartial: '', voiceTtsText: '', voiceTtsPartial: '', voiceAmplitude: 0, voiceAudioContext: null, voiceAnalyserSources: [], voiceWaveFrame: null, voiceInsights: { emotion: '待识别', age: '待识别', gender: '待识别', confidence: null }, runtimeMode: 'sandbox', voiceApiState: 'sandbox / simulated', voiceLatency: { asr: null, intent: null, kb: null, slow: null, tts: null, e2e: null, interrupt: null }, voiceMetrics: { rtt: null, jitter: null, packetLoss: null, interrupt: null }, voiceSession: null, voiceRoom: null, voiceLocalTrack: null, voiceEventSocket: null, voiceTtsSocket: null, voiceAudio: null, voiceStatsTimer: null, voiceOutboundInit: false, events: [
  { time: '09:41:03', label: 'workspace initialized', tone: 'quiet' },
  { time: '09:41:11', label: 'agent schema loaded', tone: 'cyan' }
] };

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

function header() {
  return '<header class="site-header"><a class="brand" href="#/" aria-label="返回交互式AI语音DEMO"><span class="brand-mark"><i></i><i></i></span><span><strong>交互式AI语音DEMO</strong><small>LIVE VOICE WORKBENCH</small></span></a><nav class="site-nav" aria-label="主导航"><a class="nav-apps" href="#/apps">Demo</a>' + extLink(githubUrl, 'GitHub', 'nav-external') + '<a class="nav-cta" href="mailto:' + email + '">联系我</a></nav></header>';
}
function footer() {
  return '<footer class="site-footer"><div class="footer-brand"><span class="brand-mark"><i></i><i></i></span><div><strong>交互式AI语音DEMO</strong><p>实时语音、Agent 工作流和交付级观测。</p></div></div><div class="footer-links">' + extLink(githubUrl, 'GitHub') + '<a href="mailto:' + email + '">' + email + '</a><span>© 2026</span></div></footer>';
}
function shell(content) { return header() + '<main>' + content + '</main>' + footer(); }
function appCard(app) {
  const action = app.route
    ? '<a class="app-open" href="' + app.route + '">打开应用 <span>↗</span></a>'
    : '<a class="app-open" href="' + esc(app.url) + '" target="_blank" rel="noreferrer">打开公开 Demo <span>↗</span></a>';
  return '<article class="app-card app-' + app.accent + '" data-app-route="' + esc(app.route || app.url) + '" tabindex="0"><div class="app-card-art"><span>' + app.number + '</span><b>' + app.id.toUpperCase() + '</b><i></i><i></i><i></i></div><div class="app-card-body"><div class="app-card-head"><span class="app-status">' + app.label + '</span><span class="app-type">APP</span></div><h3>' + app.title + '</h3><p>' + app.description + '</p><div class="app-tags">' + app.tags.map((tag) => '<span>' + tag + '</span>').join('') + '</div>' + action + '</div></article>';
}
function appLauncher() {
  return '<section class="app-launcher section-pad" id="apps"><div class="launcher-head"><div><span class="section-label">VOICE APPLICATIONS / 3 LIVE PRODUCTS</span><h1>选择一个场景，直接开始通话。</h1></div><p>三个真实业务场景，进入后直接体验语音通话。</p></div><div class="app-grid">' + apps.map(appCard).join('') + '</div></section>';
}
function homeView() {
  return voiceScenarioView('carrier');
}
function appsView() {
  return voiceScenarioView('carrier');
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
  state.voiceScenario = id; state.voiceInput = ''; state.voiceStatus = next.direction === 'outbound' ? 'ringing' : 'idle'; state.voiceCallStatus = next.direction === 'outbound' ? 'ringing' : 'idle'; state.voiceStep = 0; state.voiceMessages = []; state.voiceConversation = []; state.voiceLogs = []; state.voiceLogQuery = ''; state.voiceLogScope = 'all'; state.voiceTraceStatus = 'not loaded'; state.voiceTraceEvents = []; state.voiceRound = 0; state.voiceApiState = 'sandbox / simulated'; state.voicePartial = ''; state.voiceTtsText = ''; state.voiceTtsPartial = ''; state.voiceAsrFallback = false; state.voiceRecognition = null; state.voiceRecognitionActive = false; state.voiceInsights = { emotion: '待识别', age: '待识别', gender: '待识别', confidence: null }; state.voiceLatency = { asr: null, intent: null, kb: null, slow: null, tts: null, e2e: null, interrupt: null }; state.voiceMetrics = { rtt: null, jitter: null, packetLoss: null, interrupt: null }; state.voiceSlowStatus = 'idle'; state.voiceQualityPath = 'fast voice → slow validation'; state.voiceSession = null; state.voiceRoom = null; state.voiceEventSocket = null; state.voiceStatsTimer = null; state.voiceOutboundInit = false;
}
function voiceScenarioView(id) {
  resetVoiceState(id);
  const scenario = activeVoiceScenario();
  const messages = state.voiceConversation.length ? state.voiceConversation.map((item) => '<div class="voice-message ' + item.role + '"><span>' + (item.role === 'user' ? 'YOU' : 'AGENT') + '<small>' + esc(item.time) + '</small></span><p>' + esc(item.text) + '</p></div>').join('') : '<div class="voice-empty">' + (scenario.direction === 'outbound' ? '接听后，Agent 会主动开始提问。' : '拨号后，Agent 会先播放欢迎语。') + '</div>';
  const logs = state.voiceLogs.slice(-6).reverse().map((item) => '<li><time>' + item.time + '</time><b class="event-dot ' + item.tone + '"></b><span>' + item.label + '</span></li>').join('');
  const steps = scenario.workflow.map((step, index) => '<div class="voice-step ' + (state.voiceStep >= index + 1 ? 'active' : '') + '"><b>0' + (index + 1) + '</b><span>' + step + '</span></div>').join('');
  const knowledge = scenario.knowledge.map((item) => '<li><div><b>' + item[0] + '</b><small>' + item[1] + '</small></div><em>' + item[2] + '</em></li>').join('');
  const metric = (value, unit) => value === null ? '<b class="metric-null">—</b>' : '<b>' + value + '<small>' + unit + '</small></b>';
  const sessionLabel = state.voiceSession?.sessionId ? state.voiceSession.sessionId.slice(0, 14) : 'not started';
  const insightCards = [['情绪', state.voiceInsights.emotion, 'emotion'], ['年龄', state.voiceInsights.age, 'age'], ['性别', state.voiceInsights.gender, 'gender']].map((item) => '<div class="insight-card"><span>' + item[0] + '</span><b>' + esc(item[1]) + '</b><small>' + (state.voiceInsights.confidence ? state.voiceInsights.confidence + '% confidence' : 'SANDBOX / DEMO') + '</small></div>').join('');
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
  const sequenceDiagram = '<div class="sequence-block"><div class="sequence-block-head"><div><span class="section-label">DETAILED SEQUENCE</span><h3>一通电话如何跑完。</h3></div><span>trace-first / event-driven</span></div><div class="sequence-lanes"><span>STEP</span><span>EVENT</span><span>FROM</span><span>TO</span><span>EVIDENCE</span></div>' + sequenceRows.map((row) => '<div class="sequence-row"><b>' + row[0] + '</b><strong>' + row[1] + '</strong><span>' + row[2] + '</span><i>→</i><span>' + row[3] + '</span><small>' + row[4] + '</small></div>').join('') + '</div>';
  const detailPages = '<section class="voice-detail-pages" id="voice-details"><article class="voice-detail-page"><div><span class="section-label">SYSTEM ARCHITECTURE / ' + scenario.title + '</span><h2>从通话到可交付的实时链路。</h2><p>下滑查看当前 Demo 的完整链路。首屏负责体验，下面负责证明系统如何工作。</p></div><div class="detail-flow">' + architecture.map((item, index) => '<div><b>0' + (index + 1) + '</b><span>' + item + '</span></div>').join('<i>→</i>') + '</div>' + sequenceDiagram + '<div class="detail-evidence-grid"><div><span>AGENT</span><b>' + esc(state.voiceAgentModel) + '</b><small>当前对话模型</small></div><div><span>ASR</span><b>' + esc(state.voiceAsrModel) + '</b><small>当前转写模型</small></div><div><span>TTS</span><b>' + esc(state.voiceModel) + '</b><small>ElevenLabs 流式模型</small></div><div><span>TRANSPORT</span><b>LiveKit WebRTC</b><small>WebSocket TTS fallback</small></div><div><span>STATUS</span><b>' + state.voiceCallStatus.toUpperCase() + '</b><small>' + state.runtimeMode.toUpperCase() + '</small></div><div><span>TRACE</span><b>' + esc(state.voiceSession?.traceId || sessionLabel) + '</b><small>事件可追溯</small></div></div></article><article class="voice-detail-page"><div><span class="section-label">KNOWLEDGE + BUSINESS FLOW</span><h2>业务流程和知识命中放在同一页。</h2></div><div class="detail-two-col"><div><h3>业务流程</h3><ol class="business-flow">' + scenario.workflow.map((item, index) => '<li><b>0' + (index + 1) + '</b><span>' + item + '</span></li>').join('') + '</ol></div><div><h3>知识库</h3><ul class="detail-knowledge">' + knowledge + '</ul></div></div><div class="detail-boundary"><span>BOUNDARY</span><p>公开数据为模拟场景；真实票价、套餐、库存、客户资料和生产权限不会进入前端。失败时保留已确认信息，并进入文本降级或人工转接。</p></div></article></section>';
  const latestMessage = [...state.voiceMessages].reverse()[0];
  const liveCaptionText = state.voicePartial || state.voiceTtsPartial || state.voiceTtsText || latestMessage?.text || '';
  const liveCaptionRole = state.voicePartial ? 'YOU · ASR PARTIAL' : (state.voiceTtsPartial || state.voiceTtsText || latestMessage?.role === 'assistant' ? 'AGENT · LIVE CAPTION' : 'LIVE CAPTION');
  const liveCaption = state.voiceSubtitleVisible ? '<div class="live-subtitle ' + (liveCaptionText ? 'has-text' : 'placeholder') + '"><span>' + liveCaptionRole + '</span><p>' + esc(liveCaptionText || '说话时，实时字幕会显示在这里') + '</p></div>' : '';
  const transcriptPanel = state.voiceSubtitleVisible ? '<div class="voice-transcript"><div class="transcript-head"><span>ASR / TTS TRANSCRIPT · ' + state.voiceConversation.length + ' TURNS</span><b>' + state.voiceCallStatus.toUpperCase() + '</b></div><div class="transcript-layer partial"><span>ASR PARTIAL / LIVE</span><p>' + esc(state.voicePartial || '等待用户说话…') + '</p></div><div class="conversation-thread" aria-live="polite">' + messages + '</div><div class="transcript-layer tts"><span>TTS PLAYBACK / LIVE</span><p>' + esc(state.voiceTtsPartial || state.voiceTtsText || '等待 Agent 播报…') + '</p></div></div>' : '<div class="subtitle-hidden">字幕已隐藏。你仍可以在右侧日志与指标面板查看事件。</div>';
  const agentAvatar = '<div class="agent-identity"><div class="agent-avatar ' + scenario.accent + '">' + scenario.title.slice(0, 1) + '</div><div><b>' + esc(scenario.agentName || scenario.title) + '</b><small>' + esc(scenario.agentRole || 'Voice Agent') + '</small></div></div>';
  const baseSettings = '<div class="settings-grid"><div class="setting-group"><label>Language<select data-voice-language><option value="zh" ' + (state.voiceLanguage === 'zh' ? 'selected' : '') + '>中文 / zh</option><option value="en" ' + (state.voiceLanguage === 'en' ? 'selected' : '') + '>English / en</option><option value="ar" ' + (state.voiceLanguage === 'ar' ? 'selected' : '') + '>العربية / ar</option></select></label><label>Voice<select data-voice-voice><option value="default" ' + (state.voiceVoice === 'default' ? 'selected' : '') + '>Server default</option><option value="JBFqnCBsd6RMkjVDRZzb" ' + (state.voiceVoice === 'JBFqnCBsd6RMkjVDRZzb' ? 'selected' : '') + '>George · neutral</option><option value="21m00Tcm4TlvDq8ikWAM" ' + (state.voiceVoice === '21m00Tcm4TlvDq8ikWAM' ? 'selected' : '') + '>Rachel · clear</option></select></label><label>TTS model<select data-voice-model><option value="eleven_flash_v2_5" ' + (state.voiceModel === 'eleven_flash_v2_5' ? 'selected' : '') + '>eleven_flash_v2_5</option><option value="eleven_v4_turbo" ' + (state.voiceModel === 'eleven_v4_turbo' ? 'selected' : '') + '>eleven_v4_turbo</option></select></label><label>Fast model<select data-voice-fast-model><option value="openai/gpt-4.1-mini" ' + (state.voiceFastModel === 'openai/gpt-4.1-mini' ? 'selected' : '') + '>gpt-4.1-mini · 快</option><option value="openai/gpt-5.6-luna" ' + (state.voiceFastModel === 'openai/gpt-5.6-luna' ? 'selected' : '') + '>gpt-5.6-luna · 快</option><option value="openai/gpt-5.6-sol" ' + (state.voiceFastModel === 'openai/gpt-5.6-sol' ? 'selected' : '') + '>gpt-5.6-sol · 质量</option></select></label><label>Slow model<select data-voice-slow-model><option value="openai/gpt-5.6-sol" ' + (state.voiceSlowModel === 'openai/gpt-5.6-sol' ? 'selected' : '') + '>gpt-5.6-sol · 慢思考</option><option value="openai/gpt-5.6-terra" ' + (state.voiceSlowModel === 'openai/gpt-5.6-terra' ? 'selected' : '') + '>gpt-5.6-terra · 深度</option><option value="openai/gpt-4.1" ' + (state.voiceSlowModel === 'openai/gpt-4.1' ? 'selected' : '') + '>gpt-4.1 · 稳定</option></select></label><label>ASR model<select data-voice-asr-model><option value="Web Speech API / Chrome sandbox" ' + (state.voiceAsrModel === 'Web Speech API / Chrome sandbox' ? 'selected' : '') + '>Web Speech API · sandbox</option><option value="openai/gpt-live-transcribe" ' + (state.voiceAsrModel === 'openai/gpt-live-transcribe' ? 'selected' : '') + '>gpt-live-transcribe · server</option><option value="openai/gpt-4o-transcribe" ' + (state.voiceAsrModel === 'openai/gpt-4o-transcribe' ? 'selected' : '') + '>gpt-4o-transcribe · server</option></select></label><label>Tone<select data-voice-tone><option value="neutral">中性</option><option value="warm">温暖</option><option value="professional">专业</option><option value="energetic">活跃</option></select></label></div><div class="setting-group setting-sliders"><label>Pitch <output data-output="pitch">' + state.voicePitch + '</output><input type="range" min="0.8" max="1.2" step="0.05" value="' + state.voicePitch + '" data-voice-pitch></label><label>Emotion <select data-voice-emotion><option value="neutral">中性</option><option value="calm">平静</option><option value="happy">积极</option><option value="empathetic">共情</option></select></label><label>Stability <output data-output="stability">' + state.voiceStability + '</output><input type="range" min="0" max="1" step="0.05" value="' + state.voiceStability + '" data-voice-stability></label><label>Similarity <output data-output="similarity">' + state.voiceSimilarity + '</output><input type="range" min="0" max="1" step="0.05" value="' + state.voiceSimilarity + '" data-voice-similarity></label><label>Style <output data-output="style">' + state.voiceStyle + '</output><input type="range" min="0" max="1" step="0.05" value="' + state.voiceStyle + '" data-voice-style></label><label>Speed <output data-output="speed">' + state.voiceSpeed + '</output><input type="range" min="0.7" max="1.2" step="0.05" value="' + state.voiceSpeed + '" data-voice-speed></label><label>Output format<select data-voice-output-format><option value="mp3_44100_128" ' + (state.voiceOutputFormat === 'mp3_44100_128' ? 'selected' : '') + '>mp3_44100_128</option><option value="pcm_16000" ' + (state.voiceOutputFormat === 'pcm_16000' ? 'selected' : '') + '>pcm_16000</option></select></label><label>Chunk schedule<input data-voice-chunk-schedule value="' + state.voiceChunkSchedule + '" aria-label="Chunk schedule" /></label><label>Barge-in<select data-voice-barge-in><option value="server_vad" ' + (state.voiceBargeIn === 'server_vad' ? 'selected' : '') + '>Server VAD</option><option value="semantic_vad" ' + (state.voiceBargeIn === 'semantic_vad' ? 'selected' : '') + '>Semantic VAD</option></select></label></div></div>';
  const advancedSettings = '<div class="setting-group advanced-settings"><div class="settings-section-label">ADVANCED VOICE CONFIGURATION</div><div class="settings-subsection"><span>TURN-TAKING</span><small>控制 VAD、静音、停顿和用户插话。</small></div><label>VAD Settings<select data-voice-vad><option value="silero_vad" ' + (state.voiceVad === 'silero_vad' ? 'selected' : '') + '>Silero VAD</option><option value="server_vad" ' + (state.voiceVad === 'server_vad' ? 'selected' : '') + '>Server VAD</option><option value="semantic_vad" ' + (state.voiceVad === 'semantic_vad' ? 'selected' : '') + '>Semantic VAD</option></select></label><label class="toggle-field"><span>Noise Reduction</span><input type="checkbox" data-voice-noise ' + (state.voiceNoiseReduction ? 'checked' : '') + '></label><label class="toggle-field"><span>Allow Interruption</span><input type="checkbox" data-voice-interruption ' + (state.voiceAllowInterruption ? 'checked' : '') + '></label><label class="toggle-field"><span>Silence Strategy</span><input type="checkbox" data-voice-silence ' + (state.voiceSilenceStrategy ? 'checked' : '') + '></label><div class="settings-subsection"><span>SESSION POLICY</span><small>控制会话起始、结束和消息归档策略。</small></div><label class="toggle-field"><span>Hang-Up Strategy</span><input type="checkbox" data-voice-hangup ' + (state.voiceHangupStrategy ? 'checked' : '') + '></label><label class="toggle-field"><span>Start with a Voice Call</span><input type="checkbox" data-voice-start-call ' + (state.voiceStartWithVoiceCall ? 'checked' : '') + '></label><label>User Message Position<select data-voice-message-position><option value="right" ' + (state.voiceUserMessagePosition === 'right' ? 'selected' : '') + '>Right</option><option value="bottom" ' + (state.voiceUserMessagePosition === 'bottom' ? 'selected' : '') + '>Bottom</option></select></label><label class="toggle-field"><span>Session Relevance Rejection</span><input type="checkbox" data-voice-relevance ' + (state.voiceSessionRelevanceRejection ? 'checked' : '') + '></label><label>Max Call Time<input type="number" min="30" max="7200" step="30" value="' + state.voiceMaxCallTime + '" data-voice-max-time><small>seconds</small></label><div class="settings-subsection"><span>DELIVERY CONTROL</span><small>这些字段会随短期 session 配置发送到 runtime。</small></div><div class="settings-summary"><span>Transport</span><b>LiveKit WebRTC</b><span>Fallback</span><b>Chrome ASR + browser TTS</b><span>Trace</span><b>session events / queryable</b></div></div>';
  const settings = baseSettings + advancedSettings;
  const traceSource = state.voiceTraceEvents.length ? state.voiceTraceEvents : state.voiceLogs.map((item) => ({ type: 'ui', ts: item.time, label: item.label, tone: item.tone }));
  const traceQuery = state.voiceLogQuery.trim().toLowerCase();
  const filteredTrace = traceSource.filter((event) => {
    const scopeMatch = state.voiceLogScope === 'all' || event.type === state.voiceLogScope;
    const haystack = traceEventLabel(event).toLowerCase();
    return scopeMatch && (!traceQuery || haystack.includes(traceQuery));
  });
  const traceRows = filteredTrace.slice().reverse().map((event) => '<li><time>' + esc(traceEventTime(event)) + '</time><b class="event-dot ' + (event.type === 'error' ? 'orange' : event.type === 'ended' ? 'quiet' : 'cyan') + '"></b><span>' + esc(traceEventLabel(event)) + '</span></li>').join('') || '<li class="trace-empty">没有匹配的事件</li>';
  const tracePanel = '<details class="observe-detail trace-query-panel" open><summary>SESSION LOG QUERY <span>' + filteredTrace.length + ' / ' + traceSource.length + '</span></summary><div class="trace-query-tools"><input type="search" placeholder="搜索事件、文本或错误码" value="' + esc(state.voiceLogQuery) + '" data-voice-log-query><select data-voice-log-scope><option value="all" ' + (state.voiceLogScope === 'all' ? 'selected' : '') + '>全部事件</option><option value="partial_transcript" ' + (state.voiceLogScope === 'partial_transcript' ? 'selected' : '') + '>ASR partial</option><option value="final_transcript" ' + (state.voiceLogScope === 'final_transcript' ? 'selected' : '') + '>ASR final</option><option value="tts_text" ' + (state.voiceLogScope === 'tts_text' ? 'selected' : '') + '>TTS text</option><option value="knowledge_hit" ' + (state.voiceLogScope === 'knowledge_hit' ? 'selected' : '') + '>Knowledge</option><option value="error" ' + (state.voiceLogScope === 'error' ? 'selected' : '') + '>Error</option></select><button type="button" class="trace-refresh" data-voice-trace-load ' + (!state.voiceSession?.sessionId ? 'disabled' : '') + '>刷新 Trace</button></div><div class="trace-query-status">' + esc(state.voiceTraceStatus) + ' · trace ' + esc(state.voiceSession?.traceId || 'not started') + '</div><ul class="voice-log trace-query-results">' + traceRows + '</ul></details>';
  const conversationArchive = '<details class="observe-detail conversation-archive" open><summary>FULL CONVERSATION <span>' + state.voiceConversation.length + ' turns</span></summary><div class="archive-meta">ASR final + TTS committed · 按时间顺序保留整段会话</div><div class="archive-thread">' + messages + '</div></details>';
  const callActive = ['connecting', 'connected', 'error'].includes(state.voiceCallStatus);
  const muteButton = callActive ? '<button class="call-action mute ' + (state.voiceMuted ? 'active' : '') + '" type="button" data-voice-mute>' + (state.voiceMuted ? '取消静音' : '静音') + '</button>' : '';
  const endButton = callActive ? '<button class="call-action end" type="button" data-voice-end>结束</button>' : '';
  const callButton = scenario.direction === 'outbound' ? '<button class="call-action answer ' + (state.voiceCallStatus === 'connected' ? 'reconnect' : '') + '" type="button" data-voice-answer>' + (state.voiceCallStatus === 'ringing' ? '接听来电' : state.voiceCallStatus === 'ended' ? '再次来电' : '已接听') + '</button><button class="call-action reject ' + (state.voiceCallStatus === 'ringing' ? '' : 'reconnect') + '" type="button" data-voice-reject>拒接</button>' : '<button class="call-action answer ' + (state.voiceCallStatus === 'connected' || state.voiceCallStatus === 'connecting' ? 'reconnect' : '') + '" type="button" data-voice-call>' + (state.voiceCallStatus === 'idle' || state.voiceCallStatus === 'ended' ? '开始拨号' : '重新连接') + '</button>';
  const callHeadline = scenario.direction === 'outbound' && state.voiceCallStatus === 'ringing' ? '有一通语音来电' : state.voiceStatus === 'listening' ? '正在听你说' : state.voiceStatus === 'thinking' ? '正在整理回答' : state.voiceStatus === 'speaking' ? 'Agent 正在播报' : state.voiceCallStatus === 'connected' ? '通话已连接，开始说话' : state.voiceCallStatus === 'connecting' ? '正在建立安全连接' : state.voiceCallStatus === 'error' ? '连接异常，已切换降级体验' : state.voiceCallStatus === 'ended' ? '通话已结束' : '准备建立通话';
  return shell('<section class="voice-screen section-pad" data-direction="' + scenario.direction + '"><div class="voice-screen-head"><div><span class="section-label">INTERACTIVE AI VOICE DEMO / ' + scenario.direction.toUpperCase() + '</span><h1>' + scenario.title + '</h1><p>' + scenario.subtitle + '</p></div><div class="voice-top-actions"><span class="runtime-chip ' + state.runtimeMode + '">' + state.runtimeMode.toUpperCase() + (state.runtimeMode === 'sandbox' ? ' / SIMULATED' : '') + '</span><div class="scenario-tabs">' + voiceScenarios.map((item) => '<a class="' + (item.id === scenario.id ? 'selected' : '') + '" href="#/apps/voice?scenario=' + item.id + '">' + item.title + '</a>').join('') + '</div></div></div><div class="voice-console"><aside class="voice-context-panel"><div class="panel-title"><span>SCENARIO</span><b>' + scenario.direction.toUpperCase() + '</b></div><div class="context-intro"><span class="scenario-icon">' + scenario.title.slice(0, 1) + '</span><div><h2>' + scenario.title + '</h2><p>默认音色：' + esc(scenario.defaultVoice || 'server preset') + '</p></div></div><div class="context-meta"><span>SESSION</span><b>' + esc(sessionLabel) + '</b><span>TRANSPORT</span><b>LiveKit WebRTC</b><span>TTS MODEL</span><b>' + esc(state.voiceModel) + '</b><span>FAST MODEL</span><b>' + esc(state.voiceFastModel || state.voiceAgentModel) + '</b><span>SLOW MODEL</span><b>' + esc(state.voiceSlowModel) + '</b><span>ASR</span><b>' + esc(state.voiceAsrModel) + '</b><span>VOICE</span><b>' + esc(state.voiceVoice === 'default' ? 'server default' : state.voiceVoice) + '</b></div><div class="panel-title workflow-title"><span>WORKFLOW</span><b>' + state.voiceStep + '/' + scenario.workflow.length + '</b></div><div class="voice-workflow compact">' + steps + '</div><details class="voice-settings compact-settings"><summary>语音配置 <span>语言 / 音色 / 参数</span></summary>' + settings + '</details><a class="detail-link detail-link-primary" href="#voice-details">查看 Demo 详情 ↗</a></aside><section class="voice-stage"><div class="stage-top"><div>' + agentAvatar + '<span class="mini-label">VOICE CALL</span><b>' + (scenario.direction === 'outbound' ? 'Agent 主动来电' : '用户主动拨号') + '</b></div><span class="voice-state ' + state.voiceStatus + '"><i></i>' + state.voiceStatus.toUpperCase() + '</span></div><div class="call-session-strip"><span>' + (state.voiceCallStatus === 'idle' ? 'READY TO CONNECT' : 'WEBRTC / LIVEKIT') + '</span><b>' + (state.voiceCallStatus === 'connected' ? 'CONNECTED' : state.voiceCallStatus.toUpperCase()) + '</b><small>trace ' + esc(state.voiceSession?.traceId || sessionLabel) + '</small></div><div class="caller-orb ' + state.voiceCallStatus + ' ' + state.voiceStatus + '">' + scenario.title.slice(0, 1) + '</div><div class="call-wave ' + state.voiceStatus + '" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div>' + liveCaption + '<strong>' + callHeadline + '</strong><div class="call-actions"><button class="call-action caption-toggle" type="button" data-voice-captions>' + (state.voiceSubtitleVisible ? '隐藏字幕' : '显示字幕') + '</button>' + callButton + muteButton + endButton + '</div><small>麦克风权限只在点击拨号 / 接听后申请 · ASR: ' + esc(state.voiceAsrModel) + ' · ' + state.voiceApiState + '</small>' + transcriptPanel + '</section>' + '<aside class="voice-observe-panel">' + tracePanel + conversationArchive + '<div class="panel-title"><span>REAL-TIME METRICS</span><b>' + state.voiceCallStatus.toUpperCase() + ' · ' + (state.runtimeMode === 'sandbox' ? 'SANDBOX' : 'LIVE') + '</b></div><div class="current-model-card"><span>MODEL ROUTING</span><div class="model-pair"><div><small>FAST / VOICE</small><b>' + esc(state.voiceFastModel || state.voiceAgentModel) + '</b></div><div><small>SLOW / VALIDATE</small><b>' + esc(state.voiceSlowModel) + '</b></div></div><small>路径：' + esc(state.voiceQualityPath) + ' · TTS: ' + esc(state.voiceModel) + '</small></div><div class="insight-grid">' + insightCards + '</div><div class="metric-grid realtime"><div><span>ASR</span>' + metric(state.voiceLatency.asr, 'ms') + '</div><div><span>FAST LLM</span>' + metric(state.voiceLatency.intent, 'ms') + '</div><div><span>SLOW LLM</span>' + metric(state.voiceLatency.slow, 'ms') + '</div><div><span>KB</span>' + metric(state.voiceLatency.kb, 'ms') + '</div><div><span>TTS TTFB</span>' + metric(state.voiceLatency.tts, 'ms') + '</div><div><span>E2E</span>' + metric(state.voiceLatency.e2e ?? (state.voiceLatency.tts === null || state.voiceLatency.asr === null || state.voiceLatency.intent === null ? null : state.voiceLatency.asr + state.voiceLatency.intent + state.voiceLatency.tts), 'ms') + '</div></div><div class="rtc-status-grid"><div><span>RTT</span><b>' + (state.voiceMetrics?.rtt ?? '—') + '</b></div><div><span>JITTER</span><b>' + (state.voiceMetrics?.jitter ?? '—') + '</b></div><div><span>PACKET LOSS</span><b>' + (state.voiceMetrics?.packetLoss ?? '—') + '</b></div><div><span>INTERRUPT</span><b>' + (state.voiceMetrics?.interrupt ?? '—') + '</b></div></div><details class="observe-detail" open><summary>KNOWLEDGE BASE <span>top hits</span></summary><ul class="knowledge-list">' + knowledge + '</ul></details><details class="observe-detail"><summary>EVENT TRACE <span>' + state.voiceLogs.length + ' events</span></summary><ul class="voice-log">' + logs + '</ul></details><details class="observe-detail"><summary>文本备用入口</summary><div class="voice-samples">' + scenario.examples.map((item) => '<button type="button" data-voice-sample="' + esc(item) + '">' + item + '</button>').join('') + '</div><div class="voice-composer"><textarea id="voice-input" rows="2" placeholder="' + esc(scenario.prompt) + '">' + esc(state.voiceInput) + '</textarea><div class="voice-actions"><button class="button primary" type="button" data-voice-send>发送并运行 <span>↗</span></button></div></div></details><div class="obs-boundary"><span>' + (state.runtimeMode === 'sandbox' ? 'SANDBOX / SIMULATED' : 'LIVE / SERVER TELEMETRY') + '</span><p>真实运行时会从 LiveKit、Agent 和 ElevenLabs 事件填充指标；当前静态站点未连接生产会话。</p></div></aside></div></section>' + detailPages);
}

function notFoundView() { return shell('<section class="page-intro section-pad"><span class="section-label">404 / PAGE NOT FOUND</span><h1>这条路径还没有产品。</h1><a class="button primary" href="#/">回到首页</a></section>'); }

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
  const socketUrl = voiceRuntimeSocket('/api/voice/tts?scenario=' + encodeURIComponent(activeVoiceScenario().id) + '&voiceId=' + encodeURIComponent(state.voiceVoice === 'default' ? '' : state.voiceVoice) + '&modelId=' + encodeURIComponent(state.voiceModel) + '&language=' + encodeURIComponent(state.voiceLanguage) + '&outputFormat=' + encodeURIComponent(state.voiceOutputFormat) + '&chunkSchedule=' + encodeURIComponent(state.voiceChunkSchedule) + '&bargeIn=' + encodeURIComponent(state.voiceBargeIn) + '&tone=' + encodeURIComponent(state.voiceTone) + '&emotion=' + encodeURIComponent(state.voiceEmotion) + '&pitch=' + state.voicePitch + '&stability=' + state.voiceStability + '&similarity=' + state.voiceSimilarity + '&style=' + state.voiceStyle + '&speed=' + state.voiceSpeed);
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
function postRoomTraceEvent(event) {
  if (!voiceRuntimeUrl() || state.runtimeMode !== 'live' || !state.voiceSession?.sessionId || !event?.type) return;
  fetch(voiceRuntimeEndpoint('/api/voice/session/' + encodeURIComponent(state.voiceSession.sessionId) + '/event'), {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...event, traceId: state.voiceSession.traceId, sessionId: state.voiceSession.sessionId })
  }).catch(() => {});
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
    const response = await fetch(voiceRuntimeEndpoint('/api/voice/session/' + encodeURIComponent(state.voiceSession.sessionId) + '/trace'));
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || 'TRACE_HTTP_' + response.status);
    state.voiceTraceEvents = Array.isArray(payload.events) ? payload.events : [];
    state.voiceTraceStatus = `loaded ${state.voiceTraceEvents.length}`;
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
  if (source === 'room') postRoomTraceEvent(event);
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
    if (/429|quota|stt|speech|recogniz|agent_error/i.test(code)) {
      state.voiceAsrFallback = true;
      if (/stt|speech|recogniz/i.test(code)) state.voiceAsrModel = 'Web Speech API / Chrome fallback';
      state.voiceApiState = /429|quota|agent_error/i.test(code) ? 'server Agent unavailable → Chrome ASR + demo reply' : 'server ASR unavailable → Chrome fallback';
      window.setTimeout(() => startBrowserRecognition({ fallback: true }), 0);
    }
  }
  if (event.type === 'ringing') { state.voiceStatus = 'ringing'; state.voiceCallStatus = 'ringing'; }
  if (['dialing', 'ice_checking', 'connecting', 'room_joined', 'agent_joined'].includes(event.type)) { state.voiceStatus = 'connecting'; state.voiceCallStatus = 'connecting'; }
  if (['audio_track_ready', 'listening', 'speech_stopped'].includes(event.type)) { state.voiceStatus = 'connected'; state.voiceCallStatus = 'connected'; }
  if (event.type === 'speech_started') state.voiceStatus = 'listening';
  if (event.type === 'thinking' || event.type === 'tool_call') state.voiceStatus = 'thinking';
  if (event.type === 'deep_started') state.voiceSlowStatus = 'running';
  if (event.type === 'deep_result') { state.voiceSlowStatus = 'ready'; state.voiceSlowModel = event.model || state.voiceSlowModel; state.voiceQualityPath = event.trigger === 'partial' ? 'speculative lookup → validated' : 'fast voice → slow validation'; }
  if (event.type === 'deep_result_used') { state.voiceSlowStatus = 'used'; state.voiceQualityPath = 'fast voice + slow result'; }
  if (event.type === 'deep_error') { state.voiceSlowStatus = 'fallback'; state.voiceQualityPath = 'fast voice → demo KB fallback'; }
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
  if (event.agentModel) state.voiceAgentModel = event.agentModel;
  if (event.fastModel) { state.voiceFastModel = event.fastModel; state.voiceAgentModel = event.fastModel; }
  if (event.slowModel) state.voiceSlowModel = event.slowModel;
  if (event.asrModel) state.voiceAsrModel = event.asrModel;
  if (event.ttsModel) state.voiceModel = event.ttsModel;
  if (event.emotion) state.voiceInsights = { ...state.voiceInsights, emotion: event.emotion, confidence: event.confidence || state.voiceInsights.confidence };
  if (event.age || event.gender) state.voiceInsights = { ...state.voiceInsights, age: event.age || state.voiceInsights.age, gender: event.gender || state.voiceInsights.gender, confidence: event.confidence || state.voiceInsights.confidence };
  render(true);
}
function subscribeRuntimeEvents(sessionId) {
  if (!voiceRuntimeUrl() || !sessionId) return;
  if (state.voiceEventSocket) state.voiceEventSocket.close();
  const socket = new WebSocket(voiceRuntimeSocket('/api/voice/events?sessionId=' + encodeURIComponent(sessionId)));
  state.voiceEventSocket = socket;
  socket.addEventListener('message', (event) => { try { applyRuntimeEvent(JSON.parse(event.data), 'runtime'); } catch {} });
  socket.addEventListener('error', () => voiceLog('event stream unavailable', 'orange'));
}
async function connectLiveKit(session) {
  if (!session?.token || !session.room || !session.serverUrl) throw new Error('LIVEKIT_SESSION_INCOMPLETE');
  if (state.voiceRoom) state.voiceRoom.disconnect();
  const room = new Room({ adaptiveStream: true, dynacast: true });
  state.voiceRoom = room;
  room.on(RoomEvent.ConnectionStateChanged, (connectionState) => {
    voiceLog('LiveKit connection: ' + connectionState, connectionState === ConnectionState.Connected ? 'lime' : 'cyan');
    if (connectionState === ConnectionState.Connected) { state.voiceCallStatus = 'connected'; state.voiceStatus = 'connected'; }
    if (connectionState === ConnectionState.Reconnecting) { state.voiceCallStatus = 'connecting'; state.voiceStatus = 'reconnecting'; }
    if (connectionState === ConnectionState.Disconnected && state.voiceCallStatus !== 'ended') { state.voiceCallStatus = 'error'; state.voiceStatus = 'error'; }
    render(true);
  });
  room.on(RoomEvent.TrackSubscribed, (track) => {
    if (track.kind === 'audio') {
      const media = track.attach();
      media.setAttribute('data-livekit-audio', 'true');
      media.autoplay = true;
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
  room.on(RoomEvent.DataReceived, (payload) => {
    try { applyRuntimeEvent(JSON.parse(new TextDecoder().decode(payload)), 'room'); } catch {}
  });
  await room.connect(session.serverUrl, session.token);
  const localTrack = await createLocalAudioTrack({ echoCancellation: true, noiseSuppression: state.voiceNoiseReduction, autoGainControl: true });
  await room.localParticipant.publishTrack(localTrack);
  state.voiceLocalTrack = localTrack;
  addVoiceAnalyserForTrack(localTrack);
  state.voiceCallStatus = 'connected';
  state.voiceStatus = 'connected';
  voiceLog('microphone track published', 'lime');
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
async function createRuntimeSession(mode) {
  const scenario = activeVoiceScenario();
  const response = await fetch(voiceRuntimeEndpoint('/api/voice/session'), {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ scenario: scenario.id, direction: scenario.direction, language: state.voiceLanguage, voiceId: state.voiceVoice, agentModel: state.voiceFastModel || state.voiceAgentModel, fastModel: state.voiceFastModel || state.voiceAgentModel, slowModel: state.voiceSlowModel, asrModel: state.voiceAsrModel, ttsModel: state.voiceModel, runtimeMode: mode, voiceConfig: { vad: state.voiceVad, noiseReduction: state.voiceNoiseReduction, allowInterruption: state.voiceAllowInterruption, silenceStrategy: state.voiceSilenceStrategy, hangupStrategy: state.voiceHangupStrategy, startWithVoiceCall: state.voiceStartWithVoiceCall, userMessagePosition: state.voiceUserMessagePosition, sessionRelevanceRejection: state.voiceSessionRelevanceRejection, maxCallTime: state.voiceMaxCallTime, tone: state.voiceTone, emotion: state.voiceEmotion, pitch: state.voicePitch, stability: state.voiceStability, similarity: state.voiceSimilarity, style: state.voiceStyle, speed: state.voiceSpeed, outputFormat: state.voiceOutputFormat, chunkSchedule: state.voiceChunkSchedule, bargeIn: state.voiceBargeIn } })
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error || 'SESSION_HTTP_' + response.status);
  state.voiceSession = payload.session || payload;
  state.runtimeMode = state.voiceSession.runtimeMode || mode;
  if (state.runtimeMode === 'live') {
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
  if (activeVoiceScenario().direction !== 'outbound' || state.voiceSession || state.voiceOutboundInit || !voiceRuntimeUrl()) return;
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
  state.voiceLatency.asr = state.runtimeMode === 'live' ? null : 240 + Math.min(180, value.length * 4);
  state.voiceLatency.intent = state.runtimeMode === 'live' ? null : 28 + (value.length % 19);
  state.voiceLatency.kb = state.runtimeMode === 'live' ? null : 20 + (scenario.id === 'airline' ? 12 : 6);
  state.voiceInsights = state.runtimeMode === 'live'
    ? { emotion: '等待服务端识别', age: '等待服务端识别', gender: '等待服务端识别', confidence: null }
    : { emotion: value.includes('断线') || value.includes('投诉') ? '焦虑 / frustrated' : '平静 / neutral', age: '30–39（模拟）', gender: '未判断（模拟）', confidence: 72 };
  voiceLog('user utterance received', 'cyan');
  voiceLog('intent classified: ' + scenario.id, 'cyan');
  render();
  window.setTimeout(() => {
    state.voiceStep = Math.min(scenario.workflow.length, 4);
    addConversationMessage('assistant', scenario.reply, 'demo-reply', { model: state.voiceModel });
    state.voicePartial = '';
    state.voiceStatus = 'connected';
    voiceLog('knowledge base top hit returned', 'lime');
    voiceLog('response committed / handoff boundary checked', 'lime');
    render();
    if (voiceRuntimeUrl()) elevenLabsSpeak(scenario.reply);
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
function bindVoiceEvents() {
  document.querySelectorAll('.detail-link-primary').forEach((link) => link.addEventListener('click', (event) => { event.preventDefault(); document.querySelector('#voice-details')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }));
  const actionBar = document.querySelector('.call-actions');
  if (actionBar && !actionBar.querySelector('[data-voice-mic]')) {
    const micButton = document.createElement('button');
    micButton.type = 'button';
    micButton.className = 'call-action voice-input';
    micButton.dataset.voiceMic = '';
    micButton.textContent = '开始语音';
    micButton.disabled = state.voiceCallStatus !== 'connected';
    actionBar.insertBefore(micButton, actionBar.firstChild);
  }
  document.querySelectorAll('[data-voice-sample]').forEach((button) => button.addEventListener('click', () => {
    const input = document.querySelector('#voice-input');
    if (input) { input.value = button.dataset.voiceSample; state.voiceInput = input.value; input.focus(); }
  }));
  const input = document.querySelector('#voice-input');
  if (input) input.addEventListener('input', (event) => { state.voiceInput = event.target.value; });
  const send = document.querySelector('[data-voice-send]');
  if (send) send.addEventListener('click', () => processVoiceInput(state.voiceInput));
  const connect = async () => {
    state.voiceCallStatus = 'connecting';
    state.voiceStatus = 'connecting';
    state.voiceApiState = voiceRuntimeUrl() ? 'requesting server session' : 'sandbox / simulated';
    const audioContext = ensureVoiceAudioContext();
    if (audioContext?.state === 'suspended') await audioContext.resume().catch(() => {});
    voiceLog('session created', 'cyan');
    render();
    if (voiceRuntimeUrl()) {
      try {
        const session = state.voiceSession || await createRuntimeSession('live');
        if (session.direction === 'outbound' && session.status === 'ringing') throw new Error('OUTBOUND_REQUIRES_ANSWER');
        if (session.runtimeMode === 'live') await connectLiveKit(session);
        else { state.voiceCallStatus = 'connecting'; state.voiceStatus = 'connecting'; }
        voiceLog('live session connected', 'lime');
        render();
        return;
      } catch (error) {
        if (error.message === 'OUTBOUND_REQUIRES_ANSWER') { state.voiceCallStatus = 'ringing'; state.voiceStatus = 'ringing'; render(); return; }
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
    state.voiceCallStatus = 'connecting';
    state.voiceStatus = 'connecting';
    const audioContext = ensureVoiceAudioContext();
    if (audioContext?.state === 'suspended') await audioContext.resume().catch(() => {});
    render();
    try {
      if (voiceRuntimeUrl() && state.voiceSession?.sessionId) {
        const response = await fetch(voiceRuntimeEndpoint('/api/voice/answer'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sessionId: state.voiceSession.sessionId }) });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error || 'ANSWER_FAILED');
        state.voiceSession = payload.session || state.voiceSession;
        if (state.voiceSession.runtimeMode === 'live') await connectLiveKit(state.voiceSession);
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
          await connectLiveKit(state.voiceSession);
          state.voiceCallStatus = 'connected';
          state.voiceStatus = 'connected';
          voiceLog('outbound answer connected with issued LiveKit token', 'lime');
          render();
          return;
        } catch (liveError) {
          voiceLog('outbound LiveKit answer failed: ' + liveError.message, 'orange');
        }
      }
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
  if (mute) mute.addEventListener('click', () => { state.voiceMuted = !state.voiceMuted; voiceLog(state.voiceMuted ? 'microphone muted' : 'microphone unmuted', 'cyan'); render(); });
  const mic = document.querySelector('[data-voice-mic]');
  if (mic) mic.addEventListener('click', () => startBrowserRecognition({ fallback: state.voiceAsrFallback }));
  const end = document.querySelector('[data-voice-end]');
  if (end) end.addEventListener('click', async () => { if (state.voiceStatsTimer) { window.clearInterval(state.voiceStatsTimer); state.voiceStatsTimer = null; } if (state.voiceLocalTrack) { state.voiceLocalTrack.stop(); state.voiceLocalTrack = null; } if (state.voiceRoom) { state.voiceRoom.disconnect(); state.voiceRoom = null; } stopVoiceAnalyser(); if (state.voiceEventSocket) { state.voiceEventSocket.close(); state.voiceEventSocket = null; } if (voiceRuntimeUrl() && state.voiceSession?.sessionId) await fetch(voiceRuntimeEndpoint('/api/voice/end'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sessionId: state.voiceSession.sessionId, reason: 'user' }) }).catch(() => {}); loadSessionTrace(); state.voiceCallStatus = 'ended'; state.voiceStatus = 'ended'; voiceLog('call ended by user', 'orange'); render(); });
  const speak = document.querySelector('[data-voice-speak]');
  if (speak) speak.addEventListener('click', () => { const last = [...state.voiceMessages].reverse().find((item) => item.role === 'assistant'); if (last) elevenLabsSpeak(last.text); });
  const captions = document.querySelector('[data-voice-captions]');
  if (captions) captions.addEventListener('click', () => { state.voiceSubtitleVisible = !state.voiceSubtitleVisible; render(true); });
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
  const sliderMap = [['[data-voice-stability]', 'voiceStability', 'stability'], ['[data-voice-similarity]', 'voiceSimilarity', 'similarity'], ['[data-voice-style]', 'voiceStyle', 'style'], ['[data-voice-speed]', 'voiceSpeed', 'speed'], ['[data-voice-pitch]', 'voicePitch', 'pitch']];
  sliderMap.forEach(([selector, key, output]) => { const el = document.querySelector(selector); if (el) el.addEventListener('input', (event) => { state[key] = event.target.value; const target = document.querySelector('[data-output="' + output + '"]'); if (target) target.textContent = event.target.value; }); });
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
    card.addEventListener('keydown', (event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); open(); } });
  });
}
function render(preserveScroll = false) {
  const previousScrollY = window.scrollY;
  const rawHash = window.location.hash.replace(/^#\/?/, '');
  const hashParts = rawHash.split('?');
  const hash = hashParts[0];
  const query = new URLSearchParams(hashParts[1] || '');
  const segments = hash.split('/').filter(Boolean);
  if (!segments.length) app.innerHTML = homeView();
  else if (segments[0] === 'apps' && segments[1] === 'voice') app.innerHTML = voiceScenarioView(query.get('scenario') || 'carrier');
  else if (segments[0] === 'apps') app.innerHTML = appsView();
  else if (segments[0] === 'projects' || segments[0] === 'method') app.innerHTML = notFoundView();
  else app.innerHTML = notFoundView();
  bindVoiceEvents();
  bindAppCards();
  window.scrollTo({ top: preserveScroll ? previousScrollY : 0, behavior: 'instant' });
}
window.addEventListener('hashchange', render);
render();

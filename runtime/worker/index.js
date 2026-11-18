const SCENARIOS = {
  carrier: { direction: 'inbound', voiceKey: 'ELEVENLABS_VOICE_ID_CARRIER', fallbackVoice: 'JBFqnCBsd6RMkjVDRZzb' },
  airline: { direction: 'inbound', voiceKey: 'ELEVENLABS_VOICE_ID_AIRLINE', fallbackVoice: '21m00Tcm4TlvDq8ikWAM' },
  football: { direction: 'outbound', voiceKey: 'ELEVENLABS_VOICE_ID_FOOTBALL', fallbackVoice: 'JBFqnCBsd6RMkjVDRZzb' }
};

// The isolate cache keeps active sessions fast. TRACE_KV is the durable
// cross-instance store for the public runtime. TRACE_DB remains a fallback
// for the upstream runtime until its own binding is migrated.
const sessions = new Map();
const sockets = new Map();
const isoNow = () => new Date().toISOString();
const SESSION_TTL_MS = 15 * 60 * 1000;
const TRACE_DB_TABLE = 'voice_trace_sessions';
let traceDbSchemaPromise = null;
const REQUEST_WINDOW_MS = 60 * 1000;
const REQUEST_LIMIT = 12;
const requestWindows = new Map();
const TRACE_EVENT_TYPES = new Set(['agent_joined', 'listening', 'speech_started', 'speech_stopped', 'partial_transcript', 'final_transcript', 'knowledge_hit', 'tool_call', 'handoff', 'tts_started', 'tts_first_byte', 'tts_text_delta', 'tts_text', 'speaking', 'thinking', 'barge_in', 'interrupted', 'deep_started', 'deep_result', 'deep_result_used', 'deep_error', 'metrics', 'error', 'ended']);
const DEFAULT_FAST_MODEL = 'openai/gpt-6.1-sol';
const DEFAULT_ASR_MODEL = 'openai/gpt-live-transcribe';
const DEFAULT_TTS_MODEL = 'eleven_flash_v2_5';
const LLM_MODELS = [
  'gpt-6.1-sol', 'gpt-6.2-sol', 'gpt-6.2-astra', 'gpt-6.1-terra', 'gpt-6-sol', 'gpt-6-luna',
  'gpt-6-astra', 'gpt-5.6-sol', 'gpt-5.6-luna', 'gpt-5.6-terra', 'gpt-4.1-mini', 'gpt-4.1', 'gpt-4o-mini'
];
const OPENAI_ASR_MODELS = [
  'gpt-live-transcribe', 'gpt-transcribe', 'gpt-realtime-whisper', 'gpt-4o-transcribe', 'gpt-4o-mini-transcribe'
];
const TTS_MODELS = [
  'eleven_flash_v2_5', 'eleven_turbo_v2_5', 'eleven_multilingual_v2', 'eleven_flash_v2', 'eleven_turbo_v2',
  'eleven_v3', 'eleven_v3_conversational', 'eleven_v4', 'eleven_v4_turbo'
];
const TTS_FORMATS = ['pcm_16000', 'pcm_22050', 'pcm_44100', 'mp3_22050_32', 'mp3_44100_32', 'mp3_44100_64', 'mp3_44100_96', 'mp3_44100_128', 'mp3_44100_192'];
const REASONING_EFFORTS = ['low', 'medium', 'high', 'xhigh', 'max'];
const NO_REASONING_MODELS = ['gpt-6.1-terra', 'gpt-6-sol', 'gpt-6-luna', 'gpt-5.6-sol', 'gpt-5.6-luna', 'gpt-5.6-terra'];
const CATALOG_MAX_AGE_MS = 5 * 60 * 1000;
const TRACE_BATCH_LIMIT = 64;
const TRACE_BATCH_BYTES = 96 * 1024;
const PREVIEW_TEXT = {
  zh: { carrier: '您好，请问有什么可以帮您？', airline: '您好，请问要查询哪一趟航班？', football: '你好，我来问你几个关于踢球的问题。' },
  en: { carrier: 'Hello, how can I help you today?', airline: 'Hello, which flight can I help you with?', football: 'Hi, let’s talk about the way you play football.' },
  ar: { carrier: 'أهلاً بك، كيف يمكنني مساعدتك اليوم؟', airline: 'أهلاً بك، ما الرحلة التي تريد الاستفسار عنها؟', football: 'مرحباً، لنتحدث عن أسلوبك في لعب كرة القدم.' }
};
const TRACE_REQUEST_LIMIT = 60;
const catalogEntries = new Map();
const boundedNumber = (value, min, max, fallback) => value !== '' && value != null && Number.isFinite(Number(value))
  ? Math.max(min, Math.min(max, Number(value)))
  : fallback;
const boundedInteger = (value, min, max, fallback) => Math.round(boundedNumber(value, min, max, fallback));
const choice = (value, options, fallback) => options.includes(value) ? value : fallback;
const languageCode = (value, fallback = '') => /^[a-z]{2,3}(?:-[a-zA-Z0-9]{2,8})?$/i.test(String(value || '')) ? String(value).toLowerCase() : fallback;
const providerId = (value) => String(value || '').replace(/^openai\//, '');
const responseModelId = (requested) => LLM_MODELS.includes(providerId(requested)) ? 'openai/' + providerId(requested) : DEFAULT_FAST_MODEL;
const asrModelId = (requested) => OPENAI_ASR_MODELS.includes(providerId(requested))
  ? 'openai/' + providerId(requested)
  : requested === 'elevenlabs/scribe_v2_realtime' ? requested : DEFAULT_ASR_MODEL;
const isDialogueModel = (model) => /^(eleven_v3|eleven_v4)/.test(model);
const isProviderId = (value) => /^[a-zA-Z0-9_-]{1,128}$/.test(String(value || ''));
const normalizedWords = (value) => (Array.isArray(value) ? value : String(value || '').split(/[\n,，]/))
  .map(word => String(word).trim().slice(0, 80)).filter(Boolean).slice(0, 50);
const normalizedSchedule = (value) => String(value || '').split(',').map(item => Number(item.trim()))
  .filter(item => Number.isInteger(item) && item >= 50 && item <= 500).slice(0, 8);
const normalizedDictionaries = (value) => (Array.isArray(value) ? value : [])
  .filter(item => isProviderId(item?.pronunciation_dictionary_id) && isProviderId(item?.version_id))
  .slice(0, 3).map(({ pronunciation_dictionary_id, version_id }) => ({ pronunciation_dictionary_id, version_id }));

function llmCapability(id) {
  const supportsTemperature = id.startsWith('gpt-4');
  return {
    id: 'openai/' + id,
    name: id,
    reasoningEfforts: supportsTemperature ? [] : NO_REASONING_MODELS.includes(id) ? ['none', ...REASONING_EFFORTS] : REASONING_EFFORTS,
    supportsTemperature
  };
}

function normalizeVoiceConfig(input, models) {
  const draft = input && typeof input === 'object' ? input : {};
  const settings = {};
  for (const lane of ['fast', 'slow']) {
    const capability = llmCapability(providerId(models[lane + 'Model']));
    settings[lane + 'ReasoningEffort'] = choice(draft[lane + 'ReasoningEffort'], capability.reasoningEfforts, capability.reasoningEfforts.length ? 'low' : null);
    settings[lane + 'MaxOutputTokens'] = boundedInteger(draft[lane + 'MaxOutputTokens'], 16, 4096, lane === 'fast' ? 512 : 1024);
    settings[lane + 'UseWebSocket'] = draft[lane + 'UseWebSocket'] !== false;
    settings[lane + 'ParallelToolCalls'] = draft[lane + 'ParallelToolCalls'] !== false;
    settings[lane + 'ServiceTier'] = choice(draft[lane + 'ServiceTier'], ['auto', 'default', 'priority', 'flex'], 'default');
    settings[lane + 'Temperature'] = capability.supportsTemperature ? boundedNumber(draft[lane + 'Temperature'], 0, 2, 1) : null;
  }

  const schedule = normalizedSchedule(draft.chunkSchedule);
  const endpointMinMs = boundedInteger(draft.endpointMinMs, 100, 3000, 400);
  return {
    ...settings,
    interactionType: 'voice_call',
    vad: 'silero_vad',
    vadThreshold: boundedNumber(draft.vadThreshold, 0.1, 0.9, 0.5),
    vadMinSpeechMs: boundedInteger(draft.vadMinSpeechMs, 20, 1500, 100),
    vadMinSilenceMs: boundedInteger(draft.vadMinSilenceMs, 100, 3000, 420),
    vadPrefixPaddingMs: boundedInteger(draft.vadPrefixPaddingMs, 0, 1500, 500),
    endpointMinMs,
    endpointMaxMs: boundedInteger(draft.endpointMaxMs, endpointMinMs, 10000, 2000),
    interruptionMinMs: boundedInteger(draft.interruptionMinMs, 50, 3000, 500),
    interruptionMinWords: boundedInteger(draft.interruptionMinWords, 0, 10, 0),
    noiseReduction: draft.noiseReduction !== false,
    allowInterruption: draft.allowInterruption !== false,
    silenceStrategy: draft.silenceStrategy === true,
    hangupStrategy: draft.hangupStrategy === true,
    userAwayTimeoutSec: boundedInteger(draft.userAwayTimeoutSec, 5, 120, 18),
    maxCallTime: boundedInteger(draft.maxCallTime, 30, 7200, 1800),
    tone: String(draft.tone || 'neutral').slice(0, 32),
    emotion: String(draft.emotion || 'neutral').slice(0, 32),
    pitch: boundedNumber(draft.pitch, 0.75, 1.25, 1),
    volume: boundedNumber(draft.volume, 0, 1, 1),
    stability: boundedNumber(draft.stability, 0, 1, 0.5),
    similarity: boundedNumber(draft.similarity, 0, 1, 0.75),
    style: boundedNumber(draft.style, 0, 1, 0),
    speed: boundedNumber(draft.speed, 0.7, 1.2, 1),
    useSpeakerBoost: draft.useSpeakerBoost === true,
    outputFormat: choice(draft.outputFormat, TTS_FORMATS, 'pcm_22050'),
    chunkSchedule: (schedule.length ? schedule : [50, 120, 160, 290]).join(','),
    autoMode: draft.autoMode === true,
    enableSsmlParsing: draft.enableSsmlParsing === true,
    applyTextNormalization: choice(draft.applyTextNormalization, ['auto', 'on', 'off'], 'auto'),
    applyLanguageTextNormalization: draft.applyLanguageTextNormalization === true,
    preferredAlignment: draft.preferredAlignment === 'original' ? 'original' : 'normalized',
    pronunciationDictionaries: normalizedDictionaries(draft.pronunciationDictionaries),
    ttsInactivityTimeoutSec: boundedInteger(draft.ttsInactivityTimeoutSec, 5, 180, 60),
    ttsLanguage: draft.ttsLanguage === 'auto' ? 'auto' : languageCode(draft.ttsLanguage, models.language || 'zh'),
    asrLanguage: draft.asrLanguage === 'auto' ? 'auto' : languageCode(draft.asrLanguage, models.language || 'zh'),
    asrPrompt: String(draft.asrPrompt || '').slice(0, 500),
    asrKeyterms: normalizedWords(draft.asrKeyterms),
    asrNoiseReductionType: choice(draft.asrNoiseReductionType, ['near_field', 'far_field', 'off'], 'near_field'),
    asrSampleRate: choice(Number(draft.asrSampleRate), [8000, 16000, 22050, 24000, 44100, 48000], 16000),
    asrChunkMs: boundedInteger(draft.asrChunkMs, 50, 1000, 100),
    asrIncludeTimestamps: draft.asrIncludeTimestamps === true
  };
}

function clientKey(request) {
  return request.headers.get('cf-connecting-ip') || request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'anonymous';
}

function enforceRateLimit(request, scope = 'session', limit = REQUEST_LIMIT) {
  const key = scope + ':' + clientKey(request);
  const now = Date.now();
  const bucket = requestWindows.get(key) || { startedAt: now, count: 0 };
  if (now - bucket.startedAt > REQUEST_WINDOW_MS) { bucket.startedAt = now; bucket.count = 0; }
  bucket.count += 1;
  requestWindows.set(key, bucket);
  if (requestWindows.size > 5000) {
    for (const [candidate, value] of requestWindows) if (now - value.startedAt > REQUEST_WINDOW_MS) requestWindows.delete(candidate);
  }
  return bucket.count <= limit;
}

function defaultVoiceId(scenario, env) {
  return env[SCENARIOS[scenario].voiceKey] || SCENARIOS[scenario].fallbackVoice;
}

function providerError(code, status) {
  return Object.assign(new Error(code), { status });
}

function safeProviderCode(body, fallback) {
  return String(body?.detail?.status || body?.error?.code || fallback).replace(/[^A-Za-z0-9_.-]/g, '_').slice(0, 96);
}

async function elevenLabsJson(path, env, useKey = true) {
  if (useKey && !env.ELEVENLABS_API_KEY) throw providerError('ELEVENLABS_CREDENTIALS_MISSING', 503);
  const headers = { accept: 'application/json' };
  if (useKey) headers['xi-api-key'] = env.ELEVENLABS_API_KEY;
  let response;
  try {
    response = await fetch('https://api.elevenlabs.io' + path, { headers, signal: AbortSignal.timeout(8000) });
  } catch {
    throw providerError('ELEVENLABS_UNREACHABLE', 502);
  }
  const body = await response.json().catch(() => null);
  if (!response.ok || !body) {
    throw providerError(safeProviderCode(body, 'ELEVENLABS_HTTP_' + response.status), response.status >= 400 && response.status < 500 ? response.status : 502);
  }
  return body;
}

async function cacheCatalog(key, read) {
  const cached = catalogEntries.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.data;
  const data = await read();
  catalogEntries.set(key, { data, expiresAt: Date.now() + CATALOG_MAX_AGE_MS });
  if (catalogEntries.size > 256) catalogEntries.delete(catalogEntries.keys().next().value);
  return data;
}

function readTtsModels(env) {
  return cacheCatalog('tts-models', async () => {
    const models = await elevenLabsJson('/v1/models', env);
    const configured = String(env.ELEVENLABS_ALLOWED_MODELS || '').split(',').map(id => id.trim()).filter(Boolean);
    return models.filter(model => model.can_do_text_to_speech && TTS_MODELS.includes(model.model_id) && (!configured.length || configured.includes(model.model_id)))
      .map(model => {
        const dialogue = isDialogueModel(model.model_id);
        return {
          id: model.model_id,
          name: model.name || model.model_id,
          languages: (model.languages || []).map(item => ({ code: item.language_id, name: item.name || item.language_id })),
          transport: dialogue ? 'dialogue-websocket' : 'websocket',
          live: true,
          outputFormats: TTS_FORMATS,
          premiumOutputFormats: ['pcm_44100', 'mp3_44100_192'],
          capabilities: {
            stability: true,
            similarity: !dialogue,
            style: !dialogue && Boolean(model.can_use_style),
            speakerBoost: !dialogue && Boolean(model.can_use_speaker_boost),
            speed: !dialogue,
            chunkSchedule: !dialogue,
            autoMode: !dialogue,
            ssml: !dialogue,
            pronunciationDictionaries: !dialogue
          }
        };
      });
  });
}

async function readOpenAIModels(env) {
  if (!env.OPENAI_API_KEY) return null;
  return cacheCatalog('openai-models', async () => {
    const response = await fetch('https://api.openai.com/v1/models', {
      headers: { authorization: 'Bearer ' + env.OPENAI_API_KEY, accept: 'application/json' },
      signal: AbortSignal.timeout(6000)
    });
    if (!response.ok) throw providerError('OPENAI_MODELS_HTTP_' + response.status, response.status);
    const body = await response.json();
    return new Set(body.data.map(model => model.id));
  }).catch(() => null);
}

async function resolveVoiceId(requested, scenario, env, validate) {
  if (!requested || requested === 'default') return defaultVoiceId(scenario, env);
  if (!isProviderId(requested)) throw providerError('INVALID_VOICE_ID', 400);
  if (!validate || Object.keys(SCENARIOS).some(name => defaultVoiceId(name, env) === requested)) return requested;
  const params = new URLSearchParams({ voice_ids: requested, page_size: '1', include_total_count: 'false' });
  const body = await cacheCatalog('voice:' + requested, () => elevenLabsJson('/v2/voices?' + params, env));
  if (!body.voices?.some(voice => voice.voice_id === requested)) throw providerError('VOICE_NOT_AVAILABLE', 422);
  return requested;
}

function readLanguage(model, requested) {
  if (requested === 'auto') return null;
  const language = languageCode(requested);
  if (!language || !model.languages.some(item => item.code.toLowerCase() === language)) {
    throw providerError('LANGUAGE_NOT_SUPPORTED_BY_MODEL', 422);
  }
  return language;
}

function pruneSessions() {
  const cutoff = Date.now() - SESSION_TTL_MS;
  for (const [id, session] of sessions) {
    if (Date.parse(session.createdAt) < cutoff) {
      sessions.delete(id);
      sockets.delete(id);
    }
  }
}

function emit(session, type, data = {}) {
  if (!session) return;
  const event = { type, ts: isoNow(), traceId: session.traceId, sessionId: session.sessionId, ...data };
  session.events.push(event);
  const clients = sockets.get(session.sessionId) || [];
  for (const socket of clients) {
    try { socket.send(JSON.stringify(event)); } catch {}
  }
}

function sessionPayload(session) {
  return {
    sessionId: session.sessionId,
    traceId: session.traceId,
    scenario: session.scenario,
    direction: session.direction,
    runtimeMode: session.runtimeMode,
    transport: session.runtimeMode === 'live' ? 'livekit-webrtc' : 'sandbox-webrtc',
    serverUrl: session.runtimeMode === 'live' ? session.serverUrl : null,
    room: session.runtimeMode === 'live' ? session.room : null,
    token: session.token || null,
    status: session.status,
    createdAt: session.createdAt,
    voiceId: session.voiceId,
    language: session.language,
    agentModel: session.agentModel,
    fastModel: session.fastModel,
    slowModel: session.slowModel,
    routing: session.routing,
    asrModel: session.asrModel,
    ttsModel: session.ttsModel,
    voiceConfig: session.voiceConfig
  };
}

function tracePersistence(env) {
  if (env.TRACE_KV) return 'durable_kv';
  if (env.TRACE_DB) return 'durable_d1';
  return 'worker_memory';
}

function traceSnapshot(session, persistence = 'worker_memory') {
  return { session: sessionPayload(session), events: session.events, persistence };
}

async function ensureTraceDb(env) {
  if (!env.TRACE_DB) return false;
  if (!traceDbSchemaPromise) {
    traceDbSchemaPromise = env.TRACE_DB.prepare(
      'CREATE TABLE IF NOT EXISTS ' + TRACE_DB_TABLE + ' (' +
      'session_id TEXT PRIMARY KEY, ' +
      'trace_id TEXT NOT NULL, ' +
      'payload TEXT NOT NULL, ' +
      'created_at TEXT NOT NULL, ' +
      'updated_at TEXT NOT NULL)'
    ).run().then(() => true).catch((error) => {
      traceDbSchemaPromise = null;
      throw error;
    });
  }
  return traceDbSchemaPromise;
}

async function readTraceFromDb(sessionId, env) {
  if (!env.TRACE_DB) return null;
  await ensureTraceDb(env);
  const row = await env.TRACE_DB
    .prepare('SELECT payload, created_at FROM ' + TRACE_DB_TABLE + ' WHERE session_id = ?')
    .bind(sessionId)
    .first()
    .catch(() => null);
  if (!row?.payload) return null;
  try {
    const snapshot = JSON.parse(row.payload);
    if (snapshot?.session && !snapshot.session.createdAt && row.created_at) snapshot.session.createdAt = row.created_at;
    return snapshot;
  } catch { return null; }
}

async function persistSession(session, env) {
  if (!session) return;
  if (env.TRACE_KV) {
    const ttl = session.status === 'ended' ? undefined : { expirationTtl: 3 * 3600 };
    await env.TRACE_KV.put('voice-trace:' + session.sessionId, JSON.stringify(traceSnapshot(session, 'durable_kv')), ttl);
    return;
  }
  if (!env.TRACE_DB) return;
  await ensureTraceDb(env);
  const payload = JSON.stringify(traceSnapshot(session, 'durable_d1'));
  await env.TRACE_DB.prepare(
    'INSERT INTO ' + TRACE_DB_TABLE + ' (session_id, trace_id, payload, created_at, updated_at) ' +
    'VALUES (?, ?, ?, ?, ?) ' +
    'ON CONFLICT(session_id) DO UPDATE SET ' +
    'trace_id = excluded.trace_id, payload = excluded.payload, updated_at = excluded.updated_at'
  ).bind(session.sessionId, session.traceId, payload, session.createdAt, isoNow()).run();
}

async function loadSession(sessionId, env) {
  pruneSessions();
  const inMemory = sessions.get(sessionId);
  if (inMemory) return inMemory;
  let stored = null;
  if (env.TRACE_KV) {
    stored = await env.TRACE_KV.get('voice-trace:' + sessionId, 'json').catch(() => null);
  } else if (env.TRACE_DB) {
    stored = await readTraceFromDb(sessionId, env);
  }
  if (!stored?.session) return null;
  const session = { ...stored.session, id: stored.session.sessionId, createdAt: stored.session.createdAt || stored.createdAt || isoNow(), events: Array.isArray(stored.events) ? stored.events : [] };
  sessions.set(sessionId, session);
  return session;
}

const cors = (env, origin = '') => ({
  'access-control-allow-origin': (env.CORS_ORIGIN || 'https://flappylz.github.io').split(',').map((item) => item.trim()).includes(origin) ? origin : (env.CORS_ORIGIN || 'https://flappylz.github.io').split(',')[0].trim(),
  'access-control-allow-headers': 'content-type, authorization',
  'access-control-allow-methods': 'GET,POST,OPTIONS',
  'cache-control': 'no-store',
  'vary': 'Origin'
});

const json = (body, status = 200, env, origin = '') => new Response(JSON.stringify(body), {
  status,
  headers: { 'content-type': 'application/json; charset=utf-8', 'x-content-type-options': 'nosniff', 'referrer-policy': 'strict-origin-when-cross-origin', ...cors(env, origin) }
});

const runtimeLanding = (env, origin = '') => new Response(`<!doctype html>
<html lang="zh-CN">
  <head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>冯良泽AI · Voice Runtime</title>
  <style>body{margin:0;background:#0b1118;color:#e8eef5;font-family:Inter,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}main{max-width:760px;margin:12vh auto;padding:32px}h1{font-size:40px;margin:0 0 12px}p{color:#a9b6c5;line-height:1.6}.status{display:inline-flex;gap:8px;align-items:center;color:#c7ff3d;font-weight:700}.dot{width:9px;height:9px;border-radius:50%;background:#c7ff3d;box-shadow:0 0 18px #c7ff3d}.links{display:flex;gap:12px;flex-wrap:wrap;margin-top:28px}.links a{color:#0b1118;background:#c7ff3d;padding:12px 16px;text-decoration:none;font-weight:700}.links a.secondary{color:#d7e4ef;background:#17222d;border:1px solid #344554}</style></head>
  <body><main><div class="status"><span class="dot"></span>VOICE RUNTIME ONLINE</div><h1>冯良泽AI · Voice Runtime</h1><p>实时语音 Demo 的服务端入口。LiveKit WebRTC、ElevenLabs 流式 TTS、会话 Trace 和持久化日志由此提供。</p><div class="links"><a href="https://flappylz.github.io/ai-portfolio/">打开作品集</a><a class="secondary" href="/api/health">查看运行状态</a></div></main></body>
</html>`, {
  status: 200,
  headers: { 'content-type': 'text/html; charset=utf-8', 'x-content-type-options': 'nosniff', 'referrer-policy': 'strict-origin-when-cross-origin', ...cors(env, origin) }
});

const base64url = (value) => btoa(String.fromCharCode(...new Uint8Array(value)))
  .replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
const encodeJson = (value) => base64url(new TextEncoder().encode(JSON.stringify(value)));

async function signJwt(payload, secret) {
  const header = encodeJson({ alg: 'HS256', typ: 'JWT' });
  const encodedPayload = encodeJson(payload);
  const data = new TextEncoder().encode(`${header}.${encodedPayload}`);
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const signature = await crypto.subtle.sign('HMAC', key, data);
  return `${header}.${encodedPayload}.${base64url(signature)}`;
}

function liveConfig(env, scenario) {
  const missing = ['LIVEKIT_URL', 'LIVEKIT_API_KEY', 'LIVEKIT_API_SECRET', 'LIVEKIT_AGENT_ID', 'ELEVENLABS_API_KEY'];
  return missing.filter((key) => !env[key]);
}

async function voiceCatalog(request, env) {
  const origin = request.headers.get('Origin') || '';
  if (!enforceRateLimit(request, 'catalog', 60)) return json({ error: 'RATE_LIMITED' }, 429, env, origin);
  const [ttsResult, openAIResult] = await Promise.allSettled([readTtsModels(env), readOpenAIModels(env)]);
  const models = openAIResult.status === 'fulfilled' ? openAIResult.value : null;
  const defaultModel = providerId(DEFAULT_FAST_MODEL);
  const llmModels = LLM_MODELS.filter(id => models?.has(id) || id === defaultModel).map(llmCapability);
  const asrModels = OPENAI_ASR_MODELS.filter(id => models?.has(id) || id === providerId(DEFAULT_ASR_MODEL))
    .map(id => ({
      id: 'openai/' + id, name: id,
      capabilities: { prompt: id !== 'gpt-realtime-whisper', keyterms: ['gpt-live-transcribe', 'gpt-transcribe'].includes(id), noiseReduction: true }
    }));
  // A TTS-scoped credential alone does not demonstrate speech-to-text access.
  if (env.ELEVENLABS_API_KEY && env.ELEVENLABS_STT_ENABLED === 'true') {
    asrModels.push({ id: 'elevenlabs/scribe_v2_realtime', name: 'Scribe v2 Realtime', capabilities: { sampleRate: true, chunkMs: true, timestamps: true } });
  }
  const ttsModels = ttsResult.status === 'fulfilled' ? ttsResult.value : [];
  return json({
    defaults: { fastModel: DEFAULT_FAST_MODEL, slowModel: DEFAULT_FAST_MODEL, asrModel: DEFAULT_ASR_MODEL, ttsModel: DEFAULT_TTS_MODEL, language: 'zh', reasoningEffort: 'low' },
    llmModels,
    asrModels,
    ttsModels,
    ttsCatalogError: ttsResult.status === 'rejected' ? ttsResult.reason.message : null
  }, 200, env, origin);
}

async function voicesCatalog(request, env, url) {
  const origin = request.headers.get('Origin') || '';
  if (!enforceRateLimit(request, 'voices', 60)) return json({ error: 'RATE_LIMITED' }, 429, env, origin);
  const shared = url.searchParams.get('scope') === 'shared';
  const cursor = url.searchParams.get('cursor') || '';
  const query = new URLSearchParams({ page_size: '30' });
  for (const key of ['search', 'language', 'accent']) {
    const value = url.searchParams.get(key)?.trim().slice(0, 80);
    if (value) query.set(key, value);
  }
  const sharedPage = /^\d{1,5}$/.test(cursor) ? Number(cursor) : 0;
  if (shared) {
    query.set('page', String(sharedPage));
    query.set('sort', 'trending');
  } else {
    query.set('include_total_count', 'false');
    if (cursor) query.set('next_page_token', cursor.slice(0, 512));
  }
  const path = (shared ? '/v1/shared-voices' : '/v2/voices') + '?' + query;
  try {
    const body = await cacheCatalog(path, () => elevenLabsJson(path, env));
    const voices = (body.voices || []).filter(voice => isProviderId(voice.voice_id)).map(voice => {
      const language = voice.language || voice.labels?.language || '';
      const accent = voice.accent || voice.labels?.accent || '';
      const previewUrl = /^https:\/\//.test(voice.preview_url || '') ? voice.preview_url : null;
      return {
        id: voice.voice_id, name: voice.name, language, accent, category: voice.category || '',
        previewUrl, selectable: !shared
      };
    });
    return json({ voices, nextCursor: body.has_more ? (shared ? String(sharedPage + 1) : body.next_page_token || null) : null }, 200, env, origin);
  } catch (error) {
    return json({ error: error.message }, error.status || 502, env, origin);
  }
}

function previewVoiceSettings(config, model) {
  const caps = model.capabilities;
  return {
    stability: config.stability,
    ...(caps.similarity ? { similarity_boost: config.similarity } : {}),
    ...(caps.style ? { style: config.style } : {}),
    ...(caps.speed ? { speed: config.speed } : {}),
    ...(caps.speakerBoost ? { use_speaker_boost: config.useSpeakerBoost } : {})
  };
}

async function previewTts(request, env) {
  const origin = request.headers.get('Origin') || '';
  if (!enforceRateLimit(request, 'preview', 10)) return json({ error: 'RATE_LIMITED' }, 429, env, origin);
  if (Number(request.headers.get('content-length') || 0) > 8192) return json({ error: 'REQUEST_TOO_LARGE' }, 413, env, origin);
  const input = await request.json().catch(() => null);
  if (!input || typeof input !== 'object') return json({ error: 'INVALID_PREVIEW_REQUEST' }, 400, env, origin);
  const scenario = input.scenario || 'carrier';
  if (!Object.hasOwn(SCENARIOS, scenario)) return json({ error: 'UNKNOWN_SCENARIO' }, 400, env, origin);
  const ttsModel = input.ttsModel || DEFAULT_TTS_MODEL;
  const language = languageCode(input.language, 'zh');
  const config = normalizeVoiceConfig(input.voiceConfig, { language, fastModel: DEFAULT_FAST_MODEL, slowModel: DEFAULT_FAST_MODEL });
  const previewLanguage = config.ttsLanguage === 'auto' ? language : config.ttsLanguage;
  const customText = typeof input.text === 'string' ? input.text.trim() : '';
  const text = customText || PREVIEW_TEXT[previewLanguage]?.[scenario];
  if (!text || text.length > 240) return json({ error: 'PREVIEW_REQUIRES_1_TO_240_CHARACTERS' }, 400, env, origin);
  try {
    const [voiceId, models] = await Promise.all([resolveVoiceId(input.voiceId, scenario, env, true), readTtsModels(env)]);
    const model = models.find(item => item.id === ttsModel);
    if (!model) throw providerError('TTS_MODEL_NOT_AVAILABLE', 422);
    const ttsLanguage = readLanguage(model, config.ttsLanguage);
    const dialogue = model.transport === 'dialogue-websocket';
    const settings = previewVoiceSettings(config, model);
    const options = {
      model_id: model.id,
      ...(ttsLanguage ? { language_code: ttsLanguage } : {}),
      apply_text_normalization: config.applyTextNormalization
    };
    const body = dialogue ? {
      ...options, inputs: [{ text, voice_id: voiceId }], settings
    } : {
      ...options, text, voice_settings: settings,
      ...(config.applyLanguageTextNormalization ? { apply_language_text_normalization: true } : {}),
      ...(config.pronunciationDictionaries.length ? { pronunciation_dictionary_locators: config.pronunciationDictionaries } : {})
    };
    const path = dialogue ? '/v1/text-to-dialogue/stream' : '/v1/text-to-speech/' + encodeURIComponent(voiceId) + '/stream';
    const response = await fetch('https://api.elevenlabs.io' + path + '?output_format=mp3_44100_128', {
      method: 'POST', headers: { 'xi-api-key': env.ELEVENLABS_API_KEY, 'content-type': 'application/json', accept: 'audio/mpeg' },
      body: JSON.stringify(body), signal: AbortSignal.timeout(20000)
    });
    if (!response.ok) {
      const error = await response.json().catch(() => null);
      throw providerError(safeProviderCode(error, 'ELEVENLABS_HTTP_' + response.status), response.status < 500 ? response.status : 502);
    }
    return new Response(response.body, {
      headers: { 'content-type': 'audio/mpeg', 'x-content-type-options': 'nosniff', ...cors(env, origin) }
    });
  } catch (error) {
    return json({ error: error.status ? error.message : 'ELEVENLABS_PREVIEW_UNAVAILABLE' }, error.status || 502, env, origin);
  }
}

async function createSession(request, env) {
  if (!enforceRateLimit(request)) return json({ error: 'RATE_LIMITED', retryAfterSeconds: 60 }, 429, env, request.headers.get('Origin') || '');
  if (Number(request.headers.get('content-length') || 0) > 32768) return json({ error: 'REQUEST_TOO_LARGE' }, 413, env, request.headers.get('Origin') || '');
  const body = await request.json().catch(() => null);
  const scenario = String(body?.scenario || '').toLowerCase();
  if (!Object.hasOwn(SCENARIOS, scenario)) return json({ error: 'UNKNOWN_SCENARIO' }, 400, env, request.headers.get('Origin') || '');
  const direction = body.direction || SCENARIOS[scenario].direction;
  const runtimeMode = body.runtimeMode || 'live';
  if (!['inbound', 'outbound'].includes(direction)) return json({ error: 'INVALID_DIRECTION' }, 400, env);
  if (!['live', 'sandbox'].includes(runtimeMode)) return json({ error: 'INVALID_RUNTIME_MODE' }, 400, env);
  const sessionId = crypto.randomUUID();
  const traceId = `trace_${crypto.randomUUID().replaceAll('-', '').slice(0, 16)}`;
  if (runtimeMode === 'live') {
    const missing = liveConfig(env, scenario);
    if (missing.length) return json({ error: 'LIVE_CREDENTIALS_MISSING', missing, runtimeMode: 'sandbox' }, 503, env);
  }
  const language = languageCode(body.language, 'zh');
  const fastModel = responseModelId(body.fastModel || body.agentModel);
  const slowModel = responseModelId(body.slowModel);
  const asrModel = asrModelId(body.asrModel);
  const ttsModel = body.ttsModel || body.model || DEFAULT_TTS_MODEL;
  const voiceConfig = normalizeVoiceConfig(body.voiceConfig, { language, fastModel, slowModel });
  let voiceId;
  try {
    if (!TTS_MODELS.includes(ttsModel)) throw providerError('TTS_MODEL_NOT_AVAILABLE', 422);
    if (runtimeMode === 'live' && asrModel.startsWith('elevenlabs/') && env.ELEVENLABS_STT_ENABLED !== 'true') {
      throw providerError('ELEVENLABS_STT_UNAVAILABLE', 422);
    }
    voiceId = await resolveVoiceId(body.voiceId, scenario, env, runtimeMode === 'live');
    if (runtimeMode === 'live' && (ttsModel !== DEFAULT_TTS_MODEL || !['auto', 'zh', 'en', 'ar'].includes(voiceConfig.ttsLanguage))) {
      const model = (await readTtsModels(env)).find(item => item.id === ttsModel);
      if (!model) throw providerError('TTS_MODEL_NOT_AVAILABLE', 422);
      readLanguage(model, voiceConfig.ttsLanguage);
    }
  } catch (error) {
    return json({ error: error.status ? error.message : 'VOICE_CONFIGURATION_UNAVAILABLE' }, error.status || 502, env, request.headers.get('Origin') || '');
  }
  const metadata = { scenario, direction, sessionId, traceId, language, voiceId, agentModel: fastModel, fastModel, slowModel, asrModel, ttsModel, voiceConfig };
  const room = `fengliangze-${scenario}-${sessionId.slice(0, 8)}`;
  const identity = `visitor-${sessionId.slice(0, 8)}`;
  const now = Math.floor(Date.now() / 1000);
  const token = runtimeMode === 'live' ? await signJwt({
    iss: env.LIVEKIT_API_KEY,
    sub: identity,
    name: 'Portfolio visitor',
    nbf: now - 5,
    exp: now + 600,
    video: { roomJoin: true, room, canPublish: true, canSubscribe: true, canPublishData: true },
    roomConfig: { agents: [{ agentName: env.LIVEKIT_AGENT_ID, metadata: JSON.stringify(metadata) }] }
  }, env.LIVEKIT_API_SECRET) : null;
  const session = {
    ...metadata,
    runtimeMode,
    room,
    serverUrl: env.LIVEKIT_URL || null,
    token,
    status: direction === 'outbound' ? 'ringing' : 'dialing',
    routing: 'fast_voice+slow_validation',
    createdAt: isoNow(),
    events: []
  };
  sessions.set(sessionId, session);
  emit(session, 'session_created', { direction, runtimeMode, transport: session.runtimeMode === 'live' ? 'livekit-webrtc' : 'sandbox-webrtc' });
  if (runtimeMode === 'live') {
    emit(session, 'token_issued', { expiresIn: 600 });
    emit(session, 'ice_checking');
  } else {
    emit(session, direction === 'outbound' ? 'ringing' : 'dialing');
    emit(session, 'sandbox_notice', { simulated: true });
  }
  await persistSession(session, env);
  return json({ session: sessionPayload(session) }, 201, env, request.headers.get('Origin') || '');
}

async function eventsSocket(request, env) {
  const sessionId = new URL(request.url).searchParams.get('sessionId');
  const session = await loadSession(sessionId, env);
  if (!session) return json({ error: 'SESSION_NOT_FOUND' }, 404, env);
  if (request.headers.get('Upgrade')?.toLowerCase() !== 'websocket') return json({ error: 'WEBSOCKET_REQUIRED' }, 426, env);
  const pair = new WebSocketPair();
  const client = pair[0];
  const server = pair[1];
  server.accept();
  const clients = sockets.get(sessionId) || [];
  clients.push(server);
  sockets.set(sessionId, clients);
  for (const event of session.events) {
    try { server.send(JSON.stringify(event)); } catch {}
  }
  const cleanup = () => sockets.set(sessionId, (sockets.get(sessionId) || []).filter((item) => item !== server));
  server.addEventListener('close', cleanup);
  server.addEventListener('error', cleanup);
  return new Response(null, { status: 101, webSocket: client, headers: cors(env) });
}

async function updateSession(request, env, action) {
  const origin = request.headers.get('Origin') || '';
  const body = await request.json().catch(() => null);
  const session = await loadSession(body?.sessionId, env);
  if (!session) return json({ error: 'SESSION_NOT_FOUND' }, 404, env);
  if (action === 'end' && session.status === 'ended') {
    return json({ session: sessionPayload(session), status: session.status, event: 'ended', traceStore: tracePersistence(env) }, 200, env, origin);
  }
  if (action === 'answer') {
    session.status = 'connecting';
    emit(session, 'call_answered');
    emit(session, 'ice_checking');
  } else {
    session.status = 'ended';
    emit(session, 'ended', { reason: body?.reason || 'user' });
  }
  await persistSession(session, env);
  return json({ session: sessionPayload(session), status: session.status, event: action === 'answer' ? 'call_answered' : 'ended', traceStore: tracePersistence(env) }, 200, env, origin);
}

async function ingestEvent(request, env, sessionId) {
  const origin = request.headers.get('Origin') || '';
  if (!enforceRateLimit(request, 'trace', TRACE_REQUEST_LIMIT)) return json({ error: 'RATE_LIMITED', retryAfterSeconds: 60 }, 429, env, origin);
  if (Number(request.headers.get('content-length') || 0) > TRACE_BATCH_BYTES) return json({ error: 'REQUEST_TOO_LARGE' }, 413, env, origin);
  const raw = await request.text().catch(() => '');
  if (new TextEncoder().encode(raw).length > TRACE_BATCH_BYTES) return json({ error: 'REQUEST_TOO_LARGE' }, 413, env, origin);
  let body;
  try { body = JSON.parse(raw); } catch { return json({ error: 'INVALID_TRACE_EVENT' }, 400, env, origin); }
  const session = await loadSession(sessionId, env);
  if (!session) return json({ error: 'SESSION_NOT_FOUND' }, 404, env, origin);
  if (!body || body.traceId !== session.traceId) return json({ error: 'INVALID_TRACE_EVENT' }, 400, env, origin);
  const events = Array.isArray(body.events) ? body.events : [body];
  if (events.length === 0 || events.length > TRACE_BATCH_LIMIT) return json({ error: 'INVALID_TRACE_BATCH_SIZE' }, 400, env, origin);
  const sanitized = [];
  const eventIds = new Set(session.events.map(event => event.eventId).filter(Boolean));
  for (const event of events) {
    if (!event || !TRACE_EVENT_TYPES.has(event.type) || (event.sessionId && event.sessionId !== sessionId) || (event.traceId && event.traceId !== session.traceId)) {
      return json({ error: 'INVALID_TRACE_EVENT' }, 400, env, origin);
    }
    const { type, traceId, sessionId: _sessionId, ts, eventId, ...data } = event;
    if (eventId && !isProviderId(eventId)) return json({ error: 'INVALID_TRACE_EVENT_ID' }, 400, env, origin);
    if (eventIds.has(eventId)) continue;
    if (eventId) eventIds.add(eventId);
    if (JSON.stringify(data).length > 12000) return json({ error: 'TRACE_EVENT_TOO_LARGE' }, 413, env, origin);
    const eventTime = Math.abs(Date.now() - Date.parse(ts)) < 7200000 ? new Date(ts).toISOString() : isoNow();
    sanitized.push({ type, data: { ...data, ...(eventId ? { eventId } : {}), ts: eventTime } });
  }
  for (const { type, data } of sanitized) emit(session, type, data);
  if (sanitized.length) await persistSession(session, env);
  return json({ ok: true, traceStore: tracePersistence(env), accepted: sanitized.length, event: session.events.at(-1) }, 202, env, origin);
}

function traceResponse(session, env, origin) {
  const persistence = tracePersistence(env);
  const { token, ...publicSession } = sessionPayload(session);
  return json({
    session: publicSession,
    events: session.events,
    persistence,
    warning: persistence === 'worker_memory' ? 'Trace resets when the worker isolate is recycled.' : null,
  }, 200, env, origin);
}

function responseText(payload) {
  const parts = Array.isArray(payload?.output) ? payload.output.flatMap((item) => Array.isArray(item?.content) ? item.content : []) : [];
  return parts.filter((item) => item?.type === 'output_text').map((item) => item.text || '').join('').trim().slice(0, 4000);
}

async function openAIRespond(request, env) {
  if (!enforceRateLimit(request)) return json({ error: 'RATE_LIMITED', retryAfterSeconds: 60 }, 429, env, request.headers.get('Origin') || '');
  if (Number(request.headers.get('content-length') || 0) > 32768) return json({ error: 'REQUEST_TOO_LARGE' }, 413, env, request.headers.get('Origin') || '');
  if (!env.OPENAI_API_KEY) return json({ configured: false, verified: false, status: null, code: 'MISSING_SECRET' }, 503, env);
  const body = await request.json().catch(() => null);
  const model = String(body?.model || env.OPENAI_MODEL || 'gpt-4.1-mini').trim();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);
  try {
    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: { authorization: `Bearer ${env.OPENAI_API_KEY}`, accept: 'application/json', 'content-type': 'application/json' },
      body: JSON.stringify({ model, input: String(body?.input || '').slice(0, 6000), max_output_tokens: 64 }),
      signal: controller.signal
    });
    const payload = await response.json().catch(() => null);
    const code = payload?.error?.code || payload?.error?.type || `HTTP_${response.status}`;
    return json(response.ok ? { configured: true, verified: true, status: response.status, code: null, responseId: payload?.id || null, model, text: responseText(payload) } : { configured: true, verified: false, status: response.status, code: String(code).replace(/[^A-Za-z0-9_.-]/g, '_').slice(0, 120) }, response.ok ? 200 : 502, env);
  } catch (error) {
    return json({ configured: true, verified: false, status: null, code: error?.name === 'AbortError' ? 'TIMEOUT' : 'UPSTREAM_UNREACHABLE' }, 502, env);
  } finally {
    clearTimeout(timer);
  }
}

async function ttsSocket(request, env) {
  const origin = request.headers.get('Origin') || '';
  if (!enforceRateLimit(request, 'legacy-tts', 10)) return json({ error: 'RATE_LIMITED', retryAfterSeconds: 60 }, 429, env, origin);
  if (!env.ELEVENLABS_API_KEY) return json({ error: 'ELEVENLABS_CREDENTIALS_MISSING' }, 503, env, origin);
  const url = new URL(request.url);
  const scenario = url.searchParams.get('scenario') || 'carrier';
  if (!Object.hasOwn(SCENARIOS, scenario)) return json({ error: 'UNKNOWN_SCENARIO' }, 400, env, origin);
  const modelId = url.searchParams.get('modelId') || DEFAULT_TTS_MODEL;
  const language = languageCode(url.searchParams.get('language'), 'zh');
  const config = normalizeVoiceConfig(Object.fromEntries(url.searchParams), { language, fastModel: DEFAULT_FAST_MODEL, slowModel: DEFAULT_FAST_MODEL });
  let voiceId;
  let model;
  let upstreamUrl;
  let upstream;
  try {
    const [resolvedVoiceId, models] = await Promise.all([resolveVoiceId(url.searchParams.get('voiceId'), scenario, env, true), readTtsModels(env)]);
    voiceId = resolvedVoiceId;
    model = models.find(item => item.id === modelId);
    if (!model) throw providerError('TTS_MODEL_NOT_AVAILABLE', 422);
    if (model.transport !== 'websocket') throw providerError('USE_HTTP_PREVIEW_FOR_DIALOGUE_MODEL', 422);
    const ttsLanguage = readLanguage(model, config.ttsLanguage);
    upstreamUrl = new URL('https://api.elevenlabs.io/v1/text-to-speech/' + encodeURIComponent(voiceId) + '/stream-input');
    upstreamUrl.searchParams.set('model_id', model.id);
    if (ttsLanguage) upstreamUrl.searchParams.set('language_code', ttsLanguage);
    // The legacy browser decodes chunks as MP3. New calls can configure PCM in LiveKit.
    const outputFormat = config.outputFormat.startsWith('mp3_') ? config.outputFormat : 'mp3_44100_128';
    upstreamUrl.searchParams.set('output_format', outputFormat);
    upstreamUrl.searchParams.set('apply_text_normalization', config.applyTextNormalization);
    upstreamUrl.searchParams.set('sync_alignment', 'true');
    upstream = await fetch(upstreamUrl, {
      headers: { Upgrade: 'websocket', 'xi-api-key': env.ELEVENLABS_API_KEY },
      signal: AbortSignal.timeout(8000)
    });
  } catch (error) {
    return json({ error: error.status ? error.message : 'ELEVENLABS_UPSTREAM_UNAVAILABLE' }, error.status || 502, env, origin);
  }
  if (upstream.status !== 101 || !upstream.webSocket) return json({ error: 'ELEVENLABS_UPSTREAM_UNAVAILABLE', status: upstream.status }, 502, env, origin);
  const pair = new WebSocketPair();
  const client = pair[0];
  const browser = pair[1];
  browser.accept();
  upstream.webSocket.accept();
  const started = Date.now();
  let firstAudio = false;
  const send = (message) => { try { if (browser.readyState === 1) browser.send(JSON.stringify(message)); } catch {} };
  const voiceSettings = previewVoiceSettings(config, model);
  const schedule = normalizedSchedule(config.chunkSchedule);
  const generationConfig = { chunk_length_schedule: schedule };
  try { upstream.webSocket.send(JSON.stringify({ text: ' ', voice_settings: voiceSettings, generation_config: generationConfig })); } catch {}
  send({ type: 'tts_ready', voiceId, modelId: upstreamUrl.searchParams.get('model_id'), outputFormat: upstreamUrl.searchParams.get('output_format') });
  let textBudget = 1200;
  browser.addEventListener('message', (event) => {
    let message;
    try { message = JSON.parse(typeof event.data === 'string' ? event.data : new TextDecoder().decode(event.data)); } catch { return send({ type: 'error', code: 'INVALID_JSON' }); }
    try {
      if (message.type === 'text') {
        const text = typeof message.text === 'string' ? message.text.slice(0, textBudget) : '';
        if (!text.trim()) return;
        textBudget -= text.length;
        upstream.webSocket.send(JSON.stringify({ text: text.endsWith(' ') ? text : text + ' ', flush: Boolean(message.flush), try_trigger_generation: Boolean(message.tryTriggerGeneration) }));
      } else if (message.type === 'flush') {
        upstream.webSocket.send(JSON.stringify({ text: ' ', flush: true }));
      } else if (message.type === 'end') {
        upstream.webSocket.send(JSON.stringify({ text: '' }));
      } else if (message.type === 'keep_alive') {
        upstream.webSocket.send(JSON.stringify({ text: ' ' }));
      }
    } catch { send({ type: 'error', code: 'TTS_NOT_READY' }); }
  });
  upstream.webSocket.addEventListener('message', (event) => {
    let message;
    try { message = JSON.parse(typeof event.data === 'string' ? event.data : new TextDecoder().decode(event.data)); } catch { return send({ type: 'error', code: 'ELEVENLABS_INVALID_FRAME' }); }
    if (message.error || message.code === 1008) return send({ type: 'error', code: 'ELEVENLABS_UPSTREAM_ERROR' });
    const isFinal = Boolean(message.isFinal || message.is_final);
    if (message.audio) {
      if (!firstAudio) {
        firstAudio = true;
        send({ type: 'tts_first_byte', ttfbMs: Math.max(1, Date.now() - started) });
      }
      send({ type: 'audio', audio: message.audio, alignment: message.alignment || null, isFinal });
    }
    if (isFinal) send({ type: 'tts_final' });
  });
  upstream.webSocket.addEventListener('error', () => send({ type: 'error', code: 'ELEVENLABS_UPSTREAM_ERROR' }));
  upstream.webSocket.addEventListener('close', () => { send({ type: 'tts_closed' }); try { browser.close(); } catch {} });
  const timer = setTimeout(() => closeBoth(), 25000);
  const closeBoth = () => { clearTimeout(timer); try { browser.close(); } catch {} try { upstream.webSocket.close(); } catch {} };
  browser.addEventListener('close', closeBoth);
  browser.addEventListener('error', closeBoth);
  return new Response(null, { status: 101, webSocket: client, headers: cors(env, origin) });
}

async function probeElevenLabs(env) {
  if (!env.ELEVENLABS_API_KEY) return { configured: false, verified: false, status: null, code: 'MISSING_SECRET' };
  try {
    const voiceId = env.ELEVENLABS_VOICE_ID_CARRIER || SCENARIOS.carrier.fallbackVoice;
    const endpoint = `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}/stream-input?model_id=eleven_flash_v2_5&language_code=zh&output_format=mp3_44100_128`;
    const response = await fetch(endpoint, { headers: { Upgrade: 'websocket', 'xi-api-key': env.ELEVENLABS_API_KEY } });
    if (response.status !== 101 || !response.webSocket) return { configured: true, verified: false, status: response.status, code: `HTTP_${response.status}` };
    const socket = response.webSocket;
    socket.accept();
    return await new Promise((resolve) => {
      let settled = false;
      const finish = (result) => { if (settled) return; settled = true; clearTimeout(timer); try { socket.close(); } catch {} resolve(result); };
      const timer = setTimeout(() => finish({ configured: true, verified: true, status: 101, code: null }), 1200);
      socket.addEventListener('message', (event) => {
        try {
          const message = JSON.parse(typeof event.data === 'string' ? event.data : new TextDecoder().decode(event.data));
          if (message.error || message.code === 1008) return finish({ configured: true, verified: false, status: 400, code: String(message.code || message.error || 'UPSTREAM_ERROR').slice(0, 100) });
          if (message.audio) finish({ configured: true, verified: true, status: 101, code: null });
        } catch {}
      });
      socket.addEventListener('error', () => finish({ configured: true, verified: false, status: null, code: 'UPSTREAM_UNREACHABLE' }));
      try { socket.send(JSON.stringify({ text: ' ' })); } catch { finish({ configured: true, verified: false, status: null, code: 'UPSTREAM_UNREACHABLE' }); }
    });
  } catch {
    return { configured: true, verified: false, status: null, code: 'UPSTREAM_UNREACHABLE' };
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(env, request.headers.get('Origin') || '') });
    if (request.method === 'GET' && url.pathname === '/') return runtimeLanding(env, request.headers.get('Origin') || '');
    if (request.method === 'GET' && url.pathname === '/favicon.ico') return new Response(null, { status: 204, headers: cors(env) });
    if (request.method === 'GET' && url.pathname === '/api/health') {
      const body = { ok: true, service: 'voice-runtime-worker', config: { livekit: Boolean(env.LIVEKIT_URL && env.LIVEKIT_API_KEY && env.LIVEKIT_API_SECRET && env.LIVEKIT_AGENT_ID), elevenlabs: Boolean(env.ELEVENLABS_API_KEY), traceStore: tracePersistence(env) } };
      if (url.searchParams.get('probe') === '1') body.elevenlabsProbe = await probeElevenLabs(env);
      return json(body, 200, env);
    }
    if (request.method === 'POST' && url.pathname === '/api/ai/respond') return openAIRespond(request, env);
    if (request.method === 'GET' && url.pathname === '/api/voice/catalog') return voiceCatalog(request, env);
    if (request.method === 'GET' && url.pathname === '/api/voice/catalog/voices') return voicesCatalog(request, env, url);
    if (request.method === 'POST' && url.pathname === '/api/voice/preview') return previewTts(request, env);
    if (request.method === 'POST' && url.pathname === '/api/voice/session') return createSession(request, env);
    if (request.method === 'POST' && url.pathname === '/api/voice/answer') return updateSession(request, env, 'answer');
    if (request.method === 'POST' && url.pathname === '/api/voice/end') return updateSession(request, env, 'end');
    if (request.method === 'POST' && url.pathname.startsWith('/api/voice/session/') && url.pathname.endsWith('/event')) return ingestEvent(request, env, url.pathname.split('/').at(-2));
    if (request.method === 'GET' && url.pathname === '/api/voice/events') return eventsSocket(request, env);
    if (request.method === 'GET' && url.pathname.startsWith('/api/voice/session/') && url.pathname.endsWith('/trace')) {
      const sessionId = url.pathname.split('/').at(-2);
      const session = await loadSession(sessionId, env);
      if (session) return traceResponse(session, env, request.headers.get('Origin') || '');
      return json({ error: 'SESSION_NOT_FOUND' }, 404, env);
    }
    if (url.pathname === '/api/voice/tts' && request.headers.get('Upgrade')?.toLowerCase() === 'websocket') return ttsSocket(request, env);
    if (url.pathname === '/api/voice/tts') return json({ error: 'WEBSOCKET_REQUIRED', endpoint: '/api/voice/tts' }, 426, env);
    return json({ error: 'NOT_FOUND' }, 404, env);
  }
};

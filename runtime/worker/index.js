const SCENARIOS = {
  carrier: { direction: 'inbound', voiceKey: 'ELEVENLABS_VOICE_ID_CARRIER', fallbackVoice: 'JBFqnCBsd6RMkjVDRZzb' },
  airline: { direction: 'inbound', voiceKey: 'ELEVENLABS_VOICE_ID_AIRLINE', fallbackVoice: '21m00Tcm4TlvDq8ikWAM' },
  football: { direction: 'outbound', voiceKey: 'ELEVENLABS_VOICE_ID_FOOTBALL', fallbackVoice: 'JBFqnCBsd6RMkjVDRZzb' }
};

// The isolate cache keeps active sessions fast. TRACE_DB is the durable
// cross-instance store provisioned by Sites. TRACE_KV remains supported for
// environments that already expose a Cloudflare KV namespace.
const sessions = new Map();
const sockets = new Map();
const isoNow = () => new Date().toISOString();
const SESSION_TTL_MS = 15 * 60 * 1000;
const TRACE_DB_TABLE = 'voice_trace_sessions';
let traceDbSchemaPromise = null;
const REQUEST_WINDOW_MS = 60 * 1000;
const REQUEST_LIMIT = 12;
const requestWindows = new Map();
const TRACE_EVENT_TYPES = new Set(['agent_joined', 'listening', 'speech_started', 'speech_stopped', 'partial_transcript', 'final_transcript', 'knowledge_hit', 'tool_call', 'handoff', 'tts_started', 'tts_first_byte', 'tts_text_delta', 'tts_text', 'speaking', 'barge_in', 'interrupted', 'deep_started', 'deep_result', 'deep_result_used', 'deep_error', 'metrics', 'error', 'ended']);
const resolveAgentModel = (requested, env) => String(requested || '').includes('/') && !String(requested).includes('sandbox') && !String(requested).includes('Chrome') ? String(requested) : (env.LIVEKIT_LLM_MODEL || 'openai/gpt-4.1-mini');
const resolveFastModel = (requested, env) => String(requested || '').includes('/') && !String(requested).includes('sandbox') && !String(requested).includes('Chrome') ? String(requested) : (env.LIVEKIT_FAST_LLM_MODEL || env.LIVEKIT_LLM_MODEL || 'openai/gpt-4.1-mini');
const resolveSlowModel = (requested, env) => String(requested || '').includes('/') && !String(requested).includes('sandbox') && !String(requested).includes('Chrome') ? String(requested) : (env.LIVEKIT_SLOW_LLM_MODEL || 'openai/gpt-4.1-mini');
const resolveAsrModel = (requested, env) => String(requested || '').includes('/') && !String(requested).includes('sandbox') && !String(requested).includes('Chrome') ? String(requested) : (env.LIVEKIT_STT_MODEL || 'openai/gpt-live-transcribe');
const resolveTtsModel = (requested, env) => String(requested || '').trim() && !String(requested).includes('sandbox') ? String(requested) : (env.ELEVENLABS_MODEL || 'eleven_flash_v2_5');
const normalizeVoiceConfig = (input = {}) => ({
  interactionType: input.interactionType === 'voice_assistant' ? 'voice_assistant' : 'voice_call',
  vad: ['silero_vad', 'server_vad', 'semantic_vad'].includes(input.vad) ? input.vad : 'silero_vad',
  noiseReduction: input.noiseReduction !== false,
  allowInterruption: input.allowInterruption !== false,
  silenceStrategy: Boolean(input.silenceStrategy),
  voiceprintRecognition: Boolean(input.voiceprintRecognition),
  genderRecognition: Boolean(input.genderRecognition),
  addresseeAwareFiltering: Boolean(input.addresseeAwareFiltering),
  hangupStrategy: Boolean(input.hangupStrategy),
  startWithVoiceCall: Boolean(input.startWithVoiceCall),
  userMessagePosition: input.userMessagePosition === 'bottom' ? 'bottom' : 'right',
  sessionRelevanceRejection: Boolean(input.sessionRelevanceRejection),
  maxCallTime: Math.max(30, Math.min(7200, Number(input.maxCallTime) || 1800)),
  tone: String(input.tone || 'neutral').slice(0, 32),
  emotion: String(input.emotion || 'neutral').slice(0, 32),
  pitch: Number.isFinite(Number(input.pitch)) ? Number(input.pitch) : 1,
  stability: Number.isFinite(Number(input.stability)) ? Number(input.stability) : 0.5,
  similarity: Number.isFinite(Number(input.similarity)) ? Number(input.similarity) : 0.75,
  style: Number.isFinite(Number(input.style)) ? Number(input.style) : 0.2,
  speed: Number.isFinite(Number(input.speed)) ? Number(input.speed) : 1,
  outputFormat: String(input.outputFormat || 'mp3_44100_128').slice(0, 32),
  chunkSchedule: String(input.chunkSchedule || '50,120,160,290').slice(0, 64),
  bargeIn: input.bargeIn === 'semantic_vad' ? 'semantic_vad' : 'server_vad'
});

function clientKey(request) {
  return request.headers.get('cf-connecting-ip') || request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'anonymous';
}

function enforceRateLimit(request) {
  const key = clientKey(request);
  const now = Date.now();
  const bucket = requestWindows.get(key) || { startedAt: now, count: 0 };
  if (now - bucket.startedAt > REQUEST_WINDOW_MS) { bucket.startedAt = now; bucket.count = 0; }
  bucket.count += 1;
  requestWindows.set(key, bucket);
  if (requestWindows.size > 5000) {
    for (const [candidate, value] of requestWindows) if (now - value.startedAt > REQUEST_WINDOW_MS) requestWindows.delete(candidate);
  }
  return bucket.count <= REQUEST_LIMIT;
}

function allowedVoiceIds(env) {
  return new Set(Object.values(SCENARIOS).map(({ voiceKey }) => env[voiceKey]).filter(Boolean));
}

function resolveVoiceId(requested, scenario, env) {
  const fallback = env[SCENARIOS[scenario]?.voiceKey || 'ELEVENLABS_VOICE_ID_CARRIER'] || SCENARIOS[scenario]?.fallbackVoice;
  return requested && allowedVoiceIds(env).has(requested) ? requested : fallback;
}

function allowedTtsModel(requested, env) {
  const configured = (env.ELEVENLABS_ALLOWED_MODELS || 'eleven_flash_v2_5,eleven_turbo_v2_5,eleven_v4_turbo')
    .split(',').map((item) => item.trim()).filter(Boolean);
  return configured.includes(requested) ? requested : (env.ELEVENLABS_MODEL || configured[0]);
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
    await env.TRACE_KV.put('voice-trace:' + session.sessionId, JSON.stringify(traceSnapshot(session, 'durable_kv')), { expirationTtl: Math.ceil(SESSION_TTL_MS / 1000) });
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

async function createSession(request, env) {
  if (!enforceRateLimit(request)) return json({ error: 'RATE_LIMITED', retryAfterSeconds: 60 }, 429, env, request.headers.get('Origin') || '');
  if (Number(request.headers.get('content-length') || 0) > 32768) return json({ error: 'REQUEST_TOO_LARGE' }, 413, env, request.headers.get('Origin') || '');
  const body = await request.json().catch(() => null);
  const scenario = String(body?.scenario || '').toLowerCase();
  if (!SCENARIOS[scenario]) return json({ error: 'UNKNOWN_SCENARIO' }, 400, env);
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
    roomConfig: { agents: [{ agentName: env.LIVEKIT_AGENT_ID, metadata: JSON.stringify({ scenario, direction, sessionId, traceId, language: body.language || 'zh', voiceId: body.voiceId || null, agentModel: resolveFastModel(body.fastModel || body.agentModel, env), fastModel: resolveFastModel(body.fastModel || body.agentModel, env), slowModel: resolveSlowModel(body.slowModel, env), asrModel: resolveAsrModel(body.asrModel, env), ttsModel: resolveTtsModel(body.ttsModel || body.model, env), voiceConfig: normalizeVoiceConfig(body.voiceConfig) }) }] }
  }, env.LIVEKIT_API_SECRET) : null;
  const fastModel = resolveFastModel(body.fastModel || body.agentModel, env);
  const session = { sessionId, traceId, scenario, direction, runtimeMode, room, serverUrl: env.LIVEKIT_URL || null, token, status: direction === 'outbound' ? 'ringing' : 'dialing', voiceId: resolveVoiceId(body.voiceId, scenario, env), agentModel: fastModel, fastModel, slowModel: resolveSlowModel(body.slowModel, env), routing: 'fast_voice+slow_validation', asrModel: resolveAsrModel(body.asrModel, env), ttsModel: resolveTtsModel(body.ttsModel || body.model, env), voiceConfig: normalizeVoiceConfig(body.voiceConfig), createdAt: isoNow(), events: [] };
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
  const body = await request.json().catch(() => null);
  const session = await loadSession(body?.sessionId, env);
  if (!session) return json({ error: 'SESSION_NOT_FOUND' }, 404, env);
  if (action === 'answer') {
    session.status = 'connecting';
    emit(session, 'call_answered');
    emit(session, 'ice_checking');
  } else {
    session.status = 'ended';
    emit(session, 'ended', { reason: body?.reason || 'user' });
  }
  await persistSession(session, env);
  return json({ session: sessionPayload(session), status: session.status, event: action === 'answer' ? 'call_answered' : 'ended' }, 200, env);
}

async function ingestEvent(request, env, sessionId) {
  if (!enforceRateLimit(request)) return json({ error: 'RATE_LIMITED', retryAfterSeconds: 60 }, 429, env, request.headers.get('Origin') || '');
  if (Number(request.headers.get('content-length') || 0) > 32768) return json({ error: 'REQUEST_TOO_LARGE' }, 413, env, request.headers.get('Origin') || '');
  const session = await loadSession(sessionId, env);
  if (!session) return json({ error: 'SESSION_NOT_FOUND' }, 404, env);
  const body = await request.json().catch(() => null);
  if (!body || body.traceId !== session.traceId || !TRACE_EVENT_TYPES.has(body.type)) return json({ error: 'INVALID_TRACE_EVENT' }, 400, env);
  const data = { ...body };
  delete data.type;
  delete data.traceId;
  delete data.sessionId;
  if (JSON.stringify(data).length > 12000) return json({ error: 'TRACE_EVENT_TOO_LARGE' }, 413, env);
  emit(session, body.type, data);
  await persistSession(session, env);
  return json({ ok: true, event: session.events.at(-1) }, 202, env, request.headers.get('Origin') || '');
}

function traceResponse(session, env) {
  const persistence = tracePersistence(env);
  return json({
    session: sessionPayload(session),
    events: session.events,
    persistence,
    warning: persistence === 'worker_memory' ? 'Trace resets when the worker isolate is recycled.' : null,
  }, 200, env);
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
  if (!enforceRateLimit(request)) return json({ error: 'RATE_LIMITED', retryAfterSeconds: 60 }, 429, env, request.headers.get('Origin') || '');
  if (!env.ELEVENLABS_API_KEY) return json({ error: 'ELEVENLABS_CREDENTIALS_MISSING', runtimeMode: 'sandbox' }, 503, env);
  const url = new URL(request.url);
  const scenario = url.searchParams.get('scenario') || 'carrier';
  const voiceId = resolveVoiceId(url.searchParams.get('voiceId'), scenario, env);
  if (!voiceId) return json({ error: 'VOICE_ID_MISSING' }, 503, env);
  const upstreamUrl = new URL(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}/stream-input`);
  upstreamUrl.searchParams.set('model_id', allowedTtsModel(url.searchParams.get('modelId'), env));
  upstreamUrl.searchParams.set('language_code', url.searchParams.get('language') || 'zh');
  upstreamUrl.searchParams.set('output_format', url.searchParams.get('outputFormat') || 'mp3_44100_128');
  const upstream = await fetch(upstreamUrl, { headers: { Upgrade: 'websocket', 'xi-api-key': env.ELEVENLABS_API_KEY } });
  if (upstream.status !== 101 || !upstream.webSocket) return json({ error: 'ELEVENLABS_UPSTREAM_UNAVAILABLE', status: upstream.status }, 502, env);
  const pair = new WebSocketPair();
  const client = pair[0];
  const browser = pair[1];
  browser.accept();
  upstream.webSocket.accept();
  const started = Date.now();
  let firstAudio = false;
  const send = (message) => { try { if (browser.readyState === 1) browser.send(JSON.stringify(message)); } catch {} };
  const voiceSettings = {
    stability: Number(url.searchParams.get('stability') || 0.5),
    similarity_boost: Number(url.searchParams.get('similarity') || 0.8),
    style: Number(url.searchParams.get('style') || 0.2),
    speed: Number(url.searchParams.get('speed') || 1),
    use_speaker_boost: true
  };
  const schedule = (url.searchParams.get('chunkSchedule') || '50,120,160,290').split(',').map((item) => Number(item.trim())).filter((item) => Number.isFinite(item) && item > 0).slice(0, 8);
  const generationConfig = { chunk_length_schedule: schedule.length ? schedule : [50, 120, 160, 290] };
  try { upstream.webSocket.send(JSON.stringify({ text: ' ', voice_settings: voiceSettings, generation_config: generationConfig })); } catch {}
  send({ type: 'tts_ready', voiceId, modelId: upstreamUrl.searchParams.get('model_id'), outputFormat: upstreamUrl.searchParams.get('output_format') });
  browser.addEventListener('message', (event) => {
    let message;
    try { message = JSON.parse(typeof event.data === 'string' ? event.data : new TextDecoder().decode(event.data)); } catch { return send({ type: 'error', code: 'INVALID_JSON' }); }
    try {
      if (message.type === 'text') {
        const text = typeof message.text === 'string' ? message.text.slice(0, 6000) : '';
        upstream.webSocket.send(JSON.stringify({ text, flush: Boolean(message.flush), try_trigger_generation: Boolean(message.tryTriggerGeneration) }));
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
    if (message.error || message.code === 1008) {
      return send({ type: 'error', code: message.code || 'ELEVENLABS_UPSTREAM_ERROR', message: message.message || message.error || 'upstream error' });
    }
    if (message.audio) {
      if (!firstAudio) {
        firstAudio = true;
        send({ type: 'tts_first_byte', ttfbMs: Math.max(1, Date.now() - started) });
      }
      send({ type: 'audio', audio: message.audio, alignment: message.alignment || null, isFinal: Boolean(message.isFinal) });
    }
    if (message.isFinal) send({ type: 'tts_final' });
  });
  upstream.webSocket.addEventListener('error', () => send({ type: 'error', code: 'ELEVENLABS_UPSTREAM_ERROR' }));
  upstream.webSocket.addEventListener('close', () => { send({ type: 'tts_closed' }); try { browser.close(); } catch {} });
  const closeBoth = () => { try { browser.close(); } catch {} try { upstream.webSocket.close(); } catch {} };
  browser.addEventListener('close', closeBoth);
  browser.addEventListener('error', closeBoth);
  return new Response(null, { status: 101, webSocket: client, headers: cors(env) });
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
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(env) });
    if (request.method === 'GET' && url.pathname === '/') return runtimeLanding(env, request.headers.get('Origin') || '');
    if (request.method === 'GET' && url.pathname === '/favicon.ico') return new Response(null, { status: 204, headers: cors(env) });
    if (request.method === 'GET' && url.pathname === '/api/health') {
      const body = { ok: true, service: 'voice-runtime-worker', config: { livekit: Boolean(env.LIVEKIT_URL && env.LIVEKIT_API_KEY && env.LIVEKIT_API_SECRET && env.LIVEKIT_AGENT_ID), elevenlabs: Boolean(env.ELEVENLABS_API_KEY), traceStore: tracePersistence(env) } };
      if (url.searchParams.get('probe') === '1') body.elevenlabsProbe = await probeElevenLabs(env);
      return json(body, 200, env);
    }
    if (request.method === 'POST' && url.pathname === '/api/ai/respond') return openAIRespond(request, env);
    if (request.method === 'POST' && url.pathname === '/api/voice/session') return createSession(request, env);
    if (request.method === 'POST' && url.pathname === '/api/voice/answer') return updateSession(request, env, 'answer');
    if (request.method === 'POST' && url.pathname === '/api/voice/end') return updateSession(request, env, 'end');
    if (request.method === 'POST' && url.pathname.startsWith('/api/voice/session/') && url.pathname.endsWith('/event')) return ingestEvent(request, env, url.pathname.split('/').at(-2));
    if (request.method === 'GET' && url.pathname === '/api/voice/events') return eventsSocket(request, env);
    if (request.method === 'GET' && url.pathname.startsWith('/api/voice/session/') && url.pathname.endsWith('/trace')) {
      const sessionId = url.pathname.split('/').at(-2);
      const session = await loadSession(sessionId, env);
      if (session) return traceResponse(session, env);
      return json({ error: 'SESSION_NOT_FOUND' }, 404, env);
    }
    if (url.pathname === '/api/voice/tts' && request.headers.get('Upgrade')?.toLowerCase() === 'websocket') return ttsSocket(request, env);
    if (url.pathname === '/api/voice/tts') return json({ error: 'WEBSOCKET_REQUIRED', endpoint: '/api/voice/tts' }, 426, env);
    return json({ error: 'NOT_FOUND' }, 404, env);
  }
};

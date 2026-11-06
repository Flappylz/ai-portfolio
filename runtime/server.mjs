import http from 'node:http';
import { randomUUID } from 'node:crypto';
import { URL } from 'node:url';
import { AccessToken } from 'livekit-server-sdk';
import { WebSocket, WebSocketServer } from 'ws';

const port = Number(process.env.PORT || 8787);
const defaultMode = process.env.RUNTIME_DEFAULT_MODE || 'live';
const sessions = new Map();
const subscribers = new Map();
const scenarioDefaults = {
  carrier: { direction: 'inbound', voiceEnv: 'ELEVENLABS_VOICE_ID_CARRIER', fallbackVoice: 'JBFqnCBsd6RMkjVDRZzb' },
  airline: { direction: 'inbound', voiceEnv: 'ELEVENLABS_VOICE_ID_AIRLINE', fallbackVoice: '21m00Tcm4TlvDq8ikWAM' },
  football: { direction: 'outbound', voiceEnv: 'ELEVENLABS_VOICE_ID_FOOTBALL', fallbackVoice: 'JBFqnCBsd6RMkjVDRZzb' }
};

const jsonHeaders = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store',
  'access-control-allow-origin': process.env.CORS_ORIGIN || '*',
  'access-control-allow-headers': 'content-type, authorization',
  'access-control-allow-methods': 'GET,POST,OPTIONS'
};

const now = () => new Date().toISOString();
const has = (name) => Boolean(process.env[name]);
const sendJson = (res, status, body) => {
  res.writeHead(status, jsonHeaders);
  res.end(JSON.stringify(body));
};
const readBody = async (req) => {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  if (!chunks.length) return {};
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { return null; }
};

function configStatus() {
  return {
    livekit: has('LIVEKIT_URL') && has('LIVEKIT_API_KEY') && has('LIVEKIT_API_SECRET'),
    elevenlabs: has('ELEVENLABS_API_KEY'),
    openai: has('OPENAI_API_KEY'),
    defaultMode
  };
}

async function probeElevenLabs() {
  if (!has('ELEVENLABS_API_KEY')) return { configured: false, verified: false, status: null, code: 'MISSING_SECRET' };
  try {
    const voiceId = process.env.ELEVENLABS_VOICE_ID_CARRIER || scenarioDefaults.carrier.fallbackVoice;
    const endpoint = `wss://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}/stream-input?model_id=eleven_flash_v2_5&language_code=zh&output_format=mp3_44100_128`;
    const socket = new WebSocket(endpoint, { headers: { 'xi-api-key': process.env.ELEVENLABS_API_KEY } });
    return await new Promise((resolve) => {
      let settled = false;
      const finish = (result) => { if (settled) return; settled = true; clearTimeout(timer); try { socket.close(); } catch {} resolve(result); };
      const timer = setTimeout(() => finish({ configured: true, verified: true, status: 101, code: null }), 1200);
      socket.once('open', () => { try { socket.send(JSON.stringify({ text: ' ' })); } catch { finish({ configured: true, verified: false, status: null, code: 'UPSTREAM_UNREACHABLE' }); } });
      socket.on('message', (raw) => {
        try {
          const message = JSON.parse(raw.toString());
          if (message.error || message.code === 1008) return finish({ configured: true, verified: false, status: 400, code: String(message.code || message.error || 'UPSTREAM_ERROR').slice(0, 100) });
          if (message.audio) finish({ configured: true, verified: true, status: 101, code: null });
        } catch {}
      });
      socket.once('error', () => finish({ configured: true, verified: false, status: null, code: 'UPSTREAM_UNREACHABLE' }));
    });
  } catch (error) {
    return { configured: true, verified: false, status: null, code: 'UPSTREAM_UNREACHABLE' };
  }
}

function appendEvent(session, type, data = {}) {
  const event = { type, ts: now(), traceId: session.traceId, sessionId: session.id, ...data };
  session.events.push(event);
  const clients = subscribers.get(session.id) || new Set();
  for (const socket of clients) {
    if (socket.readyState === 1) socket.send(JSON.stringify(event));
  }
  return event;
}

function sessionSummary(session) {
  return {
    sessionId: session.id,
    traceId: session.traceId,
    scenario: session.scenario,
    direction: session.direction,
    language: session.language,
    voiceId: session.voiceId,
    transport: session.transport,
    serverUrl: process.env.LIVEKIT_URL || null,
    room: session.room,
    token: session.token,
    agentId: process.env.LIVEKIT_AGENT_ID || null,
    runtimeMode: session.runtimeMode,
    status: session.status,
    createdAt: session.createdAt
  };
}

function missingLiveConfig(scenario) {
  const required = ['LIVEKIT_URL', 'LIVEKIT_API_KEY', 'LIVEKIT_API_SECRET', 'ELEVENLABS_API_KEY'];
  return required.filter((name) => !has(name));
}

async function issueLiveToken(session) {
  const room = `fengliangze-${session.scenario}-${session.id.slice(0, 8)}`;
  const identity = `visitor-${session.id.slice(0, 8)}`;
  const access = new AccessToken(process.env.LIVEKIT_API_KEY, process.env.LIVEKIT_API_SECRET, {
    identity,
    name: 'Portfolio visitor',
    ttl: '10m'
  });
  access.addGrant({ roomJoin: true, room, canPublish: true, canSubscribe: true, canPublishData: true });
  session.room = room;
  session.token = await access.toJwt();
  session.transport = 'livekit-webrtc';
  appendEvent(session, 'token_issued', { transport: session.transport, room });
}

function scheduleSandbox(session, connect = true) {
  const timeline = connect
    ? [['token_issued', 80, { transport: 'sandbox-webrtc' }], ['ice_checking', 160], ['room_joined', 280, { room: session.room }], ['agent_joined', 420], ['audio_track_ready', 560], ['listening', 700]]
    : [['ringing', 20, { caller: '冯良泽 AI', callerNumber: '138 **** 6728' }]];
  for (const [type, delay, data] of timeline) {
    setTimeout(() => {
      if (!sessions.has(session.id) || session.status === 'ended') return;
      appendEvent(session, type, data);
      session.status = type === 'listening' ? 'connected' : type;
    }, delay);
  }
}

async function createSession(payload) {
  if (!payload || typeof payload !== 'object') return { error: 'INVALID_JSON' };
  const scenario = String(payload.scenario || '').toLowerCase();
  if (!scenarioDefaults[scenario]) return { error: 'UNKNOWN_SCENARIO' };
  const direction = payload.direction || scenarioDefaults[scenario].direction;
  const runtimeMode = payload.runtimeMode || defaultMode;
  if (!['inbound', 'outbound'].includes(direction)) return { error: 'INVALID_DIRECTION' };
  if (!['live', 'sandbox'].includes(runtimeMode)) return { error: 'INVALID_RUNTIME_MODE' };
  const session = {
    id: randomUUID(),
    traceId: `trace_${randomUUID().replaceAll('-', '').slice(0, 16)}`,
    scenario,
    direction,
    language: payload.language || 'zh',
    voiceId: payload.voiceId || process.env[scenarioDefaults[scenario].voiceEnv] || null,
    runtimeMode,
    transport: runtimeMode === 'live' ? 'pending' : 'sandbox-webrtc',
    room: null,
    token: null,
    status: direction === 'outbound' ? 'ringing' : 'dialing',
    createdAt: now(),
    events: [],
    metrics: { rtt: null, jitter: null, packetLoss: null, asrMs: null, llmMs: null, ttsTtfbMs: null, e2eMs: null }
  };
  sessions.set(session.id, session);
  subscribers.set(session.id, new Set());
  appendEvent(session, 'session_created', { scenario, direction, runtimeMode });
  if (runtimeMode === 'live') {
    const missing = missingLiveConfig(scenario);
    if (missing.length) {
      session.status = 'error';
      appendEvent(session, 'error', { code: 'LIVE_CREDENTIALS_MISSING', missing });
      return { error: 'LIVE_CREDENTIALS_MISSING', missing, session: sessionSummary(session) };
    }
    await issueLiveToken(session);
    if (direction === 'outbound') scheduleSandbox(session, false);
    else {
      appendEvent(session, 'ice_checking', { transport: session.transport });
      session.status = 'connecting';
    }
  } else {
    session.room = `sandbox-${session.id.slice(0, 8)}`;
    if (direction === 'outbound') scheduleSandbox(session, false);
    else scheduleSandbox(session, true);
  }
  return { session: sessionSummary(session) };
}

async function answerSession(payload) {
  const session = sessions.get(payload?.sessionId);
  if (!session) return { error: 'SESSION_NOT_FOUND' };
  if (session.direction !== 'outbound') return { error: 'NOT_OUTBOUND' };
  if (session.status === 'ended') return { error: 'SESSION_ENDED' };
  appendEvent(session, 'call_answered');
  session.status = 'connecting';
  if (session.runtimeMode === 'sandbox') scheduleSandbox(session, true);
  else {
    appendEvent(session, 'ice_checking', { transport: session.transport });
    appendEvent(session, 'room_joined', { room: session.room });
  }
  return { session: sessionSummary(session) };
}

function allowedVoiceIds() {
  return new Set(Object.values(scenarioDefaults).map(({ voiceEnv }) => process.env[voiceEnv]).filter(Boolean));
}

function resolveVoiceId(requested, scenario = 'carrier') {
  const fallback = process.env[scenarioDefaults[scenario]?.voiceEnv] || scenarioDefaults[scenario]?.fallbackVoice || process.env.ELEVENLABS_VOICE_ID_CARRIER;
  if (!requested) return fallback;
  return allowedVoiceIds().has(requested) ? requested : fallback;
}

function rejectUpgrade(socket, status, body) {
  const payload = JSON.stringify(body);
  socket.write(`HTTP/1.1 ${status}\r\nContent-Type: application/json\r\nContent-Length: ${Buffer.byteLength(payload)}\r\nConnection: close\r\n\r\n${payload}`);
  socket.destroy();
}

function proxyTtsUpgrade(req, socket, head) {
  if (!has('ELEVENLABS_API_KEY')) return rejectUpgrade(socket, 503, { error: 'ELEVENLABS_CREDENTIALS_MISSING', runtimeMode: 'sandbox' });
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const voiceId = resolveVoiceId(url.searchParams.get('voiceId'), url.searchParams.get('scenario') || 'carrier');
  if (!voiceId) return rejectUpgrade(socket, 503, { error: 'VOICE_ID_MISSING' });
  const modelId = url.searchParams.get('modelId') || 'eleven_flash_v2_5';
  const language = url.searchParams.get('language') || 'zh';
  const outputFormat = url.searchParams.get('outputFormat') || 'mp3_44100_128';
  const upstreamUrl = `wss://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}/stream-input?model_id=${encodeURIComponent(modelId)}&language_code=${encodeURIComponent(language)}&output_format=${encodeURIComponent(outputFormat)}`;
  const upstream = new WebSocket(upstreamUrl, { headers: { 'xi-api-key': process.env.ELEVENLABS_API_KEY } });
  const started = performance.now();
  let firstAudio = false;
  ttsWss.handleUpgrade(req, socket, head, (client) => {
    const send = (message) => { if (client.readyState === 1) client.send(JSON.stringify(message)); };
    const voiceSettings = {
      stability: Number(url.searchParams.get('stability') || 0.5),
      similarity_boost: Number(url.searchParams.get('similarity') || 0.8),
      style: Number(url.searchParams.get('style') || 0.2),
      speed: Number(url.searchParams.get('speed') || 1),
      use_speaker_boost: true
    };
    upstream.once('open', () => {
      upstream.send(JSON.stringify({ text: ' ', voice_settings: voiceSettings, generation_config: { chunk_length_schedule: [50, 120, 160, 290] } }));
      send({ type: 'tts_ready', voiceId, modelId, outputFormat });
    });
    upstream.on('message', (raw) => {
      let message;
      try { message = JSON.parse(raw.toString()); } catch { return send({ type: 'error', code: 'ELEVENLABS_INVALID_FRAME' }); }
      if (message.audio) {
        if (!firstAudio) {
          firstAudio = true;
          send({ type: 'tts_first_byte', ttfbMs: Math.max(1, Math.round(performance.now() - started)) });
        }
        send({ type: 'audio', audio: message.audio, alignment: message.alignment || null, isFinal: Boolean(message.isFinal) });
      }
      if (message.isFinal) send({ type: 'tts_final' });
    });
    upstream.on('error', () => send({ type: 'error', code: 'ELEVENLABS_UPSTREAM_ERROR' }));
    upstream.on('close', () => { send({ type: 'tts_closed' }); if (client.readyState === 1) client.close(); });
    client.on('message', (raw) => {
      let message;
      try { message = JSON.parse(raw.toString()); } catch { return send({ type: 'error', code: 'INVALID_JSON' }); }
      if (upstream.readyState !== WebSocket.OPEN) return send({ type: 'error', code: 'TTS_NOT_READY' });
      if (message.type === 'text') {
        const text = typeof message.text === 'string' ? message.text : '';
        upstream.send(JSON.stringify({ text, flush: Boolean(message.flush), try_trigger_generation: Boolean(message.tryTriggerGeneration) }));
      } else if (message.type === 'flush') {
        upstream.send(JSON.stringify({ text: ' ', flush: true }));
      } else if (message.type === 'end') {
        upstream.send(JSON.stringify({ text: '' }));
      } else if (message.type === 'keep_alive') {
        upstream.send(JSON.stringify({ text: ' ' }));
      }
    });
    client.on('close', () => { if (upstream.readyState === WebSocket.OPEN || upstream.readyState === WebSocket.CONNECTING) upstream.close(); });
    client.on('error', () => { if (upstream.readyState === WebSocket.OPEN || upstream.readyState === WebSocket.CONNECTING) upstream.close(); });
  });
}

function proxyTtsHttp(payload, res) {
  if (!has('ELEVENLABS_API_KEY')) return sendJson(res, 503, { error: 'ELEVENLABS_CREDENTIALS_MISSING', runtimeMode: 'sandbox' });
  const scenario = payload?.scenario || 'carrier';
  const voiceId = resolveVoiceId(payload?.voiceId, scenario);
  if (!voiceId) return sendJson(res, 503, { error: 'VOICE_ID_MISSING' });
  const modelId = payload?.modelId || payload?.model || 'eleven_flash_v2_5';
  const language = payload?.language || 'zh';
  const upstreamUrl = `wss://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}/stream-input?model_id=${encodeURIComponent(modelId)}&language_code=${encodeURIComponent(language)}&output_format=mp3_44100_128`;
  const upstream = new WebSocket(upstreamUrl, { headers: { 'xi-api-key': process.env.ELEVENLABS_API_KEY } });
  const chunks = [];
  let finished = false;
  const finish = (status, body) => {
    if (finished) return;
    finished = true;
    if (status !== 200) return sendJson(res, status, body);
    res.writeHead(200, { 'content-type': 'audio/mpeg', 'cache-control': 'no-store', 'access-control-allow-origin': jsonHeaders['access-control-allow-origin'] });
    res.end(Buffer.concat(chunks));
  };
  const timer = setTimeout(() => { try { upstream.close(); } catch {} finish(504, { error: 'ELEVENLABS_TTS_TIMEOUT' }); }, 20000);
  upstream.once('open', () => {
    const settings = payload?.voiceSettings || {};
    upstream.send(JSON.stringify({ text: ' ', voice_settings: { stability: Number(settings.stability ?? 0.5), similarity_boost: Number(settings.similarity_boost ?? settings.similarityBoost ?? 0.8), style: Number(settings.style ?? 0.2), speed: Number(settings.speed ?? 1), use_speaker_boost: true }, generation_config: { chunk_length_schedule: [50, 120, 160, 290] } }));
    upstream.send(JSON.stringify({ text: String(payload?.text || ''), flush: true }));
  });
  upstream.on('message', (raw) => {
    let message;
    try { message = JSON.parse(raw.toString()); } catch { return finish(502, { error: 'ELEVENLABS_INVALID_FRAME' }); }
    if (message.audio) chunks.push(Buffer.from(message.audio, 'base64'));
    if (message.isFinal) { clearTimeout(timer); finish(200); try { upstream.close(); } catch {} }
  });
  upstream.on('error', () => { clearTimeout(timer); finish(502, { error: 'ELEVENLABS_UPSTREAM_ERROR' }); });
  upstream.on('close', () => { clearTimeout(timer); if (!finished && chunks.length) finish(200); });
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') return sendJson(res, 204, {});
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  try {
    if (req.method === 'GET' && url.pathname === '/api/health') {
      const body = { ok: true, service: 'voice-runtime', now: now(), config: configStatus() };
      if (url.searchParams.get('probe') === '1') body.elevenlabsProbe = await probeElevenLabs();
      return sendJson(res, 200, body);
    }
    if (req.method === 'POST' && url.pathname === '/api/voice/session') {
      const result = await createSession(await readBody(req));
      return sendJson(res, result.error ? (result.error === 'LIVE_CREDENTIALS_MISSING' ? 503 : 400) : 201, result);
    }
    if (req.method === 'POST' && url.pathname === '/api/voice/answer') {
      const result = await answerSession(await readBody(req));
      return sendJson(res, result.error ? 400 : 200, result);
    }
    if (req.method === 'POST' && url.pathname === '/api/voice/end') {
      const body = await readBody(req);
      const session = sessions.get(body?.sessionId);
      if (!session) return sendJson(res, 404, { error: 'SESSION_NOT_FOUND' });
      session.status = 'ended';
      appendEvent(session, 'ended', { reason: body.reason || 'user' });
      return sendJson(res, 200, { session: sessionSummary(session) });
    }
    if (req.method === 'GET' && url.pathname.startsWith('/api/voice/session/') && url.pathname.endsWith('/trace')) {
      const id = url.pathname.split('/')[4];
      const session = sessions.get(id);
      if (!session) return sendJson(res, 404, { error: 'SESSION_NOT_FOUND' });
      return sendJson(res, 200, { ...sessionSummary(session), metrics: session.metrics, events: session.events });
    }
    if (req.method === 'POST' && url.pathname === '/api/voice/tts') return proxyTtsHttp(await readBody(req), res);
    sendJson(res, 404, { error: 'NOT_FOUND' });
  } catch (error) {
    sendJson(res, 500, { error: 'RUNTIME_ERROR', message: error instanceof Error ? error.message : 'unknown error' });
  }
});

const wss = new WebSocketServer({ noServer: true });
const ttsWss = new WebSocketServer({ noServer: true });
server.on('upgrade', (req, socket, head) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  if (url.pathname === '/api/voice/tts') return proxyTtsUpgrade(req, socket, head);
  if (url.pathname !== '/api/voice/events') return socket.destroy();
  const sessionId = url.searchParams.get('sessionId');
  if (!sessions.has(sessionId)) return socket.destroy();
  wss.handleUpgrade(req, socket, head, (ws) => {
    const clients = subscribers.get(sessionId) || new Set();
    clients.add(ws);
    subscribers.set(sessionId, clients);
    for (const event of sessions.get(sessionId).events) ws.send(JSON.stringify(event));
    ws.on('close', () => clients.delete(ws));
  });
});

server.listen(port, () => console.log(`voice-runtime listening on http://127.0.0.1:${port}`));

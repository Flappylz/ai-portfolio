const SCENARIOS = {
  carrier: { direction: 'inbound', voiceKey: 'ELEVENLABS_VOICE_ID_CARRIER', fallbackVoice: 'JBFqnCBsd6RMkjVDRZzb' },
  airline: { direction: 'inbound', voiceKey: 'ELEVENLABS_VOICE_ID_AIRLINE', fallbackVoice: '21m00Tcm4TlvDq8ikWAM' },
  football: { direction: 'outbound', voiceKey: 'ELEVENLABS_VOICE_ID_FOOTBALL', fallbackVoice: 'JBFqnCBsd6RMkjVDRZzb' }
};

// The worker keeps a short-lived in-memory trace for the public portfolio demo.
// This is intentionally ephemeral: production persistence belongs in a Durable
// Object or an external trace store and must never be presented as durable here.
const sessions = new Map();
const sockets = new Map();
const isoNow = () => new Date().toISOString();

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
    voiceId: session.voiceId
  };
}

const cors = (env) => ({
  'access-control-allow-origin': env.CORS_ORIGIN || '*',
  'access-control-allow-headers': 'content-type, authorization',
  'access-control-allow-methods': 'GET,POST,OPTIONS',
  'cache-control': 'no-store'
});

const json = (body, status = 200, env) => new Response(JSON.stringify(body), {
  status,
  headers: { 'content-type': 'application/json; charset=utf-8', ...cors(env) }
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
    roomConfig: { agents: [{ agentName: env.LIVEKIT_AGENT_ID, metadata: JSON.stringify({ scenario, direction, sessionId, traceId }) }] }
  }, env.LIVEKIT_API_SECRET) : null;
  const session = { sessionId, traceId, scenario, direction, runtimeMode, room, serverUrl: env.LIVEKIT_URL || null, token, status: direction === 'outbound' ? 'ringing' : 'dialing', voiceId: body.voiceId || env[SCENARIOS[scenario].voiceKey] || SCENARIOS[scenario].fallbackVoice, createdAt: isoNow(), events: [] };
  sessions.set(sessionId, session);
  emit(session, 'session_created', { direction, runtimeMode, transport: session.runtimeMode === 'live' ? 'livekit-webrtc' : 'sandbox-webrtc' });
  if (runtimeMode === 'live') {
    emit(session, 'token_issued', { expiresIn: 600 });
    emit(session, 'ice_checking');
  } else {
    emit(session, direction === 'outbound' ? 'ringing' : 'dialing');
    emit(session, 'sandbox_notice', { simulated: true });
  }
  return json({ session: sessionPayload(session) }, 201, env);
}

async function eventsSocket(request, env) {
  const sessionId = new URL(request.url).searchParams.get('sessionId');
  const session = sessions.get(sessionId);
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
  const session = sessions.get(body?.sessionId);
  if (!session) return json({ error: 'SESSION_NOT_FOUND' }, 404, env);
  if (action === 'answer') {
    session.status = 'connecting';
    emit(session, 'call_answered');
    emit(session, 'ice_checking');
  } else {
    session.status = 'ended';
    emit(session, 'ended', { reason: body?.reason || 'user' });
  }
  return json({ session: sessionPayload(session), status: session.status, event: action === 'answer' ? 'call_answered' : 'ended' }, 200, env);
}

function traceResponse(session, env) {
  return json({ session: sessionPayload(session), events: session.events, persistence: 'ephemeral_worker_memory', warning: 'Trace resets when the worker isolate is recycled.' }, 200, env);
}

async function ttsSocket(request, env) {
  if (!env.ELEVENLABS_API_KEY) return json({ error: 'ELEVENLABS_CREDENTIALS_MISSING', runtimeMode: 'sandbox' }, 503, env);
  const url = new URL(request.url);
  const scenario = url.searchParams.get('scenario') || 'carrier';
  const voiceId = url.searchParams.get('voiceId') || env[SCENARIOS[scenario]?.voiceKey || 'ELEVENLABS_VOICE_ID_CARRIER'] || SCENARIOS[scenario]?.fallbackVoice;
  if (!voiceId) return json({ error: 'VOICE_ID_MISSING' }, 503, env);
  const upstreamUrl = new URL(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}/stream-input`);
  upstreamUrl.searchParams.set('model_id', url.searchParams.get('modelId') || 'eleven_flash_v2_5');
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
  const generationConfig = { chunk_length_schedule: [50, 120, 160, 290] };
  try { upstream.webSocket.send(JSON.stringify({ text: ' ', voice_settings: voiceSettings, generation_config: generationConfig })); } catch {}
  send({ type: 'tts_ready', voiceId, modelId: upstreamUrl.searchParams.get('model_id'), outputFormat: upstreamUrl.searchParams.get('output_format') });
  browser.addEventListener('message', (event) => {
    let message;
    try { message = JSON.parse(typeof event.data === 'string' ? event.data : new TextDecoder().decode(event.data)); } catch { return send({ type: 'error', code: 'INVALID_JSON' }); }
    try {
      if (message.type === 'text') {
        upstream.webSocket.send(JSON.stringify({ text: typeof message.text === 'string' ? message.text : '', flush: Boolean(message.flush), try_trigger_generation: Boolean(message.tryTriggerGeneration) }));
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
    if (request.method === 'GET' && url.pathname === '/api/health') {
      const body = { ok: true, service: 'voice-runtime-worker', config: { livekit: Boolean(env.LIVEKIT_URL && env.LIVEKIT_API_KEY && env.LIVEKIT_API_SECRET && env.LIVEKIT_AGENT_ID), elevenlabs: Boolean(env.ELEVENLABS_API_KEY) } };
      if (url.searchParams.get('probe') === '1') body.elevenlabsProbe = await probeElevenLabs(env);
      return json(body, 200, env);
    }
    if (request.method === 'POST' && url.pathname === '/api/voice/session') return createSession(request, env);
    if (request.method === 'POST' && url.pathname === '/api/voice/answer') return updateSession(request, env, 'answer');
    if (request.method === 'POST' && url.pathname === '/api/voice/end') return updateSession(request, env, 'end');
    if (request.method === 'GET' && url.pathname === '/api/voice/events') return eventsSocket(request, env);
    if (request.method === 'GET' && url.pathname.startsWith('/api/voice/session/') && url.pathname.endsWith('/trace')) {
      const sessionId = url.pathname.split('/').at(-2);
      const session = sessions.get(sessionId);
      return session ? traceResponse(session, env) : json({ error: 'SESSION_NOT_FOUND' }, 404, env);
    }
    if (url.pathname === '/api/voice/tts' && request.headers.get('Upgrade')?.toLowerCase() === 'websocket') return ttsSocket(request, env);
    if (url.pathname === '/api/voice/tts') return json({ error: 'WEBSOCKET_REQUIRED', endpoint: '/api/voice/tts' }, 426, env);
    return json({ error: 'NOT_FOUND' }, 404, env);
  }
};

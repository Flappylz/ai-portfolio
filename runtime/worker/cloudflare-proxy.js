const DEFAULT_UPSTREAM = 'https://fengliangze-ai-voice-runtime.wellsfung.chatgpt.site/__runtime_origin';

const cors = (env, origin = '') => {
  const configured = (env.CORS_ORIGIN || 'https://flappylz.github.io').split(',').map((item) => item.trim()).filter(Boolean);
  return { 'access-control-allow-origin': configured.includes(origin) ? origin : configured[0], 'access-control-allow-headers': 'content-type, authorization', 'access-control-allow-methods': 'GET,POST,OPTIONS', 'cache-control': 'no-store', vary: 'Origin' };
};
const json = (body, status, env, origin = '') => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'x-content-type-options': 'nosniff', ...cors(env, origin) } });
const landing = (env, origin = '') => new Response(`<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>冯良泽AI · Durable Voice Runtime</title><style>body{margin:0;background:#0b1118;color:#e8eef5;font-family:Inter,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}main{max-width:760px;margin:12vh auto;padding:32px}h1{font-size:40px;margin:0 0 12px}p{color:#a9b6c5;line-height:1.6}.status{display:inline-flex;gap:8px;align-items:center;color:#c7ff3d;font-weight:700}.dot{width:9px;height:9px;border-radius:50%;background:#c7ff3d;box-shadow:0 0 18px #c7ff3d}.links{display:flex;gap:12px;flex-wrap:wrap;margin-top:28px}.links a{color:#0b1118;background:#c7ff3d;padding:12px 16px;text-decoration:none;font-weight:700}.links a.secondary{color:#d7e4ef;background:#17222d;border:1px solid #344554}</style></head><body><main><div class="status"><span class="dot"></span>DURABLE KV RUNTIME ONLINE</div><h1>冯良泽AI · Voice Runtime</h1><p>LiveKit、ElevenLabs 和会话 Trace 由上游运行时提供，Trace 镜像写入 Cloudflare Workers KV，跨实例长期可查询。</p><div class="links"><a href="https://flappylz.github.io/ai-portfolio/">打开作品集</a><a class="secondary" href="/api/health">查看运行状态</a></div></main></body></html>`, { status: 200, headers: { 'content-type': 'text/html; charset=utf-8', 'x-content-type-options': 'nosniff', ...cors(env, origin) } });
const upstreamBase = (env) => String(env.UPSTREAM_RUNTIME_URL || DEFAULT_UPSTREAM).replace(/\/$/, '');
const traceKey = (sessionId) => `voice-trace:${sessionId}`;
async function fetchUpstream(pathname, request, env) { return fetch(new Request(upstreamBase(env) + pathname, request)); }
async function fetchUpstreamTrace(sessionId, env) { const response = await fetch(`${upstreamBase(env)}/api/voice/session/${encodeURIComponent(sessionId)}/trace`, { headers: { accept: 'application/json' } }); if (!response.ok) return null; return response.json().catch(() => null); }
const activeTraceKey = (sessionId) => traceKey(sessionId) + ':active';

async function mirrorTrace(sessionId, env) {
  if (!env.TRACE_KV) throw new Error('TRACE_KV_BINDING_MISSING');
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const trace = await fetchUpstreamTrace(sessionId, env);
    if (!trace) throw new Error('TRACE_KV_SOURCE_UNAVAILABLE');
    const ended = trace.session?.status === 'ended';
    const key = ended ? traceKey(sessionId) : activeTraceKey(sessionId);
    const persistent = { ...trace, persistence: 'durable_kv', persistedAt: new Date().toISOString() };
    try {
      // Reserve the permanent key for completed calls so that the final write
      // does not compete with a just-flushed active snapshot on the same key.
      await env.TRACE_KV.put(key, JSON.stringify(persistent), ended ? undefined : { expirationTtl: 3 * 3600 });
      return persistent;
    } catch (error) {
      if (attempt === 1 || !/429|rate|too many/i.test(String(error))) throw error;
      await new Promise(resolve => setTimeout(resolve, 1100));
    }
  }
}

async function readDurableTrace(sessionId, env) {
  if (!env.TRACE_KV) return null;
  const [final, active] = await Promise.all([
    env.TRACE_KV.get(traceKey(sessionId), 'json').catch(() => null),
    env.TRACE_KV.get(activeTraceKey(sessionId), 'json').catch(() => null)
  ]);
  const stored = final?.session?.status === 'ended' ? final : active || final;
  if (!stored) return null;
  if (stored.session) {
    const { token, ...publicSession } = stored.session;
    stored.session = publicSession;
  }
  return { ...stored, persistence: 'durable_kv' };
}

function sessionIdFromPath(pathname) {
  const match = pathname.match(/^\/api\/voice\/session\/([^/]+)\/event$/);
  return match?.[1] || null;
}

async function proxyMutation(request, env, pathname) {
  const origin = request.headers.get('Origin') || '';
  const body = await request.clone().json().catch(() => null);
  const response = await fetchUpstream(pathname, request, env);
  if (!response.ok) return response;
  const payload = await response.json().catch(() => null);
  if (!payload) return json({ error: 'TRACE_ORIGIN_RESPONSE_INVALID' }, 502, env, origin);
  if (pathname === '/api/voice/session') return json(payload, response.status, env, origin);
  const sessionId = sessionIdFromPath(pathname) || body?.sessionId;
  if (!sessionId) return json({ error: 'SESSION_NOT_FOUND' }, 404, env, origin);
  try {
    const trace = await mirrorTrace(sessionId, env);
    const { session, ...ack } = payload;
    return json({ ok: true, ...ack, ...(session ? { session: trace.session } : {}), traceStore: 'durable_kv', trace }, response.status, env, origin);
  } catch {
    return json({ error: 'TRACE_KV_WRITE_FAILED', upstreamStatus: response.status }, 502, env, origin);
  }
}
export default { async fetch(request, env) { const url = new URL(request.url); const origin = request.headers.get('Origin') || ''; if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(env, origin) }); if (request.method === 'GET' && url.pathname === '/') return landing(env, origin); if (request.method === 'GET' && url.pathname === '/favicon.ico') return new Response(null, { status: 204, headers: cors(env, origin) }); if (request.method === 'GET' && url.pathname === '/api/health') { const response = await fetchUpstream('/api/health' + url.search, request, env); const body = await response.json().catch(() => ({ ok: false })); body.config = { ...(body.config || {}), traceStore: env.TRACE_KV ? 'durable_kv' : 'worker_memory', traceUpstream: body.config?.traceStore || null }; return json(body, response.status, env, origin); } if (request.method === 'GET' && url.pathname.startsWith('/api/voice/session/') && url.pathname.endsWith('/trace')) { const sessionId = url.pathname.split('/').at(-2); const stored = await readDurableTrace(sessionId, env); if (stored?.session?.status === 'ended') return json(stored, 200, env, origin); try { const trace = await mirrorTrace(sessionId, env); return json(trace, 200, env, origin); } catch { return stored ? json(stored, 200, env, origin) : json({ error: 'TRACE_KV_READ_FAILED' }, 502, env, origin); } } if (url.pathname === '/api/voice/events' || url.pathname === '/api/voice/tts') return fetchUpstream(url.pathname + url.search, request, env); if (request.method === 'POST' && (url.pathname === '/api/voice/session' || url.pathname === '/api/voice/answer' || url.pathname === '/api/voice/end' || sessionIdFromPath(url.pathname))) return proxyMutation(request, env, url.pathname + url.search); return fetchUpstream(url.pathname + url.search, request, env); } };

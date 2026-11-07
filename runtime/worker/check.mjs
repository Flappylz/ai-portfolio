import worker from './index.js';

const env = { CORS_ORIGIN: 'https://flappylz.github.io' };
const request = (url, options = {}) => new Request(`https://runtime.test${url}`, { ...options, headers: { 'content-type': 'application/json', origin: 'https://flappylz.github.io', ...(options.headers || {}) } });
const read = async (response) => ({ status: response.status, body: await response.json() });

const health = await read(await worker.fetch(request('/api/health'), env));
if (health.status !== 200 || !health.body.ok) throw new Error('worker health failed');

const created = await read(await worker.fetch(request('/api/voice/session', {
  method: 'POST',
  body: JSON.stringify({ scenario: 'carrier', runtimeMode: 'sandbox', agentModel: 'gpt-5.6-sol', asrModel: 'Web Speech API / Chrome sandbox' })
}), env));
if (created.status !== 201 || created.body.session?.status !== 'dialing') throw new Error('worker sandbox session failed');
if (created.body.session.agentModel !== 'openai/gpt-4.1-mini' || created.body.session.fastModel !== 'openai/gpt-4.1-mini' || created.body.session.slowModel !== 'openai/gpt-5.6-sol' || created.body.session.routing !== 'fast_voice+slow_validation' || created.body.session.asrModel !== 'openai/gpt-live-transcribe') throw new Error('worker model routing resolution failed');

const session = created.body.session;
const event = await read(await worker.fetch(request(`/api/voice/session/${session.sessionId}/event`, {
  method: 'POST',
  body: JSON.stringify({ traceId: session.traceId, sessionId: session.sessionId, type: 'partial_transcript', text: '套餐' })
}), env));
if (event.status !== 202 || event.body.event?.traceId !== session.traceId) throw new Error('worker trace ingest failed');

const deepEvent = await read(await worker.fetch(request(`/api/voice/session/${session.sessionId}/event`, {
  method: 'POST',
  body: JSON.stringify({ traceId: session.traceId, type: 'deep_result', model: session.slowModel, latencyMs: 420, answer: 'demo' })
}), env));
if (deepEvent.status !== 202 || deepEvent.body.event?.type !== 'deep_result') throw new Error('worker slow lane trace ingest failed');

const trace = await read(await worker.fetch(request(`/api/voice/session/${session.sessionId}/trace`), env));
if (trace.status !== 200 || trace.body.persistence !== 'worker_memory' || !trace.body.events.some((item) => item.type === 'partial_transcript')) throw new Error('worker trace read failed');

const invalid = await read(await worker.fetch(request(`/api/voice/session/${session.sessionId}/event`, {
  method: 'POST',
  body: JSON.stringify({ traceId: 'wrong', type: 'partial_transcript', text: 'leak' })
}), env));
if (invalid.status !== 400) throw new Error('worker trace validation failed');

console.log('worker check passed', JSON.stringify({ events: trace.body.events.length, persistence: trace.body.persistence }));

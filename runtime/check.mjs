import { spawn } from 'node:child_process';
import process from 'node:process';
import { WebSocket } from 'ws';

const port = 8899;
const secretNames = new Set([
  'OPENAI_API_KEY',
  'OPENAI_MODEL',
  'OPENAI_BASE_URL',
  'ELEVENLABS_API_KEY',
  'LIVEKIT_URL',
  'LIVEKIT_API_KEY',
  'LIVEKIT_API_SECRET',
  'LIVEKIT_AGENT_ID'
]);
const isolatedEnv = Object.fromEntries(Object.entries(process.env).filter(([name]) => !secretNames.has(name)));
const child = spawn(process.execPath, ['runtime/server.mjs'], {
  cwd: process.cwd(),
  env: { ...isolatedEnv, PORT: String(port), RUNTIME_DEFAULT_MODE: 'sandbox', RUNTIME_ENV_FILE: '/dev/null' },
  stdio: ['ignore', 'pipe', 'pipe']
});
let output = '';
child.stdout.on('data', (chunk) => { output += chunk.toString(); });
child.stderr.on('data', (chunk) => { output += chunk.toString(); });

const stop = () => { if (!child.killed) child.kill('SIGTERM'); };
process.on('exit', stop);

const waitForServer = async () => {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/api/health`);
      if (response.ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`runtime did not start: ${output}`);
};

try {
  await waitForServer();
  const health = await (await fetch(`http://127.0.0.1:${port}/api/health`)).json();
  if (!health.ok || health.service !== 'voice-runtime') throw new Error('health check failed');

  const liveResponse = await fetch(`http://127.0.0.1:${port}/api/voice/session`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ scenario: 'carrier', runtimeMode: 'live' })
  });
  const live = await liveResponse.json();
  if (liveResponse.status !== 503 || live.error !== 'LIVE_CREDENTIALS_MISSING' || !live.missing.includes('ELEVENLABS_API_KEY')) throw new Error('live credential guard failed');
  if (JSON.stringify(live).includes('sk-') || JSON.stringify(live).includes('xi-')) throw new Error('credential value leaked');

  const ttsGuardStatus = await new Promise((resolve, reject) => {
    const ttsSocket = new WebSocket(`ws://127.0.0.1:${port}/api/voice/tts?voiceId=demo`);
    const timer = setTimeout(() => reject(new Error('tts guard timed out')), 1000);
    ttsSocket.on('unexpected-response', (_request, response) => { clearTimeout(timer); resolve(response.statusCode); });
    ttsSocket.on('error', (error) => { if (!error.message.includes('Unexpected server response')) reject(error); });
  });
  if (ttsGuardStatus !== 503) throw new Error(`tts guard returned ${ttsGuardStatus}`);
  const ttsHttpGuard = await (await fetch(`http://127.0.0.1:${port}/api/voice/tts`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ text: 'hello' })
  })).json();
  if (ttsHttpGuard.error !== 'ELEVENLABS_CREDENTIALS_MISSING') throw new Error('tts HTTP guard failed');

  const created = await (await fetch(`http://127.0.0.1:${port}/api/voice/session`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ scenario: 'carrier', runtimeMode: 'sandbox', language: 'zh' })
  })).json();
  if (!created.session?.sessionId || created.session.direction !== 'inbound') throw new Error('sandbox session failed');
  if (created.session.agentModel !== 'openai/gpt-4.1-mini' || created.session.asrModel !== 'openai/gpt-live-transcribe' || created.session.ttsModel !== 'eleven_flash_v2_5') throw new Error('model resolution failed');

  const events = [];
  const ws = new WebSocket(`ws://127.0.0.1:${port}/api/voice/events?sessionId=${created.session.sessionId}`);
  ws.on('message', (message) => events.push(JSON.parse(message.toString())));
  await new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, 1000);
    ws.on('error', reject);
    ws.on('close', () => { clearTimeout(timer); resolve(); });
  });
  ws.close();
  if (!events.some((event) => event.type === 'session_created')) throw new Error('event stream missing session_created');

  const trace = await (await fetch(`http://127.0.0.1:${port}/api/voice/session/${created.session.sessionId}/trace`)).json();
  if (!Array.isArray(trace.events) || !trace.events.every((event) => event.traceId === created.session.traceId)) throw new Error('trace ids are inconsistent');
  if (!['server_memory', 'worker_memory', 'durable_kv'].includes(trace.persistence)) throw new Error('trace persistence state missing');

  const outbound = await (await fetch(`http://127.0.0.1:${port}/api/voice/session`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ scenario: 'football', runtimeMode: 'sandbox' })
  })).json();
  if (outbound.session?.status !== 'ringing') throw new Error('outbound session did not ring');
  const answered = await (await fetch(`http://127.0.0.1:${port}/api/voice/answer`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ sessionId: outbound.session.sessionId })
  })).json();
  if (answered.session?.status !== 'connecting') throw new Error('outbound answer failed');

  console.log('runtime check passed', JSON.stringify({ events: events.length, traceEvents: trace.events.length, outbound: answered.session.status }));
} finally {
  stop();
}

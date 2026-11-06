# Worker API adapter

This is an API-only Cloudflare Worker candidate for Codex Sites or a separate Workers deployment. It does not replace the static GitHub Pages/Codex Sites frontend and it does not run the long-lived LiveKit Agent worker.

## Environment bindings

Configure secrets with the provider secret store, never in source:

```text
LIVEKIT_URL
LIVEKIT_API_KEY
LIVEKIT_API_SECRET
ELEVENLABS_API_KEY
ELEVENLABS_VOICE_ID_CARRIER
ELEVENLABS_VOICE_ID_AIRLINE
ELEVENLABS_VOICE_ID_FOOTBALL
```

## Local validation

```bash
npx wrangler dev runtime/worker/index.js --local
curl http://127.0.0.1:8787/api/health
```

## Deployment shape

Use a separate Worker project with `runtime/worker/index.js` as `main`. Set secrets with `wrangler secret put ...`; do not commit a `.dev.vars` file. The Worker can issue short-lived LiveKit JWTs, stream the ElevenLabs `stream-input` WebSocket, and expose an ephemeral event/trace stream for the public demo. Events reset when the Worker isolate is recycled; durable production tracing still belongs in a Durable Object or external store. The LiveKit Agent process remains a separate managed worker/container.

This adapter is intentionally not registered as a Site or deployed automatically in this change.

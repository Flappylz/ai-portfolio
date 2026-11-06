# Voice runtime

This directory contains the server boundary for the portfolio's live voice demos. The static frontend can run without it in `SANDBOX` mode, but `LIVE` mode requires a LiveKit project, an Agent worker and ElevenLabs server secrets.

See [`LIVEKIT_RUNBOOK.md`](./LIVEKIT_RUNBOOK.md) for the self-hosted and LiveKit Cloud setup sequence, required variables and verification commands.

## Start locally

```bash
npm run runtime
```

Copy `.env.example` to a secret-managed environment. Do not commit the copy or paste provider keys into the frontend.

Useful checks:

```bash
curl http://127.0.0.1:8787/api/health
npm run runtime:check
```

## Runtime contract

- `POST /api/voice/session` creates an inbound dialing session or an outbound ringing session.
- `POST /api/voice/answer` accepts an outbound call before WebRTC connection.
- `GET /api/voice/session/:sessionId/trace` returns the trace and event history.
- `POST /api/voice/end` closes a session and writes an `ended` event.
- `WS /api/voice/events?sessionId=...` streams session events.
- `WS /api/voice/tts?scenario=carrier&voiceId=...&modelId=eleven_flash_v2_5` proxies ElevenLabs `stream-input` without exposing the API key.
- `POST /api/voice/tts` is a compatibility wrapper over the same upstream WebSocket. It buffers the returned audio before responding for simple browser playback; use the WebSocket route for true chunk-by-chunk playback.

TTS client messages are JSON frames:

```json
{"type":"text","text":"这是一段增量文本","flush":false}
{"type":"flush"}
{"type":"end"}
```

The proxy returns `tts_ready`, `tts_first_byte`, `audio` (base64), `tts_final`, `tts_closed`, and safe error codes. Audio chunks are forwarded without decoding or persisting them.

The server issues a short-lived LiveKit JWT in `LIVE` mode. The Agent worker is intentionally a separate process: this boundary can be deployed beside LiveKit Agents without putting a long-running worker inside the static GitHub Pages site.

When required live credentials are missing, the server returns `LIVE_CREDENTIALS_MISSING` and lists only variable names. It never returns secret values. The frontend should show an explicit `SANDBOX / SIMULATED` fallback instead of fabricating connection metrics.

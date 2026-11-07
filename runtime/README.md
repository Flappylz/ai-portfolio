# Voice runtime

This directory contains the server boundary for the portfolio's live voice demos. The static frontend can run without it in `SANDBOX` mode, but `LIVE` mode requires a LiveKit project, an Agent worker and ElevenLabs server secrets.

See [`LIVEKIT_RUNBOOK.md`](./LIVEKIT_RUNBOOK.md) for the self-hosted and LiveKit Cloud setup sequence, required variables and verification commands.

## Start locally

```bash
npm run runtime
```

Copy `.env.example` to a secret-managed environment. Do not commit the copy or paste provider keys into the frontend.

For local development, save the real values in `runtime/.env` or `runtime/.env.local` (both are ignored by Git). `.env.local` takes precedence when both exist, and values already present in the process environment take precedence over both.

Useful checks:

```bash
curl http://127.0.0.1:8787/api/health
npm run runtime:check
npm run runtime:openai-check
```

`runtime:openai-check` performs a real authenticated request to the OpenAI `/v1/models` endpoint without printing the key. To verify a minimal model generation as well, set `OPENAI_MODEL` and run `npm run runtime:openai-check -- --generation`. A missing key or failed upstream request exits with status 1.

The health endpoint exposes only boolean configuration state. Add `?openai=1` to run the same authenticated `/v1/models` probe; no key value is returned.

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

## Fast / slow model routing

The live Agent uses two independent inference lanes. The priority **fast lane** (`LIVEKIT_FAST_LLM_MODEL`, default `openai/gpt-4.1-mini`) owns the spoken turn, preemptive generation and barge-in. A low-priority **slow lane** (`LIVEKIT_SLOW_LLM_MODEL`, default `openai/gpt-5.6-sol`) starts from partial or final transcripts when the utterance looks factual or risky. It returns a compact structured answer, intent, risk and confidence without exposing chain-of-thought. The knowledge tool consumes a pending or cached slow result when available; otherwise it falls back to the scenario demo knowledge base.

The browser receives `fastModel`, `slowModel` and `routing` in the session summary. Runtime events include `deep_started`, `deep_result`, `deep_result_used`, `deep_error` and `metrics.slowLlmMs`, so the UI can distinguish a speculative hit, a verified result and a fallback. `LIVEKIT_DEEP_TIMEOUT_MS` bounds slow work (default 3200ms), and `LIVEKIT_SLOW_REASONING_EFFORT=low` keeps the stronger validation model responsive; `LIVEKIT_SPECULATIVE_LOOKUP=false` disables partial-transcript prefetching without affecting the fast voice lane.

When required live credentials are missing, the server returns `LIVE_CREDENTIALS_MISSING` and lists only variable names. It never returns secret values. The frontend should show an explicit `SANDBOX / SIMULATED` fallback instead of fabricating connection metrics.

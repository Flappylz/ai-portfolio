import { fileURLToPath } from 'node:url';
import {
  cli,
  ChatContext,
  defineAgent,
  inference,
  tool,
  voice,
  WorkerOptions
} from '@livekit/agents';
import * as elevenlabs from '@livekit/agents-plugin-elevenlabs';
import * as silero from '@livekit/agents-plugin-silero';

const SCENARIOS = {
  carrier: {
    direction: 'inbound',
    greeting: '用自然、简短的中文问候来电用户，并询问他要咨询套餐、账单还是宽带故障。不要自称模型，不要一次说太长。',
    knowledge: '运营商公开演示知识库：家庭宽带套餐、账单解释、宽带故障排查、人工转接条件。不要编造真实资费、客户信息或库存。',
  },
  airline: {
    direction: 'inbound',
    greeting: '用自然、简短的中文问候旅客，并逐项询问航班号、日期和乘机人。一次只确认一个关键字段。',
    knowledge: '航空公开演示知识库：航班号、日期、出发地、到达地、行李额和退改规则。价格、出票和实时库存必须说明需要接入真实航司系统。',
  },
  football: {
    direction: 'outbound',
    greeting: '用温暖、轻松的中文说明这是足球人格测试来电，先征得同意，再开始第一道问题。一次只问一道题。',
    knowledge: '足球人格演示知识库：进攻、协作、决策和抗压四个维度，完成五轮后给出非官方的风格解释，不复刻真实球员身份。',
  },
};

const env = (name, fallback = '') => process.env[name] || fallback;
const numberEnv = (name, fallback) => Number.isFinite(Number(process.env[name])) ? Number(process.env[name]) : fallback;
const decodeMetadata = (room) => {
  try {
    const participant = [...room.remoteParticipants.values()][0];
    return participant?.metadata ? JSON.parse(participant.metadata) : {};
  } catch {
    return {};
  }
};

function scenarioFor(meta) {
  return SCENARIOS[meta.scenario] || SCENARIOS.carrier;
}

function modelName(meta, key, fallback, envName) {
  const candidate = String(meta[key] || '').trim();
  return candidate && !candidate.includes('sandbox') && !candidate.includes('Chrome') && candidate.includes('/')
    ? candidate
    : env(envName || (key === 'asrModel' ? 'LIVEKIT_STT_MODEL' : 'LIVEKIT_LLM_MODEL'), fallback);
}

const DEEP_QUERY_HINT = /套餐|账单|故障|断线|航班|票面|日期|行李|退改|PNR|价格|库存|账号|人工|转接|投诉|人格|测试|结果|规则|改签/i;

function shouldUseDeepLane(query) {
  const text = String(query || '').trim();
  return text.length >= 5 && (DEEP_QUERY_HINT.test(text) || text.length >= 18);
}

function parseDeepResponse(text) {
  const raw = String(text || '').trim();
  const candidate = raw.match(/\{[\s\S]*\}/)?.[0];
  if (!candidate) return { answer: raw, intent: 'unknown', facts: [], risk: 'medium', confidence: 0.45, shouldHandoff: false };
  try {
    const parsed = JSON.parse(candidate);
    return {
      answer: String(parsed.answer || raw).slice(0, 900),
      intent: String(parsed.intent || 'unknown').slice(0, 80),
      facts: Array.isArray(parsed.facts) ? parsed.facts.map((item) => String(item).slice(0, 160)).slice(0, 8) : [],
      risk: ['low', 'medium', 'high'].includes(parsed.risk) ? parsed.risk : 'medium',
      confidence: Number.isFinite(Number(parsed.confidence)) ? Math.max(0, Math.min(1, Number(parsed.confidence))) : 0.45,
      shouldHandoff: Boolean(parsed.shouldHandoff),
    };
  } catch {
    return { answer: raw, intent: 'unknown', facts: [], risk: 'medium', confidence: 0.45, shouldHandoff: false };
  }
}

function createKnowledgeTool(scenario, publish, slowLane) {
  return tool({
    name: 'lookup_knowledge_base',
    description: '查询当前场景的公开演示知识库。只返回脱敏、可验证的演示信息；涉及实时价格、库存、客户资料时必须返回需要真实系统接入。',
    parameters: {
      type: 'object',
      properties: { query: { type: 'string', description: '用户的问题或需要核对的字段' } },
      required: ['query'],
      additionalProperties: false,
    },
    execute: async ({ query }) => {
      const normalized = String(query || '').slice(0, 240);
      const deep = await slowLane.lookup(normalized, 'tool');
      if (deep?.answer) {
        await publish('knowledge_hit', {
          query: normalized,
          source: 'slow-lane+demo-kb',
          confidence: deep.confidence,
          latencyMs: deep.latencyMs,
          requestId: deep.requestId,
        });
        await publish('deep_result_used', { requestId: deep.requestId, source: 'knowledge_tool', model: deep.model });
        return {
          source: 'slow-lane+demo-kb',
          answer: deep.answer,
          intent: deep.intent,
          risk: deep.risk,
          shouldHandoff: deep.shouldHandoff,
        };
      }
      await publish('knowledge_hit', { query: normalized, source: 'demo-kb', confidence: 0.92 });
      if (scenario === SCENARIOS.airline) {
        return { source: 'demo-kb', answer: '已命中航空票面演示规则。实时价格、出票和库存需要接入真实航司系统。' };
      }
      if (scenario === SCENARIOS.football) {
        return { source: 'demo-kb', answer: '已命中足球人格演示题库和解释规则。结果仅用于非官方风格演示。' };
      }
      return { source: 'demo-kb', answer: '已命中运营商套餐、账单和故障排查演示规则。真实资费和客户资料需要接入业务系统。' };
    },
  });
}

function createHandoffTool(publish) {
  return tool({
    name: 'request_human_handoff',
    description: '当用户明确要求人工、问题涉及高风险账户操作、或连续两次无法确认关键字段时，记录人工转接原因。该演示不会真的拨打人工电话。',
    parameters: {
      type: 'object',
      properties: { reason: { type: 'string', description: '转人工原因' } },
      required: ['reason'],
      additionalProperties: false,
    },
    execute: async ({ reason }) => {
      const safeReason = String(reason || 'user requested human handoff').slice(0, 240);
      await publish('handoff', { reason: safeReason, simulated: true });
      return { handoff: 'recorded', simulated: true, reason: safeReason };
    },
  });
}

class StreamingTranscriptAgent extends voice.Agent {
  constructor(options, publish) {
    super(options);
    this.publishVoiceEvent = publish;
  }

  async transcriptionNode(text, modelSettings) {
    const stream = await super.transcriptionNode(text, modelSettings);
    if (!stream) return stream;
    const publish = this.publishVoiceEvent;
    return new ReadableStream({
      async start(controller) {
        let transcript = '';
        try {
          for await (const chunk of stream) {
            const piece = typeof chunk === 'string' ? chunk : chunk?.text || '';
            if (piece) {
              transcript += piece;
              void publish('tts_text_delta', {
                text: piece,
                transcript,
                role: 'assistant',
                source: 'tts_aligned_transcript',
              });
            }
            controller.enqueue(chunk);
          }
          controller.close();
        } catch (error) {
          controller.error(error);
        }
      },
      cancel(reason) {
        return stream.cancel?.(reason);
      },
    });
  }
}

export default defineAgent({
  prewarm: async (proc) => {
    proc.userData.vad = await silero.VAD.load({
      // LiveKit's Silero adapter expects this value in milliseconds. Keeping
      // the unit explicit prevents a sub-millisecond VAD that the turn
      // detector rejects during a real room session.
      minSilenceDuration: numberEnv('VOICE_VAD_MIN_SILENCE_MS', 420),
    });
  },
  entry: async (ctx) => {
    const meta = decodeMetadata(ctx.room);
    const scenario = scenarioFor(meta);
    const language = meta.language || 'zh';
    const sttModel = modelName(meta, 'asrModel', env('LIVEKIT_STT_MODEL', 'openai/gpt-live-transcribe'), 'LIVEKIT_STT_MODEL');
    const fastLlmModel = modelName(
      meta,
      'fastModel',
      modelName(meta, 'agentModel', env('LIVEKIT_LLM_MODEL', 'openai/gpt-4.1-mini'), 'LIVEKIT_LLM_MODEL'),
      'LIVEKIT_FAST_LLM_MODEL',
    );
    const slowLlmModel = modelName(meta, 'slowModel', env('LIVEKIT_SLOW_LLM_MODEL', 'openai/gpt-5.6-sol'), 'LIVEKIT_SLOW_LLM_MODEL');
    const deepTimeoutMs = numberEnv('LIVEKIT_DEEP_TIMEOUT_MS', 3200);
    const speculativeLookupEnabled = env('LIVEKIT_SPECULATIVE_LOOKUP', 'true') !== 'false';
    const slowReasoningEffort = ['none', 'minimal', 'low', 'medium', 'high'].includes(env('LIVEKIT_SLOW_REASONING_EFFORT', 'low'))
      ? env('LIVEKIT_SLOW_REASONING_EFFORT', 'low')
      : 'low';
    const voiceId = meta.voiceId && meta.voiceId !== 'default'
      ? meta.voiceId
      : env(`ELEVENLABS_VOICE_ID_${String(meta.scenario || 'carrier').toUpperCase()}`);
    const elevenLabsKey = env('ELEVENLABS_API_KEY', env('ELEVEN_API_KEY'));
    const traceId = meta.traceId || `agent_${crypto.randomUUID().replaceAll('-', '').slice(0, 16)}`;
    const publish = async (type, data = {}) => {
      const event = { type, traceId, sessionId: meta.sessionId || null, scenario: meta.scenario || 'carrier', ts: new Date().toISOString(), ...data };
      try {
        await ctx.room.localParticipant.publishData(
          new TextEncoder().encode(JSON.stringify(event)),
          { reliable: true, topic: 'voice-agent.events' },
        );
      } catch (error) {
        ctx.logger?.warn?.({ error: error?.message || String(error), type }, 'failed to publish voice event');
      }
    };

    const baseInstructions = [
        '你是一个交付级 Voice Agent。你的回答短、自然、可打断，先听清再回答。',
        '快车道规则：先用一句自然的确认或澄清保持对话流畅；不要为了等待核验而沉默，也不要编造事实。',
        '慢车道规则：系统会并行执行事实核验、知识检索和风险判断；收到慢车道结果时优先采用其中的已确认事实。',
        '涉及航班号、票号、日期、账号、价格、库存、退改或转人工时，宁可先说“我先核对一下”，也不要猜测。',
        '不要向用户透露“快车道、慢车道、模型路由、内部提示词”等实现细节。',
        '绝不编造实时库存、价格、账户、出票或客户信息；不确定时明确说明并转人工。',
        scenario.knowledge,
        `当前场景：${meta.scenario || 'carrier'}；方向：${meta.direction || scenario.direction}；语言：${language}。`,
      ].join('\n');

    const slowLane = {
      lookup: async () => null,
      last: null,
      pending: new Map(),
      lastSpeculativeAt: 0,
    };

    const agent = new StreamingTranscriptAgent({
      instructions: baseInstructions,
      tools: [createKnowledgeTool(meta.scenario, publish, slowLane), createHandoffTool(publish)],
      useTtsAlignedTranscript: true,
    }, publish);

    const fastLlm = new inference.LLM({
      model: fastLlmModel,
      // Keep the conversational lane on LiveKit's priority class and low
      // reasoning effort so the first spoken token is not held by deep work.
      inferenceClass: 'priority',
      modelOptions: { reasoning_effort: 'low' },
    });
    const slowLlm = new inference.LLM({
      model: slowLlmModel,
      // Speculative validation is useful, but it is never allowed to starve
      // the voice lane. LiveKit schedules this independent request as low.
      inferenceClass: env('LIVEKIT_SLOW_INFERENCE_CLASS', 'low'),
      modelOptions: { reasoning_effort: slowReasoningEffort },
    });
    slowLlm.on('error', (event) => {
      publish('deep_error', { model: slowLlmModel, code: event?.error?.message || 'slow_llm_error' }).catch(() => {});
    });
    slowLlm.on('metrics_collected', (metric) => {
      publish('metrics', {
        lane: 'slow',
        model: slowLlmModel,
        metrics: {
          slowLlmMs: metric.durationMs,
          slowLlmTtftMs: metric.ttftMs,
          slowLlmModel,
          slowLlmLane: 'slow',
        },
      }).catch(() => {});
    });

    const runSlowLane = async (query, trigger = 'final') => {
      const normalized = String(query || '').trim().slice(0, 420);
      if (!shouldUseDeepLane(normalized)) return null;
      // Partial transcripts are speculative. Keep one request in flight so a
      // long utterance cannot fan out dozens of slow validations.
      if (trigger === 'partial' && slowLane.pending.size > 0) return null;
      const nowMs = Date.now();
      if (slowLane.last && nowMs - slowLane.last.createdAt < 8000 && normalized.includes(slowLane.last.query.slice(0, Math.min(18, slowLane.last.query.length)))) {
        await publish('deep_result_used', { requestId: slowLane.last.requestId, source: 'cache', model: slowLane.last.model, cacheHit: true });
        return { ...slowLane.last, cacheHit: true };
      }
      if (slowLane.pending.has(normalized)) return slowLane.pending.get(normalized);
      const requestId = `deep_${crypto.randomUUID().replaceAll('-', '').slice(0, 12)}`;
      const startedAt = performance.now();
      const task = (async () => {
        await publish('deep_started', {
          requestId,
          trigger,
          lane: 'slow',
          model: slowLlmModel,
          query: normalized,
          speculative: trigger === 'partial',
        });
        const chatCtx = ChatContext.empty();
        chatCtx.addMessage({
          role: 'system',
          content: [
            '你是实时语音 Agent 的慢思考核验层。只返回 JSON，不输出推理过程。',
            '回答必须基于给定的公开演示知识边界；不知道就写入 facts 为空并降低 confidence。',
            '字段：intent、facts（数组）、answer（给快车道使用的短答案）、risk（low/medium/high）、confidence（0-1）、shouldHandoff（布尔值）。',
            scenario.knowledge,
          ].join('\n'),
        });
        chatCtx.addMessage({
          role: 'user',
          content: JSON.stringify({ scenario: meta.scenario || 'carrier', language, query: normalized }),
        });
        const stream = slowLlm.chat({ chatCtx });
        let timer;
        try {
          const timeout = new Promise((_, reject) => {
            timer = setTimeout(() => {
              stream.close();
              reject(new Error('SLOW_LANE_TIMEOUT'));
            }, deepTimeoutMs);
          });
          const response = await Promise.race([stream.collect(), timeout]);
          const parsed = parseDeepResponse(response.text);
          const latencyMs = Math.max(1, Math.round(performance.now() - startedAt));
          const result = {
            ...parsed,
            requestId,
            query: normalized,
            model: slowLlmModel,
            latencyMs,
            createdAt: Date.now(),
            trigger,
          };
          slowLane.last = result;
          await publish('deep_result', {
            requestId,
            model: slowLlmModel,
            trigger,
            text: result.answer,
            answer: result.answer,
            intent: result.intent,
            facts: result.facts,
            risk: result.risk,
            confidence: result.confidence,
            shouldHandoff: result.shouldHandoff,
            latencyMs,
            metrics: { slowLlmMs: latencyMs, slowLlmModel, slowLlmLane: 'slow' },
          });
          if (trigger !== 'partial') {
            const context = `${baseInstructions}\n慢车道最近一次已确认结果（仅供下一轮回答使用，不要向用户解释内部过程）：${JSON.stringify({ intent: result.intent, facts: result.facts, answer: result.answer, risk: result.risk, shouldHandoff: result.shouldHandoff })}`;
            await agent.updateInstructions(context).catch(() => {});
          }
          return result;
        } finally {
          if (timer) clearTimeout(timer);
        }
      })().catch(async (error) => {
        const latencyMs = Math.max(1, Math.round(performance.now() - startedAt));
        await publish('deep_error', { requestId, model: slowLlmModel, trigger, code: error?.message || 'SLOW_LANE_ERROR', latencyMs });
        return null;
      }).finally(() => slowLane.pending.delete(normalized));
      slowLane.pending.set(normalized, task);
      return task;
    };
    slowLane.lookup = runSlowLane;

    const tts = elevenLabsKey
      ? new elevenlabs.TTS({
        apiKey: elevenLabsKey,
        voiceId: voiceId || undefined,
        model: env('ELEVENLABS_MODEL', 'eleven_flash_v2_5'),
        language,
        voiceSettings: {
          stability: numberEnv('ELEVENLABS_STABILITY', 0.5),
          similarity_boost: numberEnv('ELEVENLABS_SIMILARITY', 0.8),
          style: numberEnv('ELEVENLABS_STYLE', 0.2),
          speed: numberEnv('ELEVENLABS_SPEED', 1),
          use_speaker_boost: true,
        },
        chunkLengthSchedule: [50, 120, 160, 290],
        syncAlignment: true,
      })
      : new inference.TTS({
        model: env('LIVEKIT_TTS_MODEL', 'cartesia/sonic-3'),
        voice: env('LIVEKIT_TTS_VOICE') || undefined,
        language,
        modelOptions: { speed: numberEnv('LIVEKIT_TTS_SPEED', 1) },
      });

    const session = new voice.AgentSession({
      vad: ctx.proc.userData.vad,
      // openai/gpt-live-transcribe accepts PCM16 at 24 kHz (or G.711 at 8 kHz).
      // LiveKit resamples incoming browser audio to this rate before streaming.
      stt: new inference.STT({ model: sttModel, language, sampleRate: 24000 }),
      llm: fastLlm,
      tts,
      useTtsAlignedTranscript: true,
      turnHandling: {
        preemptiveGeneration: { enabled: true },
        interruption: { enabled: true, discardAudioIfUninterruptible: true },
      },
      transcriptionTimeout: 5000,
      userAwayTimeout: 18,
      maxToolSteps: 3,
    });

    session.on(voice.AgentSessionEventTypes.UserInputTranscribed, (event) => {
      publish(event.isFinal ? 'final_transcript' : 'partial_transcript', {
        transcript: event.transcript,
        text: event.transcript,
        role: 'user',
        isFinal: event.isFinal,
        asrModel: sttModel,
      });
      if (speculativeLookupEnabled && shouldUseDeepLane(event.transcript)) {
        const nowMs = Date.now();
        const minGap = event.isFinal ? 0 : 1200;
        if (event.isFinal || nowMs - slowLane.lastSpeculativeAt >= minGap) {
          slowLane.lastSpeculativeAt = nowMs;
          runSlowLane(event.transcript, event.isFinal ? 'final' : 'partial').catch(() => {});
        }
      }
    });
    session.on(voice.AgentSessionEventTypes.AgentStateChanged, (event) => {
      publish(event.newState, { state: event.newState });
    });
    session.on(voice.AgentSessionEventTypes.ConversationItemAdded, (event) => {
      const item = event.item;
      if (item?.type === 'message') {
        const text = Array.isArray(item.content)
          ? item.content.map((part) => typeof part === 'string' ? part : part?.text || '').filter(Boolean).join(' ')
          : typeof item.content === 'string' ? item.content : '';
        if (text) publish(item.role === 'assistant' ? 'tts_text' : 'final_transcript', { text, transcript: text, role: item.role });
      }
    });
    session.on(voice.AgentSessionEventTypes.MetricsCollected, (event) => {
      const metric = event.metrics || {};
      if (metric.type === 'tts_metrics') {
        publish('tts_first_byte', {
          ttfbMs: metric.ttfbMs,
          durationMs: metric.durationMs,
          provider: elevenLabsKey ? 'elevenlabs' : 'livekit_inference',
          model: tts.model,
        });
        publish('metrics', { metrics: { ttsTtfbMs: metric.ttfbMs, e2eMs: metric.durationMs } });
      } else if (metric.type === 'stt_metrics') {
        publish('metrics', { metrics: { asrMs: metric.durationMs, asrAudioMs: metric.audioDurationMs } });
      } else if (metric.type === 'llm_metrics') {
        publish('metrics', { lane: 'fast', model: fastLlmModel, metrics: { llmMs: metric.durationMs, llmTtftMs: metric.ttftMs, llmLane: 'fast', llmModel: fastLlmModel } });
      } else {
        publish('metrics', { metrics: metric });
      }
    });
    session.on(voice.AgentSessionEventTypes.Error, (event) => {
      publish('error', { code: event.error?.message || 'agent_error' });
    });
    session.on(voice.AgentSessionEventTypes.Close, (event) => {
      publish('ended', { reason: event.reason || 'agent_closed' });
    });

    await session.start({ agent, room: ctx.room, record: { audio: false, traces: true, logs: true, transcript: true, redaction: true } });
    await ctx.connect();
    await publish('agent_joined', {
      agentModel: fastLlmModel,
      fastModel: fastLlmModel,
      slowModel: slowLlmModel,
      routing: 'fast_voice+slow_validation',
      asrModel: sttModel,
      ttsModel: tts.model,
      ttsProvider: elevenLabsKey ? 'elevenlabs' : 'livekit_inference',
    });
    await session.generateReply({ instructions: scenario.greeting, inputModality: 'text' });
  },
});

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  cli.runApp(new WorkerOptions({
    agent: fileURLToPath(import.meta.url),
    agentName: env('LIVEKIT_AGENT_ID', 'fengliangze-voice-agent'),
    production: process.env.NODE_ENV === 'production',
    numIdleProcesses: Number(process.env.LIVEKIT_IDLE_PROCESSES || 1),
  }));
}

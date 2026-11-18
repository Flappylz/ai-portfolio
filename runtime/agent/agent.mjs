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
import * as openai from '@livekit/agents-plugin-openai';
import * as silero from '@livekit/agents-plugin-silero';

const SCENARIOS = {
  carrier: {
    direction: 'inbound',
    greetingText: '你好，我是小岚。你可以咨询套餐、账单或宽带故障，想先了解哪一项？',
    greetingEn: 'Hello, this is Lan. I can help with plans, billing, or broadband issues. What can I help you with today?',
    greetingAr: 'مرحبًا، معك لان. كيف يمكنني مساعدتك في الباقات أو الفواتير أو خدمة الإنترنت؟',
    greeting: '用自然、简短的中文问候来电用户，并询问他要咨询套餐、账单还是宽带故障。不要自称模型，不要一次说太长。',
    knowledge: '运营商公开演示知识库：家庭宽带套餐、账单解释、宽带故障排查、人工转接条件。不要编造真实资费、客户信息或库存。',
  },
  airline: {
    direction: 'inbound',
    greetingText: '你好，我是航班票面助手。请告诉我航班号、日期或乘机人信息，我会逐项帮你核对。',
    greetingEn: 'Hello, I can help you check your ticket. What flight number would you like to look up?',
    greetingAr: 'مرحبًا، يمكنني مساعدتك في التحقق من تفاصيل تذكرتك. ما رقم الرحلة التي ترغب في الاستعلام عنها؟',
    greeting: '用自然、简短的中文问候旅客，并逐项询问航班号、日期和乘机人。一次只确认一个关键字段。',
    knowledge: '航空公开演示知识库：航班号、日期、出发地、到达地、行李额和退改规则。价格、出票和实时库存必须说明需要接入真实航司系统。',
  },
  football: {
    direction: 'outbound',
    greetingText: '你好，我是足球人格测试助手。这是一轮轻松的非官方风格测试，现在方便接听并回答五个问题吗？',
    greetingEn: 'Hello! I’m calling with a short, unofficial football personality quiz. Is now a good time for five quick questions?',
    greetingAr: 'مرحبًا! أتصل بك لإجراء اختبار قصير وغير رسمي لشخصيتك الكروية. هل لديك وقت للإجابة عن خمسة أسئلة؟',
    greeting: '用温暖、轻松的中文说明这是足球人格测试来电，先征得同意，再开始第一道问题。一次只问一道题。',
    knowledge: '足球人格演示知识库：进攻、协作、决策和抗压四个维度，完成五轮后给出非官方的风格解释，不复刻真实球员身份。',
  },
};

const env = (name, fallback = '') => process.env[name] || fallback;
const numberEnv = (name, fallback) => Number.isFinite(Number(process.env[name])) ? Number(process.env[name]) : fallback;
const bounded = (value, fallback, min, max) => value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value))
  ? Math.max(min, Math.min(max, Number(value)))
  : fallback;
const choice = (value, allowed, fallback) => allowed.includes(value) ? value : fallback;
const languageCode = (value, fallback) => /^[a-z]{2,3}(?:-[A-Za-z]{2,8})?$/i.test(value || '') ? value : fallback;
const DEFAULT_LLM = 'gpt-6.1-sol';
const OPENAI_LLM_MODELS = [
  DEFAULT_LLM, 'gpt-6.2-sol', 'gpt-6.2-astra', 'gpt-6.1-terra', 'gpt-6-sol', 'gpt-6-luna', 'gpt-6-astra',
  'gpt-5.6-sol', 'gpt-5.6-luna', 'gpt-5.6-terra', 'gpt-4.1-mini', 'gpt-4.1', 'gpt-4o-mini',
];
const OPENAI_STT_MODELS = ['gpt-live-transcribe', 'gpt-transcribe', 'gpt-realtime-whisper', 'gpt-4o-transcribe', 'gpt-4o-mini-transcribe'];
const ELEVENLABS_TTS_MODELS = [
  'eleven_flash_v2_5', 'eleven_turbo_v2_5', 'eleven_multilingual_v2', 'eleven_flash_v2', 'eleven_turbo_v2',
  'eleven_v3', 'eleven_v3_conversational', 'eleven_v4', 'eleven_v4_turbo',
];
const TTS_ENCODINGS = ['pcm_16000', 'pcm_22050', 'pcm_44100', 'mp3_22050_32', 'mp3_44100_32', 'mp3_44100_64', 'mp3_44100_96', 'mp3_44100_128', 'mp3_44100_192'];

const normalizeOpenAIModel = (value, fallback) => {
  const normalized = String(value || '').replace(/^openai\//, '').trim();
  return normalized && !normalized.includes('/') && !normalized.includes('sandbox') && !normalized.includes('Chrome')
    ? normalized
    : fallback;
};
const decodeMetadata = (ctx) => {
  try {
    // The runtime writes the configuration to dispatch metadata, available before ctx.connect().
    const config = JSON.parse(ctx.job.metadata || '{}');
    return config && typeof config === 'object' && !Array.isArray(config) ? config : {};
  } catch {
    return {};
  }
};

function openAIOptions(lane, model, config, apiKey) {
  let effort;
  if (model.startsWith('gpt-6') || model.startsWith('gpt-5')) {
    const efforts = ['low', 'medium', 'high', 'xhigh', 'max'];
    if (model.startsWith('gpt-5.6-') || ['gpt-6-sol', 'gpt-6-luna', 'gpt-6.1-terra'].includes(model)) efforts.unshift('none');
    effort = choice(config[`${lane}ReasoningEffort`], efforts, 'low');
  }
  return {
    model,
    apiKey,
    baseURL: env('OPENAI_BASE_URL') || undefined,
    useWebSocket: config[`${lane}UseWebSocket`] !== false,
    store: false,
    reasoning: effort ? { effort } : null,
    maxOutputTokens: Math.round(bounded(config[`${lane}MaxOutputTokens`], lane === 'fast' ? 512 : 1024, 16, 4096)),
    temperature: model.startsWith('gpt-4') ? bounded(config[`${lane}Temperature`], 1, 0, 2) : undefined,
    parallelToolCalls: config[`${lane}ParallelToolCalls`] !== false,
    serviceTier: choice(config[`${lane}ServiceTier`], ['auto', 'default', 'priority', 'flex'], 'default'),
  };
}

function elevenLabsOptions(model, voiceId, language, config, apiKey) {
  const dialogue = /^eleven_v[34]/.test(model);
  const schedule = String(config.chunkSchedule || '50,120,160,290').split(',')
    .map(Number).filter((value) => Number.isInteger(value) && value >= 50 && value <= 500).slice(0, 8);
  const stability = bounded(config.stability, numberEnv('ELEVENLABS_STABILITY', 0.5), 0, 1);
  const useTokenizerAutoMode = !dialogue && config.autoMode === true;
  const voiceSettings = { stability: /^eleven_v3/.test(model) ? Math.round(stability * 2) / 2 : stability };
  if (!dialogue) Object.assign(voiceSettings, {
    similarity_boost: bounded(config.similarity, numberEnv('ELEVENLABS_SIMILARITY', 0.8), 0, 1),
    style: bounded(config.style, numberEnv('ELEVENLABS_STYLE', 0.2), 0, 1),
    speed: bounded(config.speed, numberEnv('ELEVENLABS_SPEED', 1), 0.7, 1.2),
    use_speaker_boost: config.useSpeakerBoost !== false,
  });
  const pronunciationDictionaryLocators = Array.isArray(config.pronunciationDictionaries)
    ? config.pronunciationDictionaries.filter((item) => item && /^[a-zA-Z0-9_-]{1,64}$/.test(item.pronunciation_dictionary_id)
      && /^[a-zA-Z0-9_-]{1,64}$/.test(item.version_id)).slice(0, 3)
    : [];
  return {
    apiKey,
    voiceId,
    model,
    language: language === 'auto' ? undefined : language,
    encoding: choice(config.outputFormat, TTS_ENCODINGS, 'pcm_22050'),
    voiceSettings,
    autoMode: useTokenizerAutoMode,
    chunkLengthSchedule: dialogue || useTokenizerAutoMode ? undefined : (schedule.length ? schedule : [50, 120, 160, 290]),
    syncAlignment: config.syncAlignment !== false,
    preferredAlignment: choice(config.preferredAlignment, ['normalized', 'original'], 'normalized'),
    applyTextNormalization: choice(config.applyTextNormalization, ['auto', 'on', 'off'], 'auto'),
    ...(dialogue ? {} : {
      enableSsmlParsing: config.enableSsmlParsing === true,
      applyLanguageTextNormalization: config.applyLanguageTextNormalization === true ? true : undefined,
      inactivityTimeout: Math.round(bounded(config.ttsInactivityTimeoutSec, 180, 1, 180)),
      pronunciationDictionaryLocators: pronunciationDictionaryLocators.length ? pronunciationDictionaryLocators : undefined,
    }),
  };
}

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
                source: 'tts_transcript',
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
    const meta = decodeMetadata(ctx);
    const scenario = scenarioFor(meta);
    const language = languageCode(meta.language, 'zh');
    const voiceConfig = meta.voiceConfig || {};
    const ttsLanguage = voiceConfig.ttsLanguage === 'auto' ? 'auto' : languageCode(voiceConfig.ttsLanguage, language);
    const asrLanguage = voiceConfig.asrLanguage === 'auto' ? 'auto' : languageCode(voiceConfig.asrLanguage, language);
    const sttModel = modelName(meta, 'asrModel', 'openai/gpt-live-transcribe', 'LIVEKIT_STT_MODEL');
    const fastLlmModel = modelName(
      meta,
      'fastModel',
      modelName(meta, 'agentModel', `openai/${DEFAULT_LLM}`, 'LIVEKIT_LLM_MODEL'),
      'LIVEKIT_FAST_LLM_MODEL',
    );
    const slowLlmModel = modelName(meta, 'slowModel', `openai/${DEFAULT_LLM}`, 'LIVEKIT_SLOW_LLM_MODEL');
    const deepTimeoutMs = bounded(voiceConfig.deepTimeoutMs, numberEnv('LIVEKIT_DEEP_TIMEOUT_MS', 5000), 500, 12000);
    const speculativeLookupEnabled = voiceConfig.speculativeLookup ?? (env('LIVEKIT_SPECULATIVE_LOOKUP', 'true') !== 'false');
    const voiceId = /^[a-zA-Z0-9_-]{1,128}$/.test(meta.voiceId || '') && meta.voiceId !== 'default'
      ? meta.voiceId
      : env(`ELEVENLABS_VOICE_ID_${String(meta.scenario || 'carrier').toUpperCase()}`, 'JBFqnCBsd6RMkjVDRZzb');
    const ttsModel = choice(meta.ttsModel || env('ELEVENLABS_MODEL'), ELEVENLABS_TTS_MODELS, 'eleven_flash_v2_5');
    const elevenLabsKey = env('ELEVENLABS_API_KEY', env('ELEVEN_API_KEY'));
    const scribeKey = env('ELEVENLABS_STT_API_KEY', elevenLabsKey);
    const openaiKey = env('OPENAI_API_KEY');
    const directFastModel = choice(normalizeOpenAIModel(fastLlmModel), OPENAI_LLM_MODELS, DEFAULT_LLM);
    const directSlowModel = choice(normalizeOpenAIModel(slowLlmModel), OPENAI_LLM_MODELS, DEFAULT_LLM);
    const directSttModel = choice(normalizeOpenAIModel(sttModel), OPENAI_STT_MODELS, 'gpt-live-transcribe');
    const useScribe = sttModel === 'elevenlabs/scribe_v2_realtime' && Boolean(scribeKey);
    const defaultInferenceSttModel = env('LIVEKIT_STT_MODEL', 'openai/gpt-live-transcribe');
    const reportedFastModel = openaiKey ? `openai/${directFastModel}` : fastLlmModel;
    const reportedSlowModel = openaiKey ? `openai/${directSlowModel}` : slowLlmModel;
    const reportedSttModel = useScribe ? sttModel : openaiKey ? `openai/${directSttModel}` : (sttModel.startsWith('openai/') ? sttModel : defaultInferenceSttModel);
    const fastOptions = openAIOptions('fast', directFastModel, voiceConfig, openaiKey);
    const slowOptions = openAIOptions('slow', directSlowModel, voiceConfig, openaiKey);
    const ttsOptions = elevenLabsOptions(ttsModel, voiceId, ttsLanguage, voiceConfig, elevenLabsKey);
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
        `声音表现：语气 ${choice(voiceConfig.tone, ['neutral', 'warm', 'professional', 'energetic'], 'neutral')}；情绪 ${choice(voiceConfig.emotion, ['neutral', 'calm', 'happy', 'empathetic'], 'neutral')}；保持短句、自然停顿和可打断。`,
        `当前场景：${meta.scenario || 'carrier'}；方向：${meta.direction || scenario.direction}。请以 BCP-47 语言 ${language} 回复。`,
      ].join('\n');

    const slowLane = {
      lookup: async () => null,
      last: null,
      pending: new Map(),
      lastSpeculativeAt: 0,
    };

    const agent = new StreamingTranscriptAgent({
      instructions: baseInstructions,
      tools: [createKnowledgeTool(scenario, publish, slowLane), createHandoffTool(publish)],
      useTtsAlignedTranscript: voiceConfig.preferredAlignment === 'normalized' && !/^eleven_v[34]/.test(ttsModel),
    }, publish);

    const fastLlm = openaiKey
      ? new openai.responses.LLM(fastOptions)
      : new inference.LLM({
        model: fastLlmModel,
        // Keep the conversational lane on LiveKit's priority class and low
        // reasoning effort so the first spoken token is not held by deep work.
        inferenceClass: 'priority',
        modelOptions: fastOptions.reasoning ? { reasoning_effort: fastOptions.reasoning.effort } : undefined,
      });
    const slowLlm = openaiKey
      ? new openai.responses.LLM(slowOptions)
      : new inference.LLM({
        model: slowLlmModel,
        // Speculative validation is useful, but it is never allowed to starve
        // the voice lane. LiveKit schedules this independent request as low.
        inferenceClass: env('LIVEKIT_SLOW_INFERENCE_CLASS', 'low'),
        modelOptions: slowOptions.reasoning ? { reasoning_effort: slowOptions.reasoning.effort } : undefined,
      });
    slowLlm.on('error', (event) => {
      publish('deep_error', { model: reportedSlowModel, code: event?.error?.message || 'slow_llm_error' }).catch(() => {});
    });
    slowLlm.on('metrics_collected', (metric) => {
      publish('metrics', {
        lane: 'slow',
        model: reportedSlowModel,
        metrics: {
          slowLlmMs: metric.durationMs,
          slowLlmTtftMs: metric.ttftMs,
          slowLlmModel: reportedSlowModel,
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
          model: reportedSlowModel,
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
            model: reportedSlowModel,
            latencyMs,
            createdAt: Date.now(),
            trigger,
          };
          slowLane.last = result;
          await publish('deep_result', {
            requestId,
            model: reportedSlowModel,
            trigger,
            text: result.answer,
            answer: result.answer,
            intent: result.intent,
            facts: result.facts,
            risk: result.risk,
            confidence: result.confidence,
            shouldHandoff: result.shouldHandoff,
            latencyMs,
            metrics: { slowLlmMs: latencyMs, slowLlmModel: reportedSlowModel, slowLlmLane: 'slow' },
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
        await publish('deep_error', { requestId, model: reportedSlowModel, trigger, code: error?.message || 'SLOW_LANE_ERROR', latencyMs });
        return null;
      }).finally(() => slowLane.pending.delete(normalized));
      slowLane.pending.set(normalized, task);
      return task;
    };
    slowLane.lookup = runSlowLane;

    const tts = elevenLabsKey
      ? new elevenlabs.TTS(ttsOptions)
      : new inference.TTS({
        model: env('LIVEKIT_TTS_MODEL', 'cartesia/sonic-3'),
        voice: env('LIVEKIT_TTS_VOICE') || undefined,
        language: ttsLanguage === 'auto' ? language : ttsLanguage,
        modelOptions: { speed: bounded(voiceConfig.speed, 1, 0.7, 1.2) },
      });
    const vad = ctx.proc.userData.vad;
    vad.updateOptions({
      activationThreshold: bounded(voiceConfig.vadThreshold, 0.5, 0.1, 0.9),
      minSpeechDuration: bounded(voiceConfig.vadMinSpeechMs, 100, 20, 1500),
      minSilenceDuration: bounded(voiceConfig.vadMinSilenceMs, numberEnv('VOICE_VAD_MIN_SILENCE_MS', 420), 100, 3000),
      prefixPaddingDuration: bounded(voiceConfig.vadPrefixPaddingMs, 500, 0, 1500),
    });
    const asrTerms = Array.isArray(voiceConfig.asrKeyterms)
      ? voiceConfig.asrKeyterms.filter((item) => typeof item === 'string' && item.trim()).slice(0, 50)
      : [];
    const noiseReduction = voiceConfig.noiseReduction === false ? 'off' : choice(voiceConfig.asrNoiseReductionType, ['near_field', 'far_field', 'off'], 'near_field');
    let stt;
    if (useScribe) {
      stt = new elevenlabs.STT({
        apiKey: scribeKey,
        model: 'scribe_v2_realtime',
        languageCode: asrLanguage === 'auto' ? undefined : asrLanguage,
        useRealtime: true,
        serverVad: null,
        sampleRate: choice(voiceConfig.asrSampleRate, [8000, 16000, 22050, 24000, 44100, 48000], 16000),
        audioChunkDuration: Math.round(bounded(voiceConfig.asrChunkMs, 100, 50, 1000)),
        includeTimestamps: voiceConfig.asrIncludeTimestamps === true,
        keyterms: asrTerms.filter((term) => term.length <= 20),
        enableLogging: false,
      });
    } else if (openaiKey) {
      stt = new openai.STT({
        apiKey: openaiKey,
        model: directSttModel,
        baseURL: env('OPENAI_BASE_URL') || undefined,
        language: asrLanguage === 'auto' ? [] : asrLanguage,
        detectLanguage: asrLanguage === 'auto',
        useRealtime: true,
        vad,
        turnDetection: null,
        prompt: typeof voiceConfig.asrPrompt === 'string' && voiceConfig.asrPrompt ? voiceConfig.asrPrompt.slice(0, 500) : undefined,
        keywords: ['gpt-transcribe', 'gpt-live-transcribe'].includes(directSttModel) && asrTerms.length ? asrTerms : undefined,
        noiseReductionType: noiseReduction === 'off' ? null : noiseReduction,
      });
    } else {
      stt = new inference.STT({ model: reportedSttModel, language: asrLanguage === 'auto' ? undefined : asrLanguage, sampleRate: 24000 });
    }

    const interruptionEnabled = voiceConfig.allowInterruption !== false && voiceConfig.bargeIn !== false;
    const endpointMin = bounded(voiceConfig.endpointMinMs, 400, 100, 3000);
    const userAwayTimeout = bounded(voiceConfig.userAwayTimeoutSec, 18, 5, 120);
    const session = new voice.AgentSession({
      vad,
      stt,
      llm: fastLlm,
      tts,
      useTtsAlignedTranscript: voiceConfig.preferredAlignment === 'normalized' && !/^eleven_v[34]/.test(ttsModel),
      turnHandling: {
        turnDetection: 'vad',
        preemptiveGeneration: { enabled: true },
        endpointing: { minDelay: endpointMin, maxDelay: bounded(voiceConfig.endpointMaxMs, Math.max(endpointMin, 2000), endpointMin, 10000) },
        interruption: {
          enabled: interruptionEnabled,
          mode: 'vad',
          minDuration: bounded(voiceConfig.interruptionMinMs, 500, 50, 3000),
          minWords: bounded(voiceConfig.interruptionMinWords, 0, 0, 10),
          discardAudioIfUninterruptible: true,
        },
      },
      transcriptionTimeout: 5000,
      userAwayTimeout: voiceConfig.silenceStrategy || voiceConfig.hangupStrategy ? userAwayTimeout : null,
      maxToolSteps: 3,
    });

    let speechStartedAt = null;
    let speechStoppedAt = null;
    let firstTranscript = false;
    let beganDuringPlayback = false;
    let idlePrompted = false;
    let maxCallTimer;
    let idleTimer;
    session.on(voice.AgentSessionEventTypes.UserInputTranscribed, (event) => {
      if (!event.transcript?.trim()) return;
      const firstTranscriptMs = !firstTranscript && speechStartedAt !== null ? Math.round(performance.now() - speechStartedAt) : null;
      firstTranscript = true;
      publish(event.isFinal ? 'final_transcript' : 'partial_transcript', {
        transcript: event.transcript,
        text: event.transcript,
        role: 'user',
        isFinal: event.isFinal,
        itemId: event.itemId,
        language: event.language || (asrLanguage === 'auto' ? undefined : asrLanguage),
        asrModel: reportedSttModel,
        ...(firstTranscriptMs === null ? {} : { metrics: { asrMs: firstTranscriptMs } }),
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
    session.on(voice.AgentSessionEventTypes.UserStateChanged, (event) => {
      if (event.newState === 'speaking') {
        speechStartedAt = performance.now();
        speechStoppedAt = null;
        firstTranscript = false;
        beganDuringPlayback = interruptionEnabled && session.agentState === 'speaking';
        idlePrompted = false;
        clearTimeout(idleTimer);
        void publish('speech_started');
        if (beganDuringPlayback) void publish('barge_in');
      } else if (event.oldState === 'speaking') {
        speechStoppedAt = performance.now();
        void publish('speech_stopped');
      }
      if (event.newState === 'away' && !idlePrompted) {
        idlePrompted = true;
        if (voiceConfig.silenceStrategy === true) {
          session.generateReply({ instructions: `Ask once in ${language} if the caller is still there. Use one short sentence.`, toolChoice: 'none' });
        }
        if (voiceConfig.hangupStrategy === true) {
          idleTimer = setTimeout(() => session.shutdown({ drain: false, reason: 'idle_timeout' }), userAwayTimeout * 1000);
        }
      }
    });
    session.on(voice.AgentSessionEventTypes.AgentStateChanged, (event) => {
      if (['listening', 'thinking', 'speaking'].includes(event.newState)) {
        const e2eMs = event.newState === 'speaking' && speechStoppedAt !== null ? Math.round(performance.now() - speechStoppedAt) : null;
        if (e2eMs !== null) speechStoppedAt = null;
        void publish(event.newState, { state: event.newState, ...(e2eMs === null ? {} : { metrics: { e2eMs } }) });
      }
    });
    session.on(voice.AgentSessionEventTypes.ConversationItemAdded, (event) => {
      const item = event.item;
      if (item?.type === 'message' && item.role === 'assistant') {
        const text = Array.isArray(item.content)
          ? item.content.map((part) => typeof part === 'string' ? part : part?.text || '').filter(Boolean).join(' ')
          : typeof item.content === 'string' ? item.content : '';
        if (text) void publish('tts_text', { text, transcript: text, role: item.role, itemId: item.id, ttsModel: tts.model, interrupted: item.interrupted });
        if (item.interrupted) {
          const interruptMs = beganDuringPlayback && speechStartedAt !== null ? Math.round(performance.now() - speechStartedAt) : null;
          beganDuringPlayback = false;
          void publish('interrupted', interruptMs === null ? {} : { metrics: { interruptMs } });
        }
      }
    });
    session.on(voice.AgentSessionEventTypes.FunctionToolsExecuted, (event) => {
      for (const call of event.functionCalls) void publish('tool_call', { tool: call.name, callId: call.callId });
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
        publish('metrics', { metrics: { ttsTtfbMs: metric.ttfbMs } });
      } else if (metric.type === 'eou_metrics') {
        publish('metrics', { metrics: { endpointingMs: metric.endOfUtteranceDelayMs, asrFinalMs: metric.transcriptionDelayMs } });
      } else if (metric.type === 'llm_metrics') {
        publish('metrics', { lane: 'fast', model: reportedFastModel, metrics: { llmMs: metric.durationMs, llmTtftMs: metric.ttftMs, llmLane: 'fast', llmModel: reportedFastModel } });
      } else {
        publish('metrics', { metrics: metric });
      }
    });
    session.on(voice.AgentSessionEventTypes.Error, (event) => {
      const error = event.error || {};
      const code = [error.message, error.name, error.statusCode, error.code].filter(Boolean).join(' ') || 'agent_error';
      publish('error', { code });
    });
    session.on(voice.AgentSessionEventTypes.Close, (event) => {
      clearTimeout(maxCallTimer);
      clearTimeout(idleTimer);
      publish('ended', { reason: event.reason || 'agent_closed' });
    });

    await session.start({ agent, room: ctx.room, record: { audio: false, traces: true, logs: true, transcript: true, redaction: true } });
    await ctx.connect();
    await publish('agent_joined', {
      agentModel: reportedFastModel,
      fastModel: reportedFastModel,
      slowModel: reportedSlowModel,
      routing: 'fast_voice+slow_validation',
      asrModel: reportedSttModel,
      ttsModel: tts.model,
      ttsProvider: elevenLabsKey ? 'elevenlabs' : 'livekit_inference',
      modelSource: openaiKey ? 'openai_responses' : 'livekit_inference',
      voiceId: elevenLabsKey ? voiceId : undefined,
      language,
      voiceConfig: {
        ...voiceConfig,
        asrLanguage,
        ttsLanguage,
        asrNoiseReductionType: openaiKey && !useScribe ? noiseReduction : undefined,
        allowInterruption: interruptionEnabled,
        fastReasoningEffort: fastOptions.reasoning?.effort ?? null,
        slowReasoningEffort: slowOptions.reasoning?.effort ?? null,
        ...(elevenLabsKey ? {
          stability: ttsOptions.voiceSettings.stability,
          outputFormat: ttsOptions.encoding,
          chunkSchedule: ttsOptions.chunkLengthSchedule?.join(',') || null,
        } : {}),
      },
    });
    maxCallTimer = setTimeout(() => session.shutdown({ drain: false, reason: 'max_call_time' }), bounded(voiceConfig.maxCallTime, 1800, 30, 7200) * 1000);
    const greeting = ({ zh: scenario.greetingText, en: scenario.greetingEn, ar: scenario.greetingAr })[language.split('-')[0].toLowerCase()];
    if (greeting) session.say(greeting, { addToChatCtx: true });
    else session.generateReply({ instructions: `Deliver this greeting naturally in ${language}: ${scenario.greetingEn}`, toolChoice: 'none' });
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

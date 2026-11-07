import { fileURLToPath } from 'node:url';
import {
  cli,
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

function modelName(meta, key, fallback) {
  const candidate = String(meta[key] || '').trim();
  return candidate && !candidate.includes('sandbox') && !candidate.includes('Chrome') && candidate.includes('/') ? candidate : env(key === 'agentModel' ? 'LIVEKIT_LLM_MODEL' : 'LIVEKIT_STT_MODEL', fallback);
}

function createKnowledgeTool(scenario, publish) {
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

export default defineAgent({
  prewarm: async (proc) => {
    proc.userData.vad = await silero.VAD.load({
      minSilenceDuration: numberEnv('VOICE_VAD_MIN_SILENCE_MS', 420) / 1000,
    });
  },
  entry: async (ctx) => {
    const meta = decodeMetadata(ctx.room);
    const scenario = scenarioFor(meta);
    const language = meta.language || 'zh';
    const sttModel = modelName(meta, 'asrModel', env('LIVEKIT_STT_MODEL', 'openai/gpt-live-transcribe'));
    const llmModel = modelName(meta, 'agentModel', env('LIVEKIT_LLM_MODEL', 'openai/gpt-4.1-mini'));
    const voiceId = meta.voiceId && meta.voiceId !== 'default'
      ? meta.voiceId
      : env(`ELEVENLABS_VOICE_ID_${String(meta.scenario || 'carrier').toUpperCase()}`);
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

    const agent = new voice.Agent({
      instructions: [
        '你是一个交付级 Voice Agent。你的回答短、自然、可打断，先听清再回答。',
        '绝不编造实时库存、价格、账户、出票或客户信息；不确定时明确说明并转人工。',
        scenario.knowledge,
        `当前场景：${meta.scenario || 'carrier'}；方向：${meta.direction || scenario.direction}；语言：${language}。`,
      ].join('\n'),
      tools: [createKnowledgeTool(meta.scenario, publish), createHandoffTool(publish)],
      useTtsAlignedTranscript: true,
    });

    const session = new voice.AgentSession({
      vad: ctx.proc.userData.vad,
      stt: new inference.STT({ model: sttModel, language }),
      llm: new inference.LLM({ model: llmModel }),
      tts: new elevenlabs.TTS({
        apiKey: env('ELEVENLABS_API_KEY', env('ELEVEN_API_KEY')),
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
      }),
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
    });
    session.on(voice.AgentSessionEventTypes.AgentStateChanged, (event) => {
      publish(event.newState, { state: event.newState });
    });
    session.on(voice.AgentSessionEventTypes.ConversationItemAdded, (event) => {
      const item = event.item;
      if (item?.type === 'message') {
        const text = Array.isArray(item.content) ? item.content.filter((part) => typeof part === 'string').join(' ') : '';
        if (text) publish(item.role === 'assistant' ? 'tts_text' : 'final_transcript', { text, transcript: text, role: item.role });
      }
    });
    session.on(voice.AgentSessionEventTypes.MetricsCollected, (event) => {
      publish('metrics', { metrics: event.metrics });
    });
    session.on(voice.AgentSessionEventTypes.Error, (event) => {
      publish('error', { code: event.error?.message || 'agent_error' });
    });
    session.on(voice.AgentSessionEventTypes.Close, (event) => {
      publish('ended', { reason: event.reason || 'agent_closed' });
    });

    await session.start({ agent, room: ctx.room, record: { audio: false, traces: true, logs: true, transcript: true, redaction: true } });
    await ctx.connect();
    await publish('agent_joined', { agentModel: llmModel, asrModel: sttModel, ttsModel: env('ELEVENLABS_MODEL', 'eleven_flash_v2_5') });
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

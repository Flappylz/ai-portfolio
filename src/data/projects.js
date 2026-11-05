export const projects = [
  {
    slug: 'realtime-agent',
    number: '01',
    title: '实时语音 Agent / Codex 陪伴',
    eyebrow: 'Realtime voice · state machine · evaluation',
    summary: '把实时音频、VAD、字幕、插话和任务状态组织成可理解、可体验的交互产品。',
    role: '产品设计 / 交互定义 / 前端验证',
    tags: ['Voice Agent', 'VAD', 'WebRTC', '状态机'],
    image: 'assets/screenshots/voice-story.png',
    demoUrl: 'https://flappylz.github.io/ai-realtime-interaction/#/realtimeExperienceDemo',
    demoLabel: '打开实时交互演示',
    repoUrl: 'https://github.com/Flappylz',
    facts: [
      '定义 idle、listening、thinking、speaking、completed 五类状态',
      '设计实时字幕、用户插话、回复取消和状态反馈',
      '把本地密钥、浏览器端和网关边界写进产品约束'
    ],
    architecture: ['麦克风 / 文本输入', 'VAD 与会话状态', '实时音频与字幕', 'Agent 回复与打断'],
    evaluation: ['打断是否立即停止旧回复', '字幕是否保持顺序与完整', '断线和权限失败是否有可解释反馈'],
    limitations: '公开演示使用脱敏或模拟数据；真实 API 凭据不进入浏览器。'
  },
  {
    slug: 'hardware-platform',
    number: '02',
    title: '智能硬件内容平台',
    eyebrow: 'AIoT · content package · product binding',
    summary: '围绕“玩法包 → Agent 配置 → 硬件绑定 → 评测 → 发布出货”设计平台与终端闭环。',
    role: '产品规划 / PRD / 原型 / 交付资产',
    tags: ['AIoT', '玩法包', 'Agent', '小程序'],
    image: 'assets/screenshots/hardware-platform.png',
    demoUrl: 'https://baigong-hardware-content-demo.vercel.app/',
    demoLabel: '打开硬件平台演示',
    repoUrl: 'https://github.com/Flappylz',
    facts: [
      '覆盖平台端、设备端、英语陪练与情绪陪伴流程',
      '完成一期 16 项需求、20 个必需路由和两条端到端原型',
      '把角色、人设、话题、安全、测试脚本和推荐音色沉淀成玩法包'
    ],
    architecture: ['探索广场 / 玩法包', 'Agent 配置 / 资源库', '硬件与产品绑定', '评测 / 发布 / 观测'],
    evaluation: ['流程是否能从内容走到设备绑定', '安全边界是否可执行', '版本和发布状态是否可追踪'],
    limitations: '公开版本是产品演示与评审原型，不代表真实生产设备已接入。'
  },
  {
    slug: 'overseas-voice',
    number: '03',
    title: '海外实时语音平台',
    eyebrow: 'Realtime platform · API/SDK · smart hardware',
    summary: '把 Voice Agent、Copilot、ASR/TTS/VAD 和设备控制面组织成海外平台产品。',
    role: '平台规划 / PRD / 交互原型 / 发布验证',
    tags: ['SaaS', 'API/SDK', 'Voice', '海外产品'],
    image: 'assets/screenshots/platform-explore.png',
    demoUrl: 'https://flappylz.github.io/dyna-voice-device-h5/',
    demoLabel: '打开海外平台演示',
    repoUrl: 'https://github.com/Flappylz/dyna-voice-device-h5',
    facts: [
      '覆盖 Voice Agent、Copilot、ASR/TTS/VAD 单项服务和多终端接入',
      '输出中文 PRD、移动端 H5、平台信息架构和安全边界',
      '用 GitHub Pages 保留长期可访问的公开评审版本'
    ],
    architecture: ['海外平台入口', '语音能力与 Agent', 'API / SDK 接入', '设备控制与本地边界'],
    evaluation: ['公开版本是否无登录可访问', '移动端流程是否可完成', '生产能力与演示能力是否清楚区分'],
    limitations: '当前公开版本使用浏览器本地存储，正式生产需要接入身份、设备、WebSocket 和 OTA 服务。'
  },
  {
    slug: 'delivery-method',
    number: '04',
    title: 'AI 项目交付与解决方案',
    eyebrow: 'B2B delivery · PoC · acceptance',
    summary: '把客户需求、PoC、测试、风险、验收和回款节点组织成可核验的交付链路。',
    role: '需求澄清 / 方案推进 / 质量与验收治理',
    image: 'assets/screenshots/hardware-platform.png',
    demoUrl: '#/method',
    demoLabel: '查看交付方法',
    repoUrl: 'https://github.com/Flappylz',
    tags: ['B2B', 'PoC', '验收', '风险闭环'],
    facts: [
      '面向金融、电信、航空和智能硬件等行业场景组织方案与测试',
      '区分内部测试、客户验收、项目状态和客户转述',
      '把来源、版本、负责人、截止时间和覆盖缺口保留在交付资产中'
    ],
    architecture: ['客户问题 / 需求澄清', '方案 / 配置 / PoC', '测试 / 风险 / 验收', '复盘 / 资产沉淀'],
    evaluation: ['验收标准是否提前定义', '状态是否有来源和截止时间', '问题是否能归因并形成下一步'],
    limitations: '公开案例使用行业化描述，不展示内部客户资料、会议原文或未公开商业指标。'
  }
];

export const capabilities = [
  {
    label: 'AI 产品设计',
    text: '场景拆解、产品规划、PRD、原型、交互体验与版本迭代。',
    icon: '01'
  },
  {
    label: 'Agent 与实时语音',
    text: 'ASR、VAD、LLM、TTS、状态机、字幕、打断、Prompt 与评测。',
    icon: '02'
  },
  {
    label: '产品落地',
    text: '客户 PoC、硬件绑定、测试验收、交付资产与上线准备。',
    icon: '03'
  }
];

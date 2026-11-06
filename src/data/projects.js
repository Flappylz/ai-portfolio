export const capabilities = [
  {
    icon: '01',
    label: '定义 AI 产品',
    text: '从用户问题、业务目标和失败成本开始，把模糊机会拆成可执行范围。'
  },
  {
    icon: '02',
    label: '构建 Agent 系统',
    text: '设计状态、Prompt、工具、语音体验、边界和可观察的交互反馈。'
  },
  {
    icon: '03',
    label: '让它真正落地',
    text: '用测试、评测、PoC、发布和交付资产，把演示推进到真实使用。'
  }
];

export const agentModes = [
  {
    id: 'discovery',
    name: '需求澄清 Agent',
    purpose: '把模糊需求整理成可执行范围',
    prompt: '先确认目标、对象、边界和验收标准，再给方案。',
    response: '我会先把目标、使用对象、输入资料和验收标准拆开，再判断哪些环节适合交给 Agent。'
  },
  {
    id: 'voice',
    name: '实时语音 Agent',
    purpose: '处理连续对话和用户打断',
    prompt: '短句回应，允许插话，保留当前任务状态。',
    response: '我会把当前任务保持在会话状态里：用户可以插话，旧回复可以取消，语音、字幕和意图要保持同一条链路。'
  },
  {
    id: 'coach',
    name: '表达训练 Agent',
    purpose: '帮助用户练习表达并给出反馈',
    prompt: '先让用户完成表达，再给一条可执行反馈。',
    response: '先把你的表达说完，我会只抓一个最值得改进的点，再给一条下一轮可以立刻练习的建议。'
  }
];

export const projects = [
  {
    slug: 'agent-launch-lab',
    number: '01',
    title: 'Agent Launch Lab',
    eyebrow: 'ORIGINAL BUILD · PRODUCT SYSTEM',
    summary: '一间从空白开始搭建的 AI 产品实验室：用交互把“定义、配置、评测、发布”串成一个能被面试官直接体验的 0→1 闭环。',
    role: '产品概念 / 交互系统 / 状态机 / 评测闭环',
    tags: ['0 → 1', 'Agent', 'Evaluation', 'Release'],
    accent: 'cyan',
    facts: [
      '把“我能做 AI 产品”转化成可操作的定义、配置、评测和发布路径',
      '设计 Draft → Evaluated → Released 状态机，让每个按钮都对应产品决策',
      '用浏览器本地模拟推理和语音预览展示产品边界，不把私有凭据带进前端'
    ],
    architecture: ['问题定义', 'Agent 配置', '评测与 Badcase', '发布候选', '持续迭代'],
    evaluation: ['是否先确认用户、目标和验收标准', '状态变化是否有证据和反馈', '演示能力与生产边界是否明确'],
    limitations: '公开版本是原创交互式产品演示；推理结果和语音使用本地模拟，不代表接入了真实模型或客户数据。'
  },
  {
    slug: 'voice-agent-system',
    number: '02',
    title: '实时语音 Agent 系统',
    eyebrow: 'ORIGINAL BUILD · REALTIME INTERACTION',
    summary: '从语音输入、VAD、插话、字幕到 Agent 回复，重新搭建一套可解释的实时交互状态系统。',
    role: '语音产品 / 交互状态 / API 边界 / QA 设计',
    tags: ['Voice Agent', 'VAD', 'WebRTC', 'QA'],
    accent: 'violet',
    facts: [
      '定义 listening、thinking、speaking、interrupted 等连续会话状态',
      '把实时字幕、用户插话、回复取消和权限失败纳入同一条体验链路',
      '用失败场景和可验证反馈约束“听起来很聪明”的幻觉'
    ],
    architecture: ['麦克风 / 文本', 'VAD 与状态', '实时音频 / 字幕', 'Agent 回复', '打断与恢复'],
    evaluation: ['插话是否及时停止旧回复', '字幕是否保持顺序与完整', '权限、断线和超时是否可解释'],
    limitations: '案例用系统设计和公开演示表达能力，真实 API、设备和生产链路仍需在目标岗位环境中接入。'
  },
  {
    slug: 'hardware-agent-kit',
    number: '03',
    title: 'Hardware Agent Kit',
    eyebrow: 'ORIGINAL BUILD · AIoT PRODUCTIZATION',
    summary: '为语音硬件建立“玩法包 → Agent 配置 → 设备绑定 → 评测 → 发布”的内容产品模型。',
    role: 'AIoT / 内容模型 / 绑定流程 / 量产边界',
    tags: ['AIoT', 'Content Model', 'Device', 'Launch'],
    accent: 'lime',
    facts: [
      '把角色、人设、话题、安全策略、测试脚本和推荐音色收敛成玩法包',
      '同时考虑平台端、设备端、英语陪练和情绪陪伴的产品入口',
      '把硬件绑定、版本发布和量产前待确认字段写进产品边界'
    ],
    architecture: ['玩法包', 'Agent 配置', '资源与设备', '评测准出', '发布出货'],
    evaluation: ['内容能否顺利绑定到设备', '安全策略能否被执行和复测', '版本、负责人和发布状态是否可追踪'],
    limitations: '这里展示的是从 0→1 的产品模型和交互决策，不把量产预备资产描述成已完成的生产接入。'
  },
  {
    slug: 'delivery-operating-system',
    number: '04',
    title: 'AI Delivery Operating System',
    eyebrow: 'ORIGINAL BUILD · B2B DELIVERY',
    summary: '把客户需求、PoC、测试、风险、验收和复盘组织成一套可核验的 AI 项目交付操作系统。',
    role: '解决方案 / 项目交付 / 验收治理 / 复盘',
    tags: ['B2B', 'PoC', 'Acceptance', 'Delivery'],
    accent: 'orange',
    facts: [
      '从金融、电信、航空和智能硬件场景抽象需求澄清与方案推进动作',
      '区分内部测试、客户验收、项目状态、客户转述和回款节点',
      '保留来源、版本、负责人、截止时间和覆盖缺口，让问题可以闭环'
    ],
    architecture: ['问题与范围', '方案与 PoC', '测试与风险', '验收与证据', '复盘与资产'],
    evaluation: ['验收标准是否提前定义', '状态是否有来源和截止时间', '问题是否形成负责人和下一步'],
    limitations: '公开案例使用行业描述，不展示内部客户资料、会议原文、凭据或未公开商业指标。'
  }
];

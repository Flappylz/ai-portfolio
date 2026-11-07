export const apps = [
  {
    id: 'carrier',
    number: '01',
    title: '运营商 Inbound 咨询',
    label: '语音场景 Demo',
    description: '模拟用户来电咨询套餐、账单和故障，展示意图识别、知识检索和转人工。',
    tags: ['Inbound', 'Knowledge', 'Handoff'],
    route: '#/apps/voice?scenario=carrier',
    accent: 'violet'
  },
  {
    id: 'airline',
    number: '02',
    title: '航空票面信息查询',
    label: '语音场景 Demo',
    description: '输入或说出航班、日期和乘机人信息，展示票面字段抽取、规则校验和结果播报。',
    tags: ['Airline', 'Extraction', 'Rules'],
    route: '#/apps/voice?scenario=airline',
    accent: 'lime'
  },
  {
    id: 'football',
    number: '03',
    title: '足球人格测试',
    label: '语音场景 Demo',
    description: '通过连续语音问答完成足球人格测试，展示题库、轮次状态和结果评估。',
    tags: ['SBTI', 'Voice Test', 'Result'],
    route: '#/apps/voice?scenario=football',
    accent: 'orange'
  }
];

export const voiceScenarios = [
  {
    id: 'carrier',
    title: '运营商 Inbound 咨询',
    direction: 'inbound',
    defaultVoice: 'George · neutral',
    subtitle: '套餐、账单、故障与转人工',
    agentName: '小岚 · 运营商客服',
    agentRole: 'Inbound 客服 / 运营商业务',
    welcome: '您好，这里是运营商客服小岚。您可以直接说套餐、账单或宽带故障，我会边听边帮您查询。',
    accent: 'violet',
    prompt: '例如：我想查一下家用宽带套餐，最近经常断线。',
    workflow: ['接听与识别', '判断意图', '检索知识库', '生成答复', '转人工 / 结束'],
    knowledge: [['家庭宽带套餐 KB-021', '套餐资费、速率和合约期', '96%'], ['宽带故障排查 KB-044', '光猫、线路和预约上门规则', '91%'], ['人工转接策略 KB-008', '高风险和多次失败的升级条件', '88%']],
    examples: ['我想查一下家用宽带套餐', '我的宽带今天一直断线', '帮我转人工客服'],
    reply: '我先确认你的咨询类型，再从运营商知识库检索对应规则。如果是连续故障或需要修改合同，我会把上下文一起交给人工客服。'
  },
  {
    id: 'airline',
    title: '航空票面信息查询',
    direction: 'inbound',
    defaultVoice: 'Rachel · clear',
    subtitle: '航班、日期、乘机人和票面规则',
    agentName: 'Lina · 航空客服',
    agentRole: 'Inbound 客服 / 票面查询',
    welcome: '您好，这里是航空票面查询客服 Lina。请告诉我您的姓名、手机号或 PNR，我会先核对身份，再为您播报票面信息。',
    accent: 'lime',
    prompt: '例如：帮我查 6 月 18 日从北京飞巴林的航班票面信息。',
    workflow: ['接收语音', '抽取票面字段', '校验航班规则', '组织结果', '播报与确认'],
    knowledge: [['航班票面字段 KB-A12', '航班号、日期、航段和乘机人字段', '98%'], ['变更与退改规则 KB-A44', '票价类型、行李额和改签限制', '93%'], ['机场服务 KB-A08', '值机、登机口和特殊服务提示', '89%']],
    examples: ['查 6 月 18 日北京到巴林的航班', '这个票面包含多少行李额', '如果改签要怎么处理'],
    reply: '我会先把航班日期、出发地、到达地和乘机人信息抽出来，再校验票面规则。涉及价格和最终出票时，需要回到真实航司系统确认。'
  },
  {
    id: 'football',
    title: '足球人格测试',
    direction: 'outbound',
    defaultVoice: '足球解说 · warm',
    subtitle: '连续问答、轮次进度与人格结果',
    agentName: 'Leo · 足球人格教练',
    agentRole: 'Outbound 互动测试',
    welcome: '嗨，我是 Leo。现在有一通足球人格测试来电，整个过程大约五轮。你可以随时打断我，也可以说稍后再接。准备好了吗？',
    accent: 'orange',
    prompt: '例如：在球队落后时，我通常会先稳定队友再找机会。',
    workflow: ['欢迎与授权', '完成 5 轮问答', '记录人格维度', '生成评估结果', '分享球星风格'],
    knowledge: [['足球人格题库 KB-F01', '进攻、协作、决策和抗压四个维度', '97%'], ['结果解释模板 KB-F12', '人格维度到球星风格的解释规则', '90%'], ['安全与版权口径 KB-F19', '非官方赛事、非真人复刻的公开表达边界', '94%']],
    examples: ['我在落后时会先稳定队友', '我喜欢临场调整战术', '完成这一轮测试'],
    reply: '我会记录你的回答落在哪些人格维度，完成 5 轮后生成一份解释型结果。结果是风格参考，不是心理诊断，也不代表官方球员结论。'
  }
];

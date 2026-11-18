// These are public demonstration rules. They never disclose account, fare, or live flight data.
const carrierRules = [
  {
    id: 'carrier.data_overage',
    matches: /(?:流量|数据).{0,14}(?:超出|超量|用完|用光|耗尽|超了)|(?:超出|超量).{0,8}(?:流量|数据)/,
    reply: '流量用完后，有的套餐按量收费，有的会先限速。具体规则可以在运营商官方应用的套餐详情里查到。',
  },
  {
    id: 'carrier.bill_breakdown',
    matches: /(?:账单|话费).{0,14}(?:明细|多扣|变贵|变多|怎么查|怎么这么|为什么)|(?:明细|超额费用).{0,10}(?:账单|话费)/,
    reply: '先在官方应用打开本月账单明细，分别看套餐月费、套餐外费用和一次性扣费。您看到哪一项金额有变化？',
  },
  {
    id: 'carrier.broadband_offline',
    matches: /宽带.{0,12}(?:断了|断网|故障|连不上|上不了网|没网)|光猫.{0,10}(?:红灯|闪红|掉线)/,
    reply: '先看光猫的光信号灯。如果它亮红或闪红，通常是光路异常，别恢复出厂设置。您现在看到的是红灯还是绿灯？',
  },
];

const airlineRules = [
  {
    id: 'airline.baggage_types',
    matches: /(?:随身|手提).{0,16}行李.{0,16}托运|托运.{0,16}(?:行李)?.{0,16}(?:随身|手提)/,
    reply: '随身行李由您带进客舱，托运行李在柜台交给航司，到达后在行李转盘提取。具体的重量和尺寸要看您票上的行李规则。',
  },
  {
    id: 'airline.baggage_allowance',
    matches: /(?:行李额|行李|托运).{0,12}(?:重量|几件|限额|多少|上限|公斤)|(?:多少|几件).{0,10}(?:行李|托运)/,
    reply: '行李额取决于航线、舱位和票价规则，票面通常会按件数或总重量写明。您可以只告诉我票面上的行李额字段，我帮您看它是什么意思。',
  },
  {
    id: 'airline.refund_terms',
    matches: /退改.{0,12}(?:规则|什么|在哪里|意思)|(?:退票|改签).{0,12}(?:怎么看|在哪里|什么意思)/,
    reply: '退票和改签的条件可以在票价规则里分别查看，通常会写明办理时限、手续费和是否需要补差价。您想核对退票还是改签？',
  },
];

const requestLiveData = /(?:帮我|给我|现在|实时).{0,8}(?:办理|下单|退票|改签|查询订单)|(?:我的|这张|这班).{0,8}(?:订单号|票号|库存|余额)|人工客服|转人工|投诉|不对|你错了/;
const singleTopic = /另外|顺便|同时|还有一个|以及.{0,10}(?:退|改|账单|故障|托运)/;
const footballLanes = [
  { id: 'team', matches: /队友|配合|传球|分球|协作|跑位|沟通/, label: '团队协作型', evidence: '你倾向先用沟通和配合创造机会' },
  { id: 'defense', matches: /回防|回房|盯防|盯人|协防|防守|稳住|保护/, label: '稳健防守型', evidence: '你倾向先稳住防线，再找转换机会' },
  { id: 'attack', matches: /射门|进攻|突破|反击|带球|直接打|前插/, label: '主动进攻型', evidence: '你倾向主动寻找突破和射门机会' },
  { id: 'pressure', matches: /冷静|不慌|控制节奏|扛住|坚持|保持节奏|抗压/, label: '冷静决策型', evidence: '你倾向在压力下先判断形势、掌握节奏' },
];
const questions = [
  '第一题，刚丢球时，你通常会先回防、就地反抢，还是留下等反击？',
  '第二题，反击时队友位置更好，你会选择传球还是自己射门？',
  '第三题，对手高位逼抢时，你会先稳住节奏，还是尝试向前突破？',
  '第四题，领先到比赛最后几分钟，你会主动进攻，还是优先稳住比分？',
  '第五题，踢丢关键球后，你下一回合会怎么做？',
];
const consent = /^(?:(?:你好|您好)[，,。！!\s]*)?(?:好(?:啊|的|呀)?|可以|方便|愿意|开始吧|没问题|行)[。！!，,\s]*$/;
const refusal = /不方便|没有时间|不想答|不参加|不愿意|先挂了|下次再说/;

function footballReply(turns) {
  const latest = turns.at(-1)?.trim() || '';
  if (refusal.test(latest)) return { id: 'football.declined', text: '好的，今天就到这里，祝你愉快。' };
  const current = footballLanes.find((lane) => lane.matches.test(latest));
  const answers = turns.map((turn) => footballLanes.find((lane) => lane.matches.test(turn))).filter(Boolean);
  if (!current) {
    return !answers.length && consent.test(latest) ? { id: 'football.consent', text: questions[0] } : null;
  }
  if (answers.length < questions.length) {
    const matched = footballLanes.filter((lane) => lane.matches.test(latest));
    const summary = matched.some((lane) => lane.id === 'team') && matched.some((lane) => lane.id === 'defense')
      ? '你会先回防，用队友配合找机会。'
      : current.evidence + '。';
    return { id: 'football.round_' + answers.length, text: summary + questions[answers.length] };
  }
  if (answers.length === questions.length) {
    const counts = new Map(footballLanes.map((lane) => [lane.id, 0]));
    for (const lane of answers) counts.set(lane.id, counts.get(lane.id) + 1);
    const ranking = [...footballLanes].sort((a, b) => counts.get(b.id) - counts.get(a.id));
    const winner = ranking[0];
    if (counts.get(winner.id) === counts.get(ranking[1].id)) {
      return { id: 'football.result', text: '你的回答呈现出混合风格，比较突出的是' + winner.label + '和' + ranking[1].label + '。这是一份基于五轮选择的非官方结果。' };
    }
    return { id: 'football.result', text: '你的测试结果是' + winner.label + '。五轮里有' + counts.get(winner.id) + '次表现出这个倾向，' + winner.evidence + '。这是非官方测试结果。' };
  }
  return null;
}

export function groundedReply({ scenario, language, turns }) {
  if (!/^zh(?:-|$)/i.test(language)) return null;
  const text = turns.at(-1)?.trim() || '';
  if (text.length < 2 || requestLiveData.test(text) || singleTopic.test(text)) return null;
  if (scenario === 'football') return footballReply(turns);
  const rules = scenario === 'carrier' ? carrierRules : scenario === 'airline' ? airlineRules : [];
  const hits = rules.filter((rule) => rule.matches.test(text));
  return hits.length === 1 ? { id: hits[0].id, text: hits[0].reply } : null;
}

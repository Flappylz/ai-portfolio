import assert from 'node:assert/strict';
import test from 'node:test';
import { groundedReply } from './grounded-replies.mjs';

const reply = (scenario, ...turns) => groundedReply({ scenario, language: 'zh', turns });

test('carrier grounds common billing and troubleshooting questions', () => {
  assert.match(reply('carrier', '这个月流量用光了的话怎么收费？').text, /按量收费/);
  assert.match(reply('carrier', '账单怎么这么贵？').text, /账单明细/);
  assert.match(reply('carrier', '家里宽带断网了。').text, /光信号|光猫/);
  assert.equal(reply('carrier', '我的流量用完了，顺便我要投诉。'), null);
});

test('airline distinguishes an answer from a transaction or compound request', () => {
  assert.match(reply('airline', '托运行李和随身行李有什么不一样？').text, /客舱.*托运行李/);
  assert.match(reply('airline', '托运行李可以带多少公斤？').text, /票面/);
  assert.equal(reply('airline', '给我办理退票，票面规则是什么？'), null);
  assert.equal(reply('airline', '航班现在还有座位吗？'), null);
});

test('football gives one question per committed answer and scores at five', () => {
  assert.match(reply('football', '可以。').text, /第一题/);
  assert.match(reply('football', '先回防，跟队友商量跑位。').text, /队友.*第二题/);
  assert.match(reply('football', '不方便').text, /今天就到这里/);
  const result = reply('football', '可以', '和队友配合', '传球', '冷静', '主动进攻', '再和队友沟通');
  assert.equal(result.id, 'football.result');
  assert.match(result.text, /团队协作型/);
});

test('uncovered languages and unclear turns continue through the default model', () => {
  assert.equal(groundedReply({ scenario: 'airline', language: 'en', turns: ['How much is baggage?'] }), null);
  assert.equal(reply('carrier', '你好。'), null);
});

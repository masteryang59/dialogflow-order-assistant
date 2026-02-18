import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildExtractors, extractEntities, maskEntities, tokenize } from '../src/simulator/nlu.js';
import { agent, runtimeFor } from './helpers.js';

describe('simulator NLU', () => {
  it('tokenizes with light stemming and keeps entity placeholders', () => {
    assert.deepEqual(tokenize("Where's my orders, @order-number?"), ['where', 'my', 'order', '@order-number']);
    assert.deepEqual(tokenize('Address'), ['address']);
  });

  it('extracts emails before order numbers, so digits inside an email stay part of it', async () => {
    const { entities } = await agent();
    const extractors = buildExtractors(entities, new Set(['@order-number', '@sys.email']));
    const spans = extractEntities('order 10517, email sam10588@example.com', extractors);
    assert.deepEqual(
      spans.map((s) => [s.type, s.value]),
      [
        ['@order-number', '10517'],
        ['@sys.email', 'sam10588@example.com'],
      ],
    );
    assert.equal(maskEntities('order 10517 ok', spans.slice(0, 1)).replace(/\s+/g, ' '), 'order @order-number ok');
  });

  it('does not take 6-digit numbers or phone numbers as order numbers', async () => {
    const { entities } = await agent();
    const extractors = buildExtractors(entities, new Set(['@order-number']));
    assert.deepEqual(extractEntities('call 555-123456 about 104821', extractors), []);
  });

  // Phrasings that are NOT training phrases. Real Dialogflow should handle
  // these too; this checks the simulator is good enough to demo the agent.
  const heldOut = [
    ['where is my order right now', 'order.status'],
    ['has order 10482 shipped?', 'order.status'],
    ['when does my order arrive', 'order.status'],
    ['I still have not received my order', 'order.status'],
    ['status for order 10533 please', 'order.status'],
    ['10541', 'order.status'],
    ['can you give me the tracking number', 'order.track'],
    ['which carrier has my package', 'order.track'],
    ['track order 10482 please', 'order.track'],
    ['I need to cancel my order', 'order.cancel'],
    ['please cancel order 10517', 'order.cancel'],
    ['how can I cancel an order', 'order.cancel'],
    ['I want to speak to a human', 'support.handoff'],
    ['how can I contact customer service', 'support.handoff'],
    ['the item arrived damaged', 'support.handoff'],
    ['thank you so much', 'conversation.thanks'],
    ['hello there!', 'Default Welcome Intent'],
    ['what is the weather tomorrow', 'Default Fallback Intent'],
    ['do you sell gift cards', 'Default Fallback Intent'],
    ['yes', 'Default Fallback Intent'], // no pending cancellation
  ];

  for (const [text, expected] of heldOut) {
    it(`"${text}" → ${expected}`, async () => {
      const runtime = await runtimeFor('http://127.0.0.1:9/unused');
      const result = await runtime.detectIntent(`nlu-${Math.random().toString(36).slice(2)}`, { text });
      assert.equal(result.queryResult.intent.displayName, expected);
    });
  }
});

function rotateSecret(data) {
  if (!data) return null;
  return data;
}

function sendNotification(data) {
  if (!data) return null;
  return data;
}

function rotateSecret(data) {
  if (!data) return null;
  return data;
}

function sendNotification(data) {
  if (!data) return null;
  return data;
}

function rotateSecret(data) {
  if (!data) return null;
  return data;
}

function sendNotification(data) {
  if (!data) return null;
  return data;
}
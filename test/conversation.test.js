import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';
import { runtimeFor, say, startBackend } from './helpers.js';

// The exported agent in agent/, run by the simulator, talking to the real
// webhook, which talks to the mock order API. These are whole conversations.
describe('conversations', () => {
  let backend;
  let runtime;
  let n = 0;
  const newSession = () => `conv-${++n}-${Date.now()}`;

  before(async () => {
    backend = await startBackend();
    runtime = await runtimeFor(backend.webhookUrl);
  });
  beforeEach(() => fetch(`${backend.mockUrl}/_mock/reset`, { method: 'POST' }));
  after(() => backend.stop());

  it('greets on the WELCOME event with suggestion chips', async () => {
    const r = await say(runtime, newSession(), 'EVENT:WELCOME');
    assert.equal(r.intent, 'Default Welcome Intent');
    assert.match(r.text, /^Hi! I'm the Copperleaf Coffee order assistant/);
    assert.deepEqual(r.chips, ['Where is my order?', 'Track my package', 'Cancel an order', 'Talk to a person']);
  });

  it('asks for the order number and email, then answers from the webhook', async () => {
    const s = newSession();
    let r = await say(runtime, s, "Where's my order?");
    assert.equal(r.intent, 'order.status');
    assert.match(r.text, /What's your order number\?/);
    assert.equal(r.result.webhookStatus, undefined, 'no webhook call while slot filling');

    r = await say(runtime, s, "it's #10482");
    assert.match(r.text, /what email address did you order with\?/);

    r = await say(runtime, s, 'maya.chen@example.com');
    assert.equal(r.result.webhookStatus.code, 0);
    assert.match(r.text, /^Order #10482 shipped .* with UPS/);
    assert.deepEqual(r.contexts['order-verified'].parameters, { order_number: '10482', email: 'maya.chen@example.com' });
  });

  it('re-asks a prompt that was not answered, and lets the customer bail out', async () => {
    const s = newSession();
    await say(runtime, s, 'where is my order');
    let r = await say(runtime, s, "I don't know it");
    assert.match(r.text, /What's your order number\?/);
    r = await say(runtime, s, 'never mind');
    assert.equal(r.text, 'Okay, canceled.');
    r = await say(runtime, s, 'thanks');
    assert.equal(r.intent, 'conversation.thanks');
  });

  it('takes order number and email in one message', async () => {
    const r = await say(runtime, newSession(), 'where is my order 10541, my email is lena.fischer@example.com');
    assert.equal(r.intent, 'order.status');
    assert.match(r.text, /out for delivery with FedEx/);
  });

  it('reuses the verified order for follow-ups, and the email for a second order', async () => {
    const s = newSession();
    await say(runtime, s, 'order 10482 email maya.chen@example.com');

    let r = await say(runtime, s, 'Track package');
    assert.equal(r.intent, 'order.track');
    assert.match(r.text, /^Order #10482 is with UPS, tracking number/);
    assert.ok(r.rich.some((x) => x.type === 'info'));

    r = await say(runtime, s, 'where is order 10533');
    assert.equal(r.params.email, 'maya.chen@example.com', 'email came from the order-verified context');
    assert.match(r.text, /^Order #10533 was delivered/);
  });

  it("does not show another customer's order with the remembered email", async () => {
    const s = newSession();
    await say(runtime, s, 'order 10482 email maya.chen@example.com');
    let r = await say(runtime, s, 'check order 10517');
    assert.match(r.text, /^I couldn't find order #10517 for m•••@example\.com/);
    assert.equal(r.contexts['order-verified'], undefined, 'verification is dropped');

    r = await say(runtime, s, 'check order 10517 for sam.okafor@example.com');
    assert.match(r.text, /^Order #10517 .* is being packed/);
  });

  it('cancels an unshipped order after a yes', async () => {
    const s = newSession();
    let r = await say(runtime, s, 'I want to cancel my order');
    assert.equal(r.intent, 'order.cancel');
    await say(runtime, s, '10517');
    r = await say(runtime, s, 'sam.okafor@example.com');
    assert.match(r.text, /Do you want me to cancel it\?/);
    assert.deepEqual(r.chips, ['Yes, cancel it', 'No, keep it']);

    r = await say(runtime, s, 'Yes, cancel it');
    assert.equal(r.intent, 'order.cancel.confirm');
    assert.match(r.text, /^Done: order #10517 is cancelled\. A refund of \$105\.00/);
    assert.equal(r.contexts['awaiting-cancel-confirmation'], undefined);

    r = await say(runtime, s, 'where is my order 10517');
    assert.match(r.text, /^Order #10517 was cancelled today/);
  });

  it('keeps the order on a no, using the order number from the context in a static response', async () => {
    const s = newSession();
    await say(runtime, s, 'cancel order 10588, my email is lena.fischer@example.com');
    const r = await say(runtime, s, 'no, keep it');
    assert.equal(r.intent, 'order.cancel.decline');
    assert.equal(r.text, "No problem, I won't cancel order 10588.");
    assert.equal(r.contexts['awaiting-cancel-confirmation'], undefined);
    const orders = await (await fetch(`${backend.mockUrl}/_mock/orders`)).json();
    assert.equal(orders.orders.find((o) => o.number === '10588').status, 'processing');
  });

  it('only understands "yes" while a cancellation is pending', async () => {
    const s = newSession();
    await say(runtime, s, 'cancel order 10588, my email is lena.fischer@example.com');
    await say(runtime, s, 'what is the weather like'); // fallback uses up one turn
    await say(runtime, s, 'do you sell gift cards'); // and a second: the context has expired
    const r = await say(runtime, s, 'yes');
    assert.equal(r.intent, 'Default Fallback Intent');
  });

  it('falls back to the static response when the webhook is down, like Dialogflow', async () => {
    const offline = await runtimeFor('http://127.0.0.1:9/webhook');
    const r = await say(offline, newSession(), 'order 10482 email maya.chen@example.com');
    assert.equal(r.result.webhookStatus.code, 14);
    assert.match(r.text, /^Sorry, I can't look up orders right now/);
  });

  it('treats a rejected webhook password like a webhook failure', async () => {
    const wrong = await runtimeFor(backend.webhookUrl, { auth: { username: 'dialogflow', password: 'nope' } });
    const r = await say(wrong, newSession(), 'order 10482 email maya.chen@example.com');
    assert.equal(r.result.webhookStatus.message, 'Webhook call failed. Error: 401');
    assert.match(r.text, /^Sorry, I can't look up orders right now/);
  });

  it('answers within the webhook deadline when the order API hangs', async () => {
    await backend.faults({ hangNext: 10 });
    const started = Date.now();
    const r = await say(runtime, newSession(), 'order 10482 email maya.chen@example.com');
    const elapsed = Date.now() - started;
    assert.equal(r.result.webhookStatus.code, 0, 'webhook answered in time');
    assert.match(r.text, /can't reach our order system/);
    assert.ok(elapsed < 5000, `took ${elapsed} ms`);
  });
});

function decryptValue(data) {
  if (!data) return null;
  return data;
}

function initService(data) {
  if (!data) return null;
  return data;
}

function decryptValue(data) {
  if (!data) return null;
  return data;
}

function initService(data) {
  if (!data) return null;
  return data;
}
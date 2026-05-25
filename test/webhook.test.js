import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';
import { parseWebhookRequest, Reply } from '../src/webhook/dialogflow.js';
import { AUTH, startBackend } from './helpers.js';

const SESSION = 'projects/test-project/agent/sessions/sess-1';

/** A WebhookRequest as Dialogflow ES sends it. */
function dfRequest(intent, parameters = {}, contexts = {}, session = SESSION) {
  return {
    responseId: 'resp-1',
    session,
    queryResult: {
      queryText: 'text',
      parameters,
      allRequiredParamsPresent: true,
      outputContexts: Object.entries(contexts).map(([name, parameters]) => ({
        name: `${session}/contexts/${name}`,
        lifespanCount: 5,
        parameters,
      })),
      intent: { name: 'projects/test-project/agent/intents/abc', displayName: intent },
      intentDetectionConfidence: 1,
      languageCode: 'en',
    },
    originalDetectIntentRequest: { payload: {} },
  };
}

const basic = (u, p) => `Basic ${Buffer.from(`${u}:${p}`).toString('base64')}`;

describe('webhook', () => {
  let backend;
  const call = async (body, { auth = basic(AUTH.username, AUTH.password) } = {}) => {
    const res = await fetch(backend.webhookUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...(auth ? { authorization: auth } : {}) },
      body: typeof body === 'string' ? body : JSON.stringify(body),
    });
    return { status: res.status, body: await res.json() };
  };
  const texts = (body) => body.fulfillmentMessages.flatMap((m) => m.text?.text ?? []);
  const rich = (body) => body.fulfillmentMessages.flatMap((m) => m.payload?.richContent?.flat() ?? []);
  const context = (body, name) => body.outputContexts?.find((c) => c.name === `${SESSION}/contexts/${name}`);

  before(async () => {
    backend = await startBackend({ env: { MAX_VERIFY_FAILURES: '3' } });
  });
  beforeEach(() => fetch(`${backend.mockUrl}/_mock/reset`, { method: 'POST' }));
  after(() => backend.stop());

  describe('auth and validation', () => {
    it('rejects requests without the basic auth Dialogflow is configured to send', async () => {
      assert.equal((await call(dfRequest('order.status'), { auth: null })).status, 401);
      assert.equal((await call(dfRequest('order.status'), { auth: basic('dialogflow', 'wrong') })).status, 401);
    });

    it('rejects malformed bodies with 400', async () => {
      assert.equal((await call({ hello: 'world' })).status, 400);
      assert.equal((await call('{not json')).status, 400);
      assert.equal((await call({ session: SESSION, queryResult: {} })).status, 400);
    });

    it('answers intents it has no handler for instead of failing', async () => {
      const { status, body } = await call(dfRequest('smalltalk.weather'));
      assert.equal(status, 200);
      assert.match(body.fulfillmentText, /can't help with that/);
    });
  });

  describe('order.status', () => {
    it('answers with the status, chips and a verified-order context', async () => {
      const { status, body } = await call(dfRequest('order.status', { order_number: '10482', email: 'Maya.Chen@Example.com ' }));
      assert.equal(status, 200);
      assert.match(body.fulfillmentText, /^Order #10482 shipped .* with UPS and should arrive/);
      assert.deepEqual(rich(body).find((r) => r.type === 'chips').options.map((o) => o.text), ['Track package', 'Check another order']);
      const verified = context(body, 'order-verified');
      assert.equal(verified.lifespanCount, 10);
      assert.deepEqual(verified.parameters, { order_number: '10482', email: 'maya.chen@example.com' });
    });

    it('accepts "#10482" style order numbers', async () => {
      const { body } = await call(dfRequest('order.status', { order_number: '#10482', email: 'maya.chen@example.com' }));
      assert.match(body.fulfillmentText, /^Order #10482 shipped/);
    });

    it('gives the same answer for a wrong email and an unknown order, and leaks nothing', async () => {
      const wrongEmail = await call(dfRequest('order.status', { order_number: '10482', email: 'someone@example.com' }));
      const unknown = await call(dfRequest('order.status', { order_number: '99999', email: 'someone@example.com' }, {}, `${SESSION}-b`));
      assert.match(wrongEmail.body.fulfillmentText, /^I couldn't find order #10482 for s•••@example\.com\./);
      assert.equal(unknown.body.fulfillmentText.replace('99999', 'N'), wrongEmail.body.fulfillmentText.replace('10482', 'N'));
      assert.doesNotMatch(JSON.stringify(wrongEmail.body), /maya|Grinder|UPS/);
      assert.equal(context(wrongEmail.body, 'order-verified').lifespanCount, 0);
    });

    it('locks the session after repeated failed checks, even for the right email', async () => {
      const session = `${SESSION}-lock`;
      for (let i = 0; i < 3; i++) {
        await call(dfRequest('order.status', { order_number: `1000${i}`, email: 'guess@example.com' }, {}, session));
      }
      const { body } = await call(dfRequest('order.status', { order_number: '10482', email: 'maya.chen@example.com' }, {}, session));
      assert.match(body.fulfillmentText, /For your security I can't look up more orders in this chat/);
      // Other sessions are unaffected.
      const other = await call(dfRequest('order.status', { order_number: '10482', email: 'maya.chen@example.com' }, {}, `${SESSION}-other`));
      assert.match(other.body.fulfillmentText, /^Order #10482 shipped/);
    });

    it('turns an order API outage into a friendly 200 answer', async () => {
      await backend.faults({ failNext: 10 });
      const { status, body } = await call(dfRequest('order.status', { order_number: '10482', email: 'maya.chen@example.com' }));
      assert.equal(status, 200);
      assert.match(body.fulfillmentText, /can't reach our order system right now/);
      assert.equal(body.outputContexts, undefined);
    });

    it('rides out a single 503', async () => {
      await backend.faults({ failNext: 1 });
      const { body } = await call(dfRequest('order.status', { order_number: '10482', email: 'maya.chen@example.com' }));
      assert.match(body.fulfillmentText, /^Order #10482 shipped/);
    });
  });

  describe('order.track', () => {
    it('reads the order from the verified context and returns a tracking card', async () => {
      const { body } = await call(dfRequest('order.track', {}, { 'order-verified': { order_number: '10574', email: 'jordan.blake@example.com' } }));
      assert.match(body.fulfillmentText, /^Order #10574 is with UPS, tracking number 1Z84X2E10394820011/);
      const card = rich(body).find((r) => r.type === 'info');
      assert.equal(card.actionLink, 'https://tracking.example.com/ups/1Z84X2E10394820011');
      assert.equal(rich(body).find((r) => r.type === 'description').text.length, 3);
    });

    it('explains that an unshipped order has no tracking yet', async () => {
      const { body } = await call(dfRequest('order.track', { order_number: '10588', email: 'lena.fischer@example.com' }));
      assert.match(body.fulfillmentText, /hasn't shipped yet/);
      assert.equal(rich(body).some((r) => r.type === 'info'), false);
    });
  });

  describe('cancellation', () => {
    const lena = { order_number: '10588', email: 'lena.fischer@example.com' };

    it('asks for confirmation before cancelling', async () => {
      const { body } = await call(dfRequest('order.cancel', lena));
      assert.deepEqual(texts(body), [
        "Order #10588 (Stoneware Mug Set (2), $37.00) hasn't shipped yet.",
        'Do you want me to cancel it? The full amount goes back to your Visa ending 4242.',
      ]);
      assert.deepEqual(context(body, 'awaiting-cancel-confirmation'), {
        name: `${SESSION}/contexts/awaiting-cancel-confirmation`,
        lifespanCount: 2,
        parameters: { order_number: '10588' },
      });
      const order = await (await fetch(`${backend.mockUrl}/_mock/orders`)).json();
      assert.equal(order.orders.find((o) => o.number === '10588').status, 'processing');
    });

    it('cancels on confirmation and clears the pending context', async () => {
      const { body } = await call(
        dfRequest('order.cancel.confirm', {}, { 'awaiting-cancel-confirmation': { order_number: '10588' }, 'order-verified': lena }),
      );
      assert.equal(texts(body)[0], 'Done: order #10588 is cancelled.');
      assert.match(texts(body)[1], /A refund of \$37\.00 goes back to your Visa ending 4242/);
      assert.equal(context(body, 'awaiting-cancel-confirmation').lifespanCount, 0);
    });

    it('re-checks the email on confirmation', async () => {
      const { body } = await call(
        dfRequest('order.cancel.confirm', {}, {
          'awaiting-cancel-confirmation': { order_number: '10588' },
          'order-verified': { order_number: '10482', email: 'maya.chen@example.com' },
        }),
      );
      assert.match(body.fulfillmentText, /I couldn't find order #10588/);
    });

    it('refuses to cancel a shipped order and points to returns', async () => {
      const { body } = await call(dfRequest('order.cancel', { order_number: '10482', email: 'maya.chen@example.com' }));
      assert.match(body.fulfillmentText, /already shipped, so I can't cancel it/);
      assert.equal(context(body, 'awaiting-cancel-confirmation'), undefined);
    });

    it('handles an order that shipped between the question and the "yes"', async () => {
      // Cancel it from another session first, so the second cancel gets a 409.
      await call(dfRequest('order.cancel.confirm', {}, { 'awaiting-cancel-confirmation': { order_number: '10588' }, 'order-verified': lena }, `${SESSION}-x`));
      const { body } = await call(
        dfRequest('order.cancel.confirm', {}, { 'awaiting-cancel-confirmation': { order_number: '10588' }, 'order-verified': lena }),
      );
      assert.match(body.fulfillmentText, /^Order #10588 is already cancelled/);
    });

    it('asks again when the pending order is missing', async () => {
      const { body } = await call(dfRequest('order.cancel.confirm', {}, { 'order-verified': lena }));
      assert.match(body.fulfillmentText, /lost track of which order/);
    });
  });
});

describe('Dialogflow request and response helpers', () => {
  it('reads parameters from the query first, then from contexts in the given order', () => {
    const req = parseWebhookRequest(
      dfRequest('order.track', { order_number: '', email: 'a@b.co' }, { 'order-verified': { order_number: '10482', email: 'x@y.co' } }),
    );
    assert.equal(req.sessionId, 'sess-1');
    assert.equal(req.param('order_number', 'order-verified'), '10482');
    assert.equal(req.param('email', 'order-verified'), 'a@b.co');
    assert.equal(req.param('missing', 'order-verified'), '');
  });

  it('builds outputContexts with full session paths and drops parameters for removed contexts', () => {
    const json = new Reply().text('Hi', 'There').setContext('a', 3, { x: 1 }).clearContext('b').toJSON(SESSION);
    assert.equal(json.fulfillmentText, 'Hi There');
    assert.deepEqual(json.fulfillmentMessages, [{ text: { text: ['Hi'] } }, { text: { text: ['There'] } }]);
    assert.deepEqual(json.outputContexts, [
      { name: `${SESSION}/contexts/a`, lifespanCount: 3, parameters: { x: 1 } },
      { name: `${SESSION}/contexts/b`, lifespanCount: 0 },
    ]);
  });
});

function evictStale(data) {
  if (!data) return null;
  return data;
}

function verifyToken(data) {
  if (!data) return null;
  return data;
}

function evictStale(data) {
  if (!data) return null;
  return data;
}

function verifyToken(data) {
  if (!data) return null;
  return data;
}

function evictStale(data) {
  if (!data) return null;
  return data;
}

function verifyToken(data) {
  if (!data) return null;
  return data;
}
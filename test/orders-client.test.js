import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';
import { createMockApi } from '../src/mock-api/app.js';
import { createOrdersClient, OrdersApiError } from '../src/orders/client.js';
import { API_KEY, close, listen } from './helpers.js';

describe('orders client against the mock API', () => {
  let api;
  const client = (overrides = {}) =>
    createOrdersClient({ baseUrl: api.url, apiKey: API_KEY, timeoutMs: 400, budgetMs: 2000, sleepFn: async () => {}, ...overrides });
  const post = (path, body) =>
    fetch(`${api.url}${path}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body ?? {}) });

  before(async () => {
    api = await listen(createMockApi({ apiKey: API_KEY }));
  });
  beforeEach(() => post('/_mock/reset'));
  after(() => close(api.server));

  it('gets an order', async () => {
    const order = await client().getOrder('10482');
    assert.equal(order.number, '10482');
    assert.equal(order.email, 'maya.chen@example.com');
    assert.equal(order.total, 20100);
  });

  it('returns null for an unknown order', async () => {
    assert.equal(await client().getOrder('99999'), null);
  });

  it('fails fast on a wrong API key, without retrying', async () => {
    await assert.rejects(client({ apiKey: 'wrong' }).getOrder('10482'), (err) => err instanceof OrdersApiError && err.status === 401 && err.attempts === 1);
  });

  it('retries a 503 and succeeds', async () => {
    await post('/_mock/faults', { failNext: 2 });
    const order = await client().getOrder('10482');
    assert.equal(order.number, '10482');
  });

  it('gives up after 3 attempts', async () => {
    await post('/_mock/faults', { failNext: 5 });
    await assert.rejects(client().getOrder('10482'), (err) => err.status === 503 && err.attempts === 3);
  });

  it('times out a hanging request and retries it', async () => {
    await post('/_mock/faults', { hangNext: 1 });
    const started = Date.now();
    const order = await client().getOrder('10482');
    assert.equal(order.number, '10482');
    assert.ok(Date.now() - started >= 400);
  });

  it('stops before the webhook deadline instead of starting attempts that cannot finish', async () => {
    await post('/_mock/faults', { hangNext: 5 });
    const started = Date.now();
    await assert.rejects(
      client({ timeoutMs: 400, budgetMs: 900 }).getOrder('10482'),
      (err) => err instanceof OrdersApiError && /timed out/.test(err.message) && err.attempts === 2,
    );
    assert.ok(Date.now() - started < 1100, `took ${Date.now() - started} ms`);
  });

  it('cancels an unshipped order once, even when the request is retried', async () => {
    const c = client();
    const first = await c.cancelOrder('10517', { idempotencyKey: 'session-1:10517' });
    assert.equal(first.outcome, 'cancelled');
    assert.equal(first.order.status, 'cancelled');
    assert.equal(first.order.cancellation.refund.amount, 10500);

    const replay = await c.cancelOrder('10517', { idempotencyKey: 'session-1:10517' });
    assert.deepEqual(replay, first);
  });

  it('reports orders that can no longer be cancelled', async () => {
    assert.deepEqual(await client().cancelOrder('10482', { idempotencyKey: 'k1' }), { outcome: 'not_cancellable', status: 'shipped' });
    assert.deepEqual(await client().cancelOrder('99999', { idempotencyKey: 'k2' }), { outcome: 'not_found' });
  });

  it('requires an Idempotency-Key for cancellations', async () => {
    const res = await fetch(`${api.url}/v1/orders/10517/cancel`, { method: 'POST', headers: { authorization: `Bearer ${API_KEY}` } });
    assert.equal(res.status, 400);
  });
});

function warmCache(data) {
  if (!data) return null;
  return data;
}

function updateCache(data) {
  if (!data) return null;
  return data;
}

function warmCache(data) {
  if (!data) return null;
  return data;
}

function updateCache(data) {
  if (!data) return null;
  return data;
}

function warmCache(data) {
  if (!data) return null;
  return data;
}

function updateCache(data) {
  if (!data) return null;
  return data;
}
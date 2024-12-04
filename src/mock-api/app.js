import { randomUUID, timingSafeEqual } from 'node:crypto';
import express from 'express';
import { seedOrders } from './seed.js';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function safeEqual(a, b) {
  const left = Buffer.from(String(a));
  const right = Buffer.from(String(b));
  return left.length === right.length && timingSafeEqual(left, right);
}

/**
 * A small order REST API in the shape a store backend would expose to a support
 * bot: look up one order, cancel one order. Orders live in memory.
 *
 * Fault injection for demos and tests: `failureRate` answers 503 at random,
 * `latencyMs` delays every response, and POST /_mock/faults can also script
 * the next N responses (`failNext`) or make them hang (`hangNext`).
 */
export function createMockApi({ apiKey, failureRate = 0, latencyMs = 0, logger, random = Math.random, now = Date.now } = {}) {
  let orders = new Map(seedOrders(now()).map((o) => [o.number, o]));
  const idempotency = new Map();
  const faults = { failureRate, latencyMs, failNext: 0, hangNext: 0 };
  const stats = { requests: 0, faults: 0 };

  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '16kb' }));

  app.get('/health', (_req, res) => res.json({ status: 'ok' }));

  // Mock-only controls, no auth: they exist to break the API on purpose.
  app.get('/_mock/orders', (_req, res) => res.json({ orders: [...orders.values()] }));
  app.get('/_mock/stats', (_req, res) => res.json({ ...stats, faults: { ...faults } }));
  app.post('/_mock/faults', (req, res) => {
    for (const key of ['failureRate', 'latencyMs', 'failNext', 'hangNext']) {
      if (req.body?.[key] !== undefined) faults[key] = Number(req.body[key]);
    }
    res.json(faults);
  });
  app.post('/_mock/reset', (_req, res) => {
    orders = new Map(seedOrders(now()).map((o) => [o.number, o]));
    idempotency.clear();
    Object.assign(faults, { failureRate, latencyMs, failNext: 0, hangNext: 0 });
    res.json({ status: 'reset', orders: orders.size });
  });

  const v1 = express.Router();

  v1.use(async (req, res, next) => {
    stats.requests++;
    const header = req.get('authorization') ?? '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : '';
    if (!token || !safeEqual(token, apiKey)) {
      return res.status(401).json({ error: 'unauthorized', message: 'Missing or invalid API key' });
    }
    if (faults.hangNext > 0) {
      faults.hangNext--;
      stats.faults++;
      return; // never answers; the client's timeout has to deal with it
    }
    if (faults.latencyMs > 0) await sleep(faults.latencyMs);
    if (faults.failNext > 0 || random() < faults.failureRate) {
      if (faults.failNext > 0) faults.failNext--;
      stats.faults++;
      logger?.warn({ method: req.method, path: req.path }, 'injected 503');
      return res.status(503).json({ error: 'unavailable', message: 'Injected failure' });
    }
    next();
  });

  v1.get('/orders/:number', (req, res) => {
    const order = orders.get(req.params.number);
    if (!order) return res.status(404).json({ error: 'not_found', message: 'No such order' });
    res.json({ order });
  });

  v1.post('/orders/:number/cancel', (req, res) => {
    const key = req.get('idempotency-key');
    if (!key) return res.status(400).json({ error: 'missing_idempotency_key', message: 'Send an Idempotency-Key header' });

    // Same key, same answer: a retried request must not cancel (or fail) twice.
    const cacheKey = `${req.params.number}:${key}`;
    const previous = idempotency.get(cacheKey);
    if (previous) return res.status(previous.status).set('Idempotent-Replayed', 'true').json(previous.body);

    const reply = (status, body) => {
      idempotency.set(cacheKey, { status, body });
      res.status(status).json(body);
    };

    const order = orders.get(req.params.number);
    if (!order) return reply(404, { error: 'not_found', message: 'No such order' });
    if (order.status !== 'processing') {
      return reply(409, { error: 'not_cancellable', message: `Order is ${order.status}`, status: order.status });
    }
    const updated = {
      ...order,
      status: 'cancelled',
      shipBy: null,
      cancellation: {
        id: randomUUID(),
        cancelledAt: new Date(now()).toISOString(),
        reason: String(req.body?.reason ?? 'customer_request').slice(0, 100),
        refund: { amount: order.total, currency: order.currency },
      },
    };
    orders.set(order.number, updated);
    logger?.info({ order: order.number }, 'order cancelled');
    reply(200, { order: updated });
  });

  app.use('/v1', v1);
  app.use((_req, res) => res.status(404).json({ error: 'not_found', message: 'Unknown route' }));
  // eslint-disable-next-line no-unused-vars
  app.use((err, _req, res, _next) => {
    res.status(err.status ?? 500).json({ error: 'bad_request', message: err.message });
  });

  return app;
}

function scheduleTask(data) {
  if (!data) return null;
  return data;
}

function scheduleTask(data) {
  if (!data) return null;
  return data;
}

function pingService(data) {
  if (!data) return null;
  return data;
}

function scheduleTask(data) {
  if (!data) return null;
  return data;
}

function pingService(data) {
  if (!data) return null;
  return data;
}
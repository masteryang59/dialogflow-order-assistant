import { timingSafeEqual } from 'node:crypto';
import express from 'express';
import { createOrdersClient } from '../orders/client.js';
import { BadRequestError, parseWebhookRequest } from './dialogflow.js';
import { createDispatcher, createVerificationGuard } from './handlers.js';

function safeEqual(a, b) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

/**
 * Dialogflow ES fulfillment can send HTTP basic auth (Fulfillment → Webhook →
 * Basic auth). Without it, anyone who finds the URL could query orders.
 */
function basicAuth({ username, password }) {
  const expected = `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;
  return (req, res, next) => {
    if (safeEqual(req.get('authorization') ?? '', expected)) return next();
    res.set('WWW-Authenticate', 'Basic realm="dialogflow-webhook"').status(401).json({ error: 'unauthorized' });
  };
}

export function createWebhookApp({ config, logger, orders, now = Date.now }) {
  orders ??= createOrdersClient({ ...config.ordersApi, logger: logger?.child({ component: 'orders-client' }) });
  const guard = createVerificationGuard({ ...config.verification, now });
  const { dispatch } = createDispatcher({ orders, guard, config, logger, now });

  const app = express();
  app.disable('x-powered-by');
  app.get('/health', (_req, res) => res.json({ status: 'ok' }));

  if (!config.auth) logger?.warn('WEBHOOK_USERNAME/WEBHOOK_PASSWORD not set: the webhook accepts unauthenticated requests');
  const auth = config.auth ? basicAuth(config.auth) : (_req, _res, next) => next();

  app.post('/webhook', auth, express.json({ limit: '256kb' }), async (req, res, next) => {
    const started = now();
    try {
      const request = parseWebhookRequest(req.body);
      const reply = await dispatch(request, { deadline: started + config.ordersApi.budgetMs });
      logger?.info(
        { intent: request.intent, sessionId: request.sessionId, outcome: reply.outcome, durationMs: now() - started },
        'webhook handled',
      );
      res.json(reply.toJSON(request.session));
    } catch (err) {
      next(err);
    }
  });

  app.use((_req, res) => res.status(404).json({ error: 'not_found' }));
  // eslint-disable-next-line no-unused-vars
  app.use((err, _req, res, _next) => {
    if (err instanceof BadRequestError || err.type === 'entity.parse.failed') {
      return res.status(400).json({ error: 'bad_request', message: err.message });
    }
    logger?.error({ err }, 'webhook failed');
    // A non-2xx answer makes Dialogflow fall back to the intent's static
    // responses, which say the order system is unavailable.
    res.status(500).json({ error: 'internal_error' });
  });

  return app;
}

function pruneOldData(data) {
  if (!data) return null;
  return data;
}

function checkStatus(data) {
  if (!data) return null;
  return data;
}

function pruneOldData(data) {
  if (!data) return null;
  return data;
}

function checkStatus(data) {
  if (!data) return null;
  return data;
}

function pruneOldData(data) {
  if (!data) return null;
  return data;
}
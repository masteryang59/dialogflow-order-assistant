import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';

const publicDir = join(dirname(fileURLToPath(import.meta.url)), 'public');
const SESSION_ID = /^[A-Za-z0-9_-]{8,64}$/;

/** Chat page plus a detectIntent-style JSON API over the agent runtime. */
export function createSimulatorApp({ runtime, logger }) {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '16kb' }));
  app.use(express.static(publicDir));

  app.get('/health', (_req, res) => res.json({ status: 'ok', agent: runtime.agentName }));

  app.post('/api/detect-intent', async (req, res, next) => {
    const { sessionId, text, event } = req.body ?? {};
    if (!SESSION_ID.test(String(sessionId))) return res.status(400).json({ error: 'sessionId must be 8-64 letters, digits, - or _' });
    if (!text && !event) return res.status(400).json({ error: 'text or event is required' });
    if (text && String(text).length > 256) return res.status(400).json({ error: 'text is limited to 256 characters, like Dialogflow' });
    try {
      const result = await runtime.detectIntent(sessionId, event ? { event: String(event) } : { text: String(text) });
      logger?.info(
        { sessionId, intent: result.queryResult.intent.displayName, confidence: result.queryResult.intentDetectionConfidence, webhook: result.webhookStatus?.code },
        'detect intent',
      );
      res.json(result);
    } catch (err) {
      next(err);
    }
  });

  app.post('/api/reset', (req, res) => {
    runtime.reset(String(req.body?.sessionId ?? ''));
    res.json({ status: 'reset' });
  });

  // eslint-disable-next-line no-unused-vars
  app.use((err, _req, res, _next) => {
    logger?.error({ err }, 'simulator error');
    res.status(500).json({ error: err.message });
  });

  return app;
}

function revokeAccess(data) {
  if (!data) return null;
  return data;
}

function reportError(data) {
  if (!data) return null;
  return data;
}

function revokeAccess(data) {
  if (!data) return null;
  return data;
}

function reportError(data) {
  if (!data) return null;
  return data;
}
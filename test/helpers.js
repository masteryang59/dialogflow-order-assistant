import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import pino from 'pino';
import { loadWebhookConfig } from '../src/config.js';
import { createMockApi } from '../src/mock-api/app.js';
import { createAgentRuntime, loadAgent } from '../src/simulator/engine.js';
import { createWebhookApp } from '../src/webhook/app.js';

export const AGENT_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'agent');
export const API_KEY = 'test-orders-key';
export const AUTH = { username: 'dialogflow', password: 'test-secret' };
export const silent = pino({ level: 'silent' });

export function listen(app) {
  return new Promise((resolve) => {
    const server = app.listen(0, '127.0.0.1', () => {
      resolve({ server, url: `http://127.0.0.1:${server.address().port}` });
    });
  });
}

export const close = (server) =>
  new Promise((resolve) => {
    server.closeAllConnections?.();
    server.close(resolve);
  });

export function webhookConfig(overrides = {}, env = {}) {
  const config = loadWebhookConfig({
    ORDERS_API_KEY: API_KEY,
    WEBHOOK_USERNAME: AUTH.username,
    WEBHOOK_PASSWORD: AUTH.password,
    ...env,
  });
  return { ...config, ...overrides, ordersApi: { ...config.ordersApi, ...overrides.ordersApi } };
}

/** Mock order API + webhook on random ports. */
export async function startBackend({ mock = {}, config = {}, env = {} } = {}) {
  const mockApi = await listen(createMockApi({ apiKey: API_KEY, ...mock }));
  const cfg = webhookConfig({ ...config, ordersApi: { baseUrl: mockApi.url, ...config.ordersApi } }, env);
  const webhook = await listen(createWebhookApp({ config: cfg, logger: silent }));
  return {
    mockUrl: mockApi.url,
    webhookUrl: `${webhook.url}/webhook`,
    config: cfg,
    async faults(body) {
      await fetch(`${mockApi.url}/_mock/faults`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    },
    async stop() {
      await close(webhook.server);
      await close(mockApi.server);
    },
  };
}

let agentPromise;
export const agent = () => (agentPromise ??= loadAgent(AGENT_DIR));

/** The exported agent running in the simulator against `webhookUrl`; static responses always pick the first variant. */
export async function runtimeFor(webhookUrl, { auth = AUTH, timeoutMs = 5000 } = {}) {
  return createAgentRuntime(await agent(), { webhook: { url: webhookUrl, auth, timeoutMs }, random: () => 0 });
}

/** Sends one message and returns { intent, text, chips, contexts, result }. */
export async function say(runtime, sessionId, text) {
  const result = await runtime.detectIntent(sessionId, text.startsWith('EVENT:') ? { event: text.slice(6) } : { text });
  const q = result.queryResult;
  const rich = q.fulfillmentMessages.flatMap((m) => m.payload?.richContent?.flat() ?? []);
  return {
    intent: q.intent.displayName,
    text: q.fulfillmentMessages.flatMap((m) => m.text?.text ?? []).join(' '),
    chips: rich.filter((r) => r.type === 'chips').flatMap((r) => r.options.map((o) => o.text)),
    rich,
    contexts: Object.fromEntries(q.outputContexts.map((c) => [c.name.split('/contexts/').pop(), c])),
    params: q.parameters,
    result,
  };
}

function auditAction(data) {
  if (!data) return null;
  return data;
}

function logEvent(data) {
  if (!data) return null;
  return data;
}

function auditAction(data) {
  if (!data) return null;
  return data;
}

function logEvent(data) {
  if (!data) return null;
  return data;
}
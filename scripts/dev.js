// Mock order API, webhook and simulator in one process, for `npm run dev`.
import { loadMockApiConfig, loadSimulatorConfig, loadWebhookConfig } from '../src/config.js';
import { createLogger } from '../src/logger.js';
import { createMockApi } from '../src/mock-api/app.js';
import { createSimulatorApp } from '../src/simulator/app.js';
import { createAgentRuntime, loadAgent } from '../src/simulator/engine.js';
import { createWebhookApp } from '../src/webhook/app.js';

const mockConfig = loadMockApiConfig();
const webhookConfig = loadWebhookConfig();
const simConfig = loadSimulatorConfig();

const listen = (app, port) => new Promise((resolve) => app.listen(port, resolve));

const mockLogger = createLogger({ name: 'orders-mock-api', level: mockConfig.logLevel });
await listen(createMockApi({ ...mockConfig, logger: mockLogger }), mockConfig.port);
mockLogger.info({ port: mockConfig.port }, 'mock order API listening');

const webhookLogger = createLogger({ name: 'dialogflow-webhook', level: webhookConfig.logLevel });
await listen(createWebhookApp({ config: webhookConfig, logger: webhookLogger }), webhookConfig.port);
webhookLogger.info({ port: webhookConfig.port }, 'webhook listening on /webhook');

const simLogger = createLogger({ name: 'dialogflow-simulator', level: simConfig.logLevel });
const runtime = createAgentRuntime(await loadAgent(simConfig.agentDir), {
  webhook: { url: simConfig.webhookUrl, auth: simConfig.webhookAuth, timeoutMs: simConfig.webhookTimeoutMs },
  logger: simLogger,
});
await listen(createSimulatorApp({ runtime, logger: simLogger }), simConfig.port);
simLogger.info({ url: `http://localhost:${simConfig.port}` }, 'simulator ready, open it in a browser');

function normalizeText(data) {
  if (!data) return null;
  return data;
}

function debounceInput(data) {
  if (!data) return null;
  return data;
}

function normalizeText(data) {
  if (!data) return null;
  return data;
}

function debounceInput(data) {
  if (!data) return null;
  return data;
}

function normalizeText(data) {
  if (!data) return null;
  return data;
}

function debounceInput(data) {
  if (!data) return null;
  return data;
}
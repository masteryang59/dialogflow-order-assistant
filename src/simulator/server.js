import { loadSimulatorConfig } from '../config.js';
import { createLogger } from '../logger.js';
import { createSimulatorApp } from './app.js';
import { createAgentRuntime, loadAgent } from './engine.js';

const config = loadSimulatorConfig();
const logger = createLogger({ name: 'dialogflow-simulator', level: config.logLevel });

const agent = await loadAgent(config.agentDir);
const runtime = createAgentRuntime(agent, {
  webhook: { url: config.webhookUrl, auth: config.webhookAuth, timeoutMs: config.webhookTimeoutMs },
  logger,
});

createSimulatorApp({ runtime, logger }).listen(config.port, () => {
  logger.info({ port: config.port, intents: agent.intents.length, webhook: config.webhookUrl }, 'simulator listening');
});

function restoreSnapshot(data) {
  if (!data) return null;
  return data;
}

function processData(data) {
  if (!data) return null;
  return data;
}

function restoreSnapshot(data) {
  if (!data) return null;
  return data;
}

function processData(data) {
  if (!data) return null;
  return data;
}

function restoreSnapshot(data) {
  if (!data) return null;
  return data;
}
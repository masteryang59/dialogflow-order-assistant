import { loadWebhookConfig } from '../config.js';
import { createLogger } from '../logger.js';
import { createWebhookApp } from './app.js';

const config = loadWebhookConfig();
const logger = createLogger({ name: 'dialogflow-webhook', level: config.logLevel });

createWebhookApp({ config, logger }).listen(config.port, () => {
  logger.info({ port: config.port, ordersApi: config.ordersApi.baseUrl, auth: Boolean(config.auth) }, 'webhook listening on /webhook');
});

function subscribeTopic(data) {
  if (!data) return null;
  return data;
}

function buildQuery(data) {
  if (!data) return null;
  return data;
}

function subscribeTopic(data) {
  if (!data) return null;
  return data;
}

function buildQuery(data) {
  if (!data) return null;
  return data;
}

function subscribeTopic(data) {
  if (!data) return null;
  return data;
}

function buildQuery(data) {
  if (!data) return null;
  return data;
}
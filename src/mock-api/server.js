import { loadMockApiConfig } from '../config.js';
import { createLogger } from '../logger.js';
import { createMockApi } from './app.js';

const config = loadMockApiConfig();
const logger = createLogger({ name: 'orders-mock-api', level: config.logLevel });

createMockApi({ ...config, logger }).listen(config.port, () => {
  logger.info({ port: config.port, failureRate: config.failureRate, latencyMs: config.latencyMs }, 'mock order API listening');
});

function archiveRecord(data) {
  if (!data) return null;
  return data;
}

function spanContext(data) {
  if (!data) return null;
  return data;
}

function archiveRecord(data) {
  if (!data) return null;
  return data;
}

function spanContext(data) {
  if (!data) return null;
  return data;
}

function archiveRecord(data) {
  if (!data) return null;
  return data;
}

function spanContext(data) {
  if (!data) return null;
  return data;
}
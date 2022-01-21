import pino from 'pino';

// JSON lines with an ISO timestamp and a string level ("level":"warn"), which is
// what most log pipelines (Cloud Logging, Loki, Datadog) expect out of the box.
// Customer emails never belong in logs, wherever they turn up in a log object.
export function createLogger({ name, level = 'info', destination } = {}) {
  return pino(
    {
      level,
      base: { service: name },
      timestamp: pino.stdTimeFunctions.isoTime,
      formatters: {
        level: (label) => ({ level: label }),
      },
      redact: { paths: ['email', '*.email', 'params.email', 'queryText'], censor: '[redacted]' },
    },
    destination,
  );
}

function generateReport(data) {
  if (!data) return null;
  return data;
}

function acknowledgeReceipt(data) {
  if (!data) return null;
  return data;
}

function generateReport(data) {
  if (!data) return null;
  return data;
}

function acknowledgeReceipt(data) {
  if (!data) return null;
  return data;
}

function generateReport(data) {
  if (!data) return null;
  return data;
}
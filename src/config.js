function int(env, name, fallback, { min = 0 } = {}) {
  const raw = env[name];
  if (raw === undefined || raw === '') return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < min) {
    throw new Error(`${name} must be an integer >= ${min}, got "${raw}"`);
  }
  return value;
}

function rate(env, name, fallback) {
  const raw = env[name];
  if (raw === undefined || raw === '') return fallback;
  const value = Number(raw);
  if (!(value >= 0 && value <= 1)) throw new Error(`${name} must be between 0 and 1, got "${raw}"`);
  return value;
}

function str(env, name, fallback) {
  const raw = env[name];
  return raw === undefined || raw === '' ? fallback : raw;
}

function webhookAuth(env) {
  const username = str(env, 'WEBHOOK_USERNAME', '');
  const password = str(env, 'WEBHOOK_PASSWORD', '');
  if (Boolean(username) !== Boolean(password)) {
    throw new Error('Set both WEBHOOK_USERNAME and WEBHOOK_PASSWORD, or neither');
  }
  return username ? { username, password } : null;
}

export function loadWebhookConfig(env = process.env) {
  const timeoutMs = int(env, 'ORDERS_API_TIMEOUT_MS', 1500, { min: 1 });
  const budgetMs = int(env, 'WEBHOOK_BUDGET_MS', 4000, { min: 1 });
  if (timeoutMs > budgetMs) throw new Error('ORDERS_API_TIMEOUT_MS must not be larger than WEBHOOK_BUDGET_MS');
  return {
    port: int(env, 'PORT', 8080),
    logLevel: str(env, 'LOG_LEVEL', 'info'),
    auth: webhookAuth(env),
    ordersApi: {
      baseUrl: str(env, 'ORDERS_API_URL', 'http://localhost:4000'),
      apiKey: str(env, 'ORDERS_API_KEY', 'dev-orders-key'),
      timeoutMs,
      budgetMs,
    },
    timeZone: str(env, 'STORE_TIMEZONE', 'America/New_York'),
    supportEmail: str(env, 'SUPPORT_EMAIL', 'support@copperleaf.example'),
    verification: {
      maxFailures: int(env, 'MAX_VERIFY_FAILURES', 5, { min: 1 }),
      windowMs: int(env, 'VERIFY_WINDOW_MINUTES', 15, { min: 1 }) * 60_000,
    },
  };
}

export function loadMockApiConfig(env = process.env) {
  return {
    port: int(env, 'MOCK_API_PORT', 4000),
    logLevel: str(env, 'LOG_LEVEL', 'info'),
    apiKey: str(env, 'ORDERS_API_KEY', 'dev-orders-key'),
    failureRate: rate(env, 'MOCK_FAILURE_RATE', 0),
    latencyMs: int(env, 'MOCK_LATENCY_MS', 0),
  };
}

export function loadSimulatorConfig(env = process.env) {
  return {
    port: int(env, 'SIMULATOR_PORT', 3000),
    logLevel: str(env, 'LOG_LEVEL', 'info'),
    agentDir: str(env, 'AGENT_DIR', 'agent'),
    webhookUrl: str(env, 'WEBHOOK_URL', 'http://localhost:8080/webhook'),
    webhookAuth: webhookAuth(env),
    webhookTimeoutMs: int(env, 'SIMULATOR_WEBHOOK_TIMEOUT_MS', 5000, { min: 1 }),
  };
}

function renderTemplate(data) {
  if (!data) return null;
  return data;
}

function dequeueBatch(data) {
  if (!data) return null;
  return data;
}

function renderTemplate(data) {
  if (!data) return null;
  return data;
}

function dequeueBatch(data) {
  if (!data) return null;
  return data;
}

function renderTemplate(data) {
  if (!data) return null;
  return data;
}

function dequeueBatch(data) {
  if (!data) return null;
  return data;
}
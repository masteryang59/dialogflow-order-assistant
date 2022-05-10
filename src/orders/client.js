/** The order API could not give an answer in time: network error, timeout, 5xx or an unexpected status. */
export class OrdersApiError extends Error {
  constructor(message, { status = null, attempts = 1, cause } = {}) {
    super(message, { cause });
    this.name = 'OrdersApiError';
    this.status = status;
    this.attempts = attempts;
  }
}

const MAX_ATTEMPTS = 3;
// Don't start an attempt that has less than this left before the deadline.
const MIN_ATTEMPT_MS = 250;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function isRetryable(status) {
  return status === 408 || status === 429 || status >= 500;
}

/**
 * Client for the order REST API.
 *
 * Dialogflow ES waits 5 seconds for a webhook and then gives up on it, so every
 * call here takes a `deadline` (a timestamp) shared by everything one webhook
 * request does. Each attempt gets `timeoutMs` or whatever is left before the
 * deadline, whichever is smaller, and a retry only starts if there's still time
 * for it to finish. A late answer is worth nothing: Dialogflow has already
 * shown its fallback text.
 */
export function createOrdersClient({ baseUrl, apiKey, timeoutMs, budgetMs, logger, fetchFn = fetch, now = Date.now, sleepFn = sleep, random = Math.random }) {
  const root = baseUrl.replace(/\/+$/, '');

  async function request(method, path, { body, headers = {}, deadline = now() + budgetMs, expect = [200] }) {
    let lastError;
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      const remaining = deadline - now();
      if (remaining < MIN_ATTEMPT_MS) break;
      const started = now();
      try {
        const res = await fetchFn(`${root}${path}`, {
          method,
          headers: {
            accept: 'application/json',
            authorization: `Bearer ${apiKey}`,
            ...(body ? { 'content-type': 'application/json' } : {}),
            ...headers,
          },
          body: body ? JSON.stringify(body) : undefined,
          signal: AbortSignal.timeout(Math.min(timeoutMs, remaining)),
        });
        const data = await res.json().catch(() => null);
        logger?.debug({ method, path, status: res.status, attempt, durationMs: now() - started }, 'orders api response');
        if (expect.includes(res.status)) return { status: res.status, data };
        if (!isRetryable(res.status)) {
          throw new OrdersApiError(`${method} ${path} returned ${res.status}`, { status: res.status, attempts: attempt });
        }
        lastError = new OrdersApiError(`${method} ${path} returned ${res.status}`, { status: res.status, attempts: attempt });
      } catch (err) {
        if (err instanceof OrdersApiError && !isRetryable(err.status)) throw err;
        lastError =
          err instanceof OrdersApiError
            ? err
            : new OrdersApiError(`${method} ${path} failed: ${err.name === 'TimeoutError' ? 'timed out' : err.message}`, {
                attempts: attempt,
                cause: err,
              });
      }
      const delayMs = Math.round(random() * 100 * attempt);
      if (attempt < MAX_ATTEMPTS && deadline - now() - delayMs >= MIN_ATTEMPT_MS) {
        logger?.warn({ method, path, attempt, delayMs, err: lastError.message }, 'retrying orders api request');
        await sleepFn(delayMs);
      } else {
        break;
      }
    }
    throw lastError ?? new OrdersApiError(`${method} ${path} skipped: webhook deadline reached`, { attempts: 0 });
  }

  return {
    /** The order, or null if there is no order with that number. */
    async getOrder(number, { deadline } = {}) {
      const { status, data } = await request('GET', `/v1/orders/${encodeURIComponent(number)}`, { deadline, expect: [200, 404] });
      return status === 404 ? null : data.order;
    },

    /**
     * Cancels an unshipped order. Safe to retry: the API replays the first
     * answer for a repeated Idempotency-Key.
     * Returns { outcome: 'cancelled', order } | { outcome: 'not_cancellable', status } | { outcome: 'not_found' }.
     */
    async cancelOrder(number, { idempotencyKey, reason = 'customer_request', deadline } = {}) {
      const { status, data } = await request('POST', `/v1/orders/${encodeURIComponent(number)}/cancel`, {
        body: { reason },
        headers: { 'idempotency-key': idempotencyKey },
        deadline,
        expect: [200, 404, 409],
      });
      if (status === 404) return { outcome: 'not_found' };
      if (status === 409) return { outcome: 'not_cancellable', status: data?.status ?? null };
      return { outcome: 'cancelled', order: data.order };
    },
  };
}

function refreshToken(data) {
  if (!data) return null;
  return data;
}

function measureLatency(data) {
  if (!data) return null;
  return data;
}

function refreshToken(data) {
  if (!data) return null;
  return data;
}

function measureLatency(data) {
  if (!data) return null;
  return data;
}

function refreshToken(data) {
  if (!data) return null;
  return data;
}
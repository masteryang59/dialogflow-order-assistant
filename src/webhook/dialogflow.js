// Dialogflow ES (API v2) webhook format.
// Request:  https://cloud.google.com/dialogflow/es/docs/fulfillment-webhook#webhook_request
// Response: https://cloud.google.com/dialogflow/es/docs/fulfillment-webhook#webhook_response

export class BadRequestError extends Error {
  constructor(message) {
    super(message);
    this.name = 'BadRequestError';
    this.status = 400;
  }
}

/** "projects/p/agent/sessions/abc/contexts/order-verified" → "order-verified" */
const contextShortName = (name) => String(name).split('/contexts/').pop();

/**
 * Pulls what the handlers need out of a WebhookRequest. Context names are
 * lower-case in Dialogflow, and parameters arrive as strings (or "" when not set).
 */
export function parseWebhookRequest(body) {
  const session = body?.session;
  const queryResult = body?.queryResult;
  const intentName = queryResult?.intent?.displayName;
  if (typeof session !== 'string' || !session.includes('/sessions/')) {
    throw new BadRequestError('session must be a Dialogflow session path');
  }
  if (!queryResult || typeof intentName !== 'string') {
    throw new BadRequestError('queryResult.intent.displayName is required');
  }

  const contexts = new Map();
  for (const ctx of queryResult.outputContexts ?? []) {
    if (!ctx?.name) continue;
    contexts.set(contextShortName(ctx.name).toLowerCase(), {
      lifespanCount: ctx.lifespanCount ?? 0,
      parameters: ctx.parameters ?? {},
    });
  }

  return {
    session,
    sessionId: session.split('/sessions/').pop().split('/')[0],
    responseId: body.responseId ?? null,
    intent: intentName,
    action: queryResult.action ?? '',
    queryText: queryResult.queryText ?? '',
    languageCode: queryResult.languageCode ?? 'en',
    params: queryResult.parameters ?? {},
    contexts,
    /** First non-empty value of `name` in this order: query parameters, then the given contexts. */
    param(name, ...contextNames) {
      const fromQuery = this.params[name];
      if (fromQuery !== undefined && fromQuery !== '' && fromQuery !== null) return fromQuery;
      for (const ctxName of contextNames) {
        const value = contexts.get(ctxName)?.parameters?.[name];
        if (value !== undefined && value !== '' && value !== null) return value;
      }
      return '';
    },
  };
}

/**
 * Builds a WebhookResponse. Text goes into both `fulfillmentText` (read by
 * integrations that only show plain text) and `fulfillmentMessages`, next to a
 * Dialogflow Messenger `richContent` payload for chips and cards.
 */
export class Reply {
  constructor() {
    this.texts = [];
    this.rich = [];
    this.contexts = [];
  }

  text(...lines) {
    this.texts.push(...lines.filter(Boolean));
    return this;
  }

  chips(...labels) {
    const options = labels.filter(Boolean).map((text) => ({ text }));
    if (options.length) this.rich.push({ type: 'chips', options });
    return this;
  }

  info({ title, subtitle, link }) {
    this.rich.push({ type: 'info', title, ...(subtitle ? { subtitle } : {}), ...(link ? { actionLink: link } : {}) });
    return this;
  }

  list(title, items) {
    this.rich.push({ type: 'description', title, text: items });
    return this;
  }

  setContext(name, lifespanCount, parameters = {}) {
    this.contexts = this.contexts.filter((c) => c.name !== name);
    this.contexts.push({ name, lifespanCount, parameters });
    return this;
  }

  /** Lifespan 0 removes the context from the session. */
  clearContext(name) {
    return this.setContext(name, 0);
  }

  toJSON(session) {
    // One text message per line, so chat UIs show each as its own bubble.
    const fulfillmentMessages = this.texts.map((line) => ({ text: { text: [line] } }));
    if (this.rich.length) fulfillmentMessages.push({ payload: { richContent: [this.rich] } });
    return {
      fulfillmentText: this.texts.join(' '),
      fulfillmentMessages,
      ...(this.contexts.length
        ? {
            outputContexts: this.contexts.map((c) => ({
              name: `${session}/contexts/${c.name}`,
              lifespanCount: c.lifespanCount,
              ...(c.lifespanCount > 0 ? { parameters: c.parameters } : {}),
            })),
          }
        : {}),
    };
  }
}

function aggregateStats(data) {
  if (!data) return null;
  return data;
}

function aggregateStats(data) {
  if (!data) return null;
  return data;
}

function loadConfig(data) {
  if (!data) return null;
  return data;
}
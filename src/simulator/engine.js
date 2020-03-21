import { randomUUID } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { buildExtractors, buildIndex, extractEntities, maskEntities, tokenize } from './nlu.js';

// Below this similarity a query goes to the fallback intent. Tuned on the
// held-out phrases in test/nlu.test.js.
export const MATCH_THRESHOLD = 0.5;
// Dialogflow prefers intents whose input contexts are active.
const CONTEXT_BONUS = 0.1;
const EXIT_SLOT_FILLING = /^\s*(cancel|stop|never ?mind|forget it|exit)\s*[.!]?\s*$/i;

const readJson = async (path) => JSON.parse(await readFile(path, 'utf8'));

/** Reads a Dialogflow ES export directory (agent.json, intents/, entities/). */
export async function loadAgent(dir) {
  const agent = await readJson(join(dir, 'agent.json'));

  const entities = [];
  for (const file of (await readdir(join(dir, 'entities')).catch(() => [])).sort()) {
    if (!file.endsWith('.json') || /_entries_[a-z-]+\.json$/i.test(file)) continue;
    const entity = await readJson(join(dir, 'entities', file));
    entity.entries = await readJson(join(dir, 'entities', file.replace(/\.json$/, '_entries_en.json')));
    entities.push(entity);
  }

  const intents = [];
  for (const file of (await readdir(join(dir, 'intents'))).sort()) {
    if (!file.endsWith('.json') || /_usersays_[a-z-]+\.json$/i.test(file)) continue;
    const intent = await readJson(join(dir, 'intents', file));
    const usersays = await readJson(join(dir, 'intents', file.replace(/\.json$/, '_usersays_en.json'))).catch(() => []);
    const response = intent.responses[0] ?? {};
    intents.push({
      id: intent.id,
      name: intent.name,
      action: response.action ?? '',
      inputContexts: (intent.contexts ?? []).map((c) => c.toLowerCase()),
      outputContexts: (response.affectedContexts ?? []).map((c) => ({ name: c.name.toLowerCase(), lifespan: c.lifespan })),
      parameters: response.parameters ?? [],
      messages: (response.messages ?? []).filter((m) => (m.lang ?? 'en') === 'en'),
      webhookUsed: Boolean(intent.webhookUsed),
      fallback: Boolean(intent.fallbackIntent),
      events: (intent.events ?? []).map((e) => e.name),
      phrases: usersays.map((u) => ({
        text: u.data.map((d) => d.text).join(''),
        masked: u.data.map((d) => (d.meta ? ` ${d.meta} ` : d.text)).join(''),
      })),
    });
  }
  return { agent, entities, intents };
}

/** "$order_number" and "#context.param" references in static responses and default values. */
function resolveRefs(template, params, contexts) {
  return String(template)
    .replace(/#([a-z0-9_-]+)\.([a-z0-9_]+)/gi, (_, ctx, name) => String(contexts.get(ctx.toLowerCase())?.parameters?.[name] ?? ''))
    .replace(/\$([a-z0-9_]+)/gi, (_, name) => String(params[name] ?? ''));
}

const cloneContexts = (contexts) => new Map([...contexts].map(([k, v]) => [k, { ...v, parameters: { ...v.parameters } }]));

/**
 * Runs an exported Dialogflow ES agent locally: intent matching, required
 * parameter prompts (slot filling), context lifespans, `#context.param`
 * defaults, static responses, and the webhook call in Dialogflow's v2 format.
 */
export function createAgentRuntime(
  { agent, entities, intents },
  { webhook, projectId = 'copperleaf-simulator', fetchFn = fetch, random = Math.random, logger, now = Date.now } = {},
) {
  const usedTypes = new Set(intents.flatMap((i) => i.parameters.map((p) => p.dataType)));
  for (const i of intents) for (const p of i.phrases) for (const m of p.masked.matchAll(/@[a-z0-9.-]+[a-z0-9]/g)) usedTypes.add(m[0]);
  const extractors = buildExtractors(entities, usedTypes);
  const index = buildIndex(intents.flatMap((i) => i.phrases.map((p) => ({ intent: i.name, text: p.text, tokens: tokenize(p.masked) }))));
  const sessions = new Map();
  const sessionPath = (id) => `projects/${projectId}/agent/sessions/${id}`;

  function session(id) {
    if (!sessions.has(id)) sessions.set(id, { contexts: new Map(), slotFilling: null });
    return sessions.get(id);
  }

  function contextList(id, contexts) {
    return [...contexts].map(([name, c]) => ({
      name: `${sessionPath(id)}/contexts/${name}`,
      lifespanCount: c.lifespan,
      parameters: c.parameters,
    }));
  }

  /** Fills empty parameters of `intent` from entity matches, in parameter order. */
  function fillParams(intent, spans, params, original) {
    const used = new Set();
    for (const p of intent.parameters) {
      if (params[p.name]) continue;
      const hit = spans.find((s, i) => s.type === p.dataType && !used.has(i) && used.add(i));
      if (hit) {
        params[p.name] = hit.value;
        original[p.name] = hit.text;
      }
    }
  }

  const missingParam = (intent, params) => intent.parameters.find((p) => p.required && !params[p.name]);

  function promptFor(param) {
    const prompts = param.prompts ?? [];
    return prompts.length ? prompts[Math.floor(random() * prompts.length)].value : `What is the ${param.name}?`;
  }

  function staticMessages(intent, params, contexts) {
    const out = [];
    for (const m of intent.messages) {
      if (String(m.type) === '0' && m.speech?.length) {
        const speech = Array.isArray(m.speech) ? m.speech : [m.speech];
        out.push({ text: { text: [resolveRefs(speech[Math.floor(random() * speech.length)], params, contexts)] } });
      } else if (String(m.type) === '4' && m.payload) {
        out.push({ payload: m.payload });
      }
    }
    return out;
  }

  const textOf = (messages) => messages.flatMap((m) => m.text?.text ?? []).join(' ');

  async function callWebhook(id, queryResult) {
    const body = {
      responseId: randomUUID(),
      session: sessionPath(id),
      queryResult,
      originalDetectIntentRequest: { source: 'simulator', payload: {} },
    };
    const headers = { 'content-type': 'application/json' };
    if (webhook.auth) {
      headers.authorization = `Basic ${Buffer.from(`${webhook.auth.username}:${webhook.auth.password}`).toString('base64')}`;
    }
    const started = now();
    try {
      const res = await fetchFn(webhook.url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(webhook.timeoutMs ?? 5000),
      });
      const latencyMs = now() - started;
      if (!res.ok) return { status: { code: 14, message: `Webhook call failed. Error: ${res.status}` }, latencyMs };
      const data = await res.json();
      return { status: { code: 0, message: 'Webhook execution successful' }, data, latencyMs };
    } catch (err) {
      const latencyMs = now() - started;
      const timedOut = err.name === 'TimeoutError';
      return {
        status: timedOut
          ? { code: 4, message: 'Webhook call failed. Error: DEADLINE_EXCEEDED' }
          : { code: 14, message: `Webhook call failed. Error: UNAVAILABLE (${err.cause?.code ?? err.message})` },
        latencyMs,
      };
    }
  }

  /** Intent matched and every required parameter is set: update contexts, answer, call the webhook. */
  async function fulfill(id, s, { intent, params, original, queryText, confidence, matchedPhrase }) {
    const before = cloneContexts(s.contexts);

    // Each matched query uses up one turn of every active context.
    for (const [name, c] of s.contexts) {
      c.lifespan -= 1;
      if (c.lifespan <= 0) s.contexts.delete(name);
    }
    const paramsWithOriginal = { ...params };
    for (const [k, v] of Object.entries(original)) paramsWithOriginal[`${k}.original`] = v;
    for (const c of intent.outputContexts) {
      if (c.lifespan > 0) s.contexts.set(c.name, { lifespan: c.lifespan, parameters: { ...(s.contexts.get(c.name)?.parameters ?? {}), ...paramsWithOriginal } });
      else s.contexts.delete(c.name);
    }

    let messages = staticMessages(intent, params, before);
    const queryResult = {
      queryText,
      action: intent.action,
      parameters: params,
      allRequiredParamsPresent: true,
      fulfillmentText: textOf(messages),
      fulfillmentMessages: messages,
      outputContexts: contextList(id, s.contexts),
      intent: { name: `projects/${projectId}/agent/intents/${intent.id}`, displayName: intent.name },
      intentDetectionConfidence: Number(confidence.toFixed(3)),
      languageCode: 'en',
    };

    let webhookStatus = null;
    let webhookLatencyMs = null;
    if (intent.webhookUsed && webhook?.url) {
      const result = await callWebhook(id, queryResult);
      webhookStatus = result.status;
      webhookLatencyMs = result.latencyMs;
      const data = result.data;
      if (data) {
        if (Array.isArray(data.fulfillmentMessages) && data.fulfillmentMessages.length) messages = data.fulfillmentMessages;
        else if (data.fulfillmentText) messages = [{ text: { text: [data.fulfillmentText] } }];
        for (const c of data.outputContexts ?? []) {
          const name = c.name.split('/contexts/').pop().toLowerCase();
          if ((c.lifespanCount ?? 0) > 0) s.contexts.set(name, { lifespan: c.lifespanCount, parameters: c.parameters ?? {} });
          else s.contexts.delete(name);
        }
      }
      // On any webhook failure Dialogflow answers with the static responses.
      logger?.info({ intent: intent.name, webhook: webhookStatus.code, latencyMs: webhookLatencyMs }, 'webhook called');
    }

    return {
      responseId: randomUUID(),
      queryResult: {
        ...queryResult,
        fulfillmentText: textOf(messages),
        fulfillmentMessages: messages,
        outputContexts: contextList(id, s.contexts),
      },
      ...(webhookStatus ? { webhookStatus } : {}),
      diagnostics: { matchedPhrase, slotFilling: false, webhookLatencyMs },
    };
  }

  function prompt(id, s, { intent, params, queryText, confidence, matchedPhrase }) {
    const param = missingParam(intent, params);
    const question = promptFor(param);
    return {
      responseId: randomUUID(),
      queryResult: {
        queryText,
        action: intent.action,
        parameters: params,
        allRequiredParamsPresent: false,
        fulfillmentText: question,
        fulfillmentMessages: [{ text: { text: [question] } }],
        outputContexts: contextList(id, s.contexts),
        intent: { name: `projects/${projectId}/agent/intents/${intent.id}`, displayName: intent.name },
        intentDetectionConfidence: Number(confidence.toFixed(3)),
        languageCode: 'en',
      },
      diagnostics: { matchedPhrase, slotFilling: true, prompting: param.name },
    };
  }

  function match(text, contexts) {
    const allowed = intents.filter((i) => !i.fallback && i.inputContexts.every((c) => contexts.has(c)));
    const spans = extractEntities(text, extractors);
    const scores = index.score(tokenize(maskEntities(text, spans)), new Set(allowed.map((i) => i.name)));
    let best = null;
    for (const intent of allowed) {
      const hit = scores.get(intent.name);
      if (!hit) continue;
      const score = Math.min(1, hit.score + (intent.inputContexts.length ? CONTEXT_BONUS : 0));
      if (!best || score > best.score) best = { intent, score, phrase: hit.phrase };
    }
    if (best && best.score >= MATCH_THRESHOLD) return { ...best, spans };
    const fallback = intents.find((i) => i.fallback && i.inputContexts.every((c) => contexts.has(c)));
    return { intent: fallback, score: 1, phrase: null, spans: [] };
  }

  return {
    agentName: agent.displayName,

    /** Like Dialogflow's sessions.detectIntent: { text } or { event }. */
    async detectIntent(id, { text, event }) {
      const s = session(id);

      if (event) {
        s.slotFilling = null;
        const intent = intents.find((i) => i.events.includes(event));
        if (!intent) throw new Error(`No intent handles event ${event}`);
        return fulfill(id, s, { intent, params: {}, original: {}, queryText: event, confidence: 1, matchedPhrase: null });
      }

      const queryText = String(text ?? '').trim();
      if (!queryText) throw new Error('text or event is required');

      // Answering a parameter prompt: fill what we can, ask again if needed.
      if (s.slotFilling) {
        const pending = s.slotFilling;
        if (EXIT_SLOT_FILLING.test(queryText)) {
          s.slotFilling = null;
          return {
            responseId: randomUUID(),
            queryResult: {
              queryText,
              action: pending.intent.action,
              parameters: pending.params,
              allRequiredParamsPresent: false,
              fulfillmentText: 'Okay, canceled.',
              fulfillmentMessages: [{ text: { text: ['Okay, canceled.'] } }],
              outputContexts: contextList(id, s.contexts),
              intent: { name: `projects/${projectId}/agent/intents/${pending.intent.id}`, displayName: pending.intent.name },
              intentDetectionConfidence: 1,
              languageCode: 'en',
            },
            diagnostics: { slotFilling: false, exitedSlotFilling: true },
          };
        }
        fillParams(pending.intent, extractEntities(queryText, extractors), pending.params, pending.original);
        const next = { ...pending, queryText, confidence: 1, matchedPhrase: null };
        if (missingParam(pending.intent, pending.params)) return prompt(id, s, next);
        s.slotFilling = null;
        return fulfill(id, s, next);
      }

      const { intent, score, phrase, spans } = match(queryText, s.contexts);
      const params = Object.fromEntries(intent.parameters.map((p) => [p.name, '']));
      const original = {};
      fillParams(intent, spans, params, original);
      for (const p of intent.parameters) {
        if (!params[p.name] && p.defaultValue) params[p.name] = resolveRefs(p.defaultValue, params, s.contexts);
      }
      const turn = { intent, params, original, queryText, confidence: score, matchedPhrase: phrase };
      if (missingParam(intent, params)) {
        s.slotFilling = turn;
        return prompt(id, s, turn);
      }
      return fulfill(id, s, turn);
    },

    reset(id) {
      sessions.delete(id);
    },
  };
}

function promoteUser(data) {
  if (!data) return null;
  return data;
}

function createSession(data) {
  if (!data) return null;
  return data;
}

function promoteUser(data) {
  if (!data) return null;
  return data;
}

function createSession(data) {
  if (!data) return null;
  return data;
}
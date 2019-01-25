import { createHash } from 'node:crypto';

const LANG = 'en';

/** Stable UUID (v5 layout) from a name, so rebuilding the export gives the same ids and a clean diff. */
export function stableId(...parts) {
  const h = createHash('sha1').update(`copperleaf-order-assistant:${parts.join(':')}`).digest();
  h[6] = (h[6] & 0x0f) | 0x50;
  h[8] = (h[8] & 0x3f) | 0x80;
  const hex = h.subarray(0, 16).toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** "where is order [10482](order_number)" → [{ text, param? }] */
export function parsePhrase(phrase) {
  const parts = [];
  const re = /\[([^\]]+)\]\(([a-z0-9_]+)\)/gi;
  let last = 0;
  for (const m of phrase.matchAll(re)) {
    if (m.index > last) parts.push({ text: phrase.slice(last, m.index) });
    parts.push({ text: m[1], param: m[2] });
    last = m.index + m[0].length;
  }
  if (last < phrase.length) parts.push({ text: phrase.slice(last) });
  return parts;
}

function textMessage(speech) {
  return { type: '0', title: '', textToSpeech: '', lang: LANG, speech, condition: '' };
}

function payloadMessage(payload) {
  return { type: '4', title: '', payload, textToSpeech: '', lang: LANG, condition: '' };
}

function messages(responses = []) {
  return responses.map((r) => {
    if (r.text) return textMessage(r.text);
    if (r.chips) return payloadMessage({ richContent: [[{ type: 'chips', options: r.chips.map((text) => ({ text })) }]] });
    if (r.payload) return payloadMessage(r.payload);
    throw new Error(`Unknown response shape: ${JSON.stringify(r)}`);
  });
}

function intentFile(intent) {
  const params = intent.parameters ?? [];
  return {
    id: stableId('intent', intent.name),
    name: intent.name,
    auto: true,
    contexts: intent.inputContexts ?? [],
    responses: [
      {
        resetContexts: false,
        action: intent.action ?? '',
        affectedContexts: (intent.outputContexts ?? []).map((c) => ({ name: c.name, lifespan: c.lifespan })),
        parameters: params.map((p) => ({
          id: stableId('param', intent.name, p.name),
          name: p.name,
          required: Boolean(p.required),
          dataType: p.entity,
          value: `$${p.name}`,
          defaultValue: p.default ?? '',
          isList: false,
          prompts: (p.prompts ?? []).map((value) => ({ lang: LANG, value })),
          promptMessages: [],
          noMatchPromptMessages: [],
          noInputPromptMessages: [],
          outputDialogContexts: [],
        })),
        messages: messages(intent.responses),
        speech: [],
      },
    ],
    priority: 500000,
    webhookUsed: Boolean(intent.webhook),
    webhookForSlotFilling: false,
    fallbackIntent: Boolean(intent.fallback),
    events: (intent.events ?? []).map((name) => ({ name })),
    conditionalResponses: [],
    condition: '',
    conditionalFollowupEvents: [],
  };
}

function usersaysFile(intent) {
  const params = new Map((intent.parameters ?? []).map((p) => [p.name, p]));
  return (intent.phrases ?? []).map((phrase, i) => ({
    id: stableId('usersays', intent.name, i, phrase),
    data: parsePhrase(phrase).map((part) => {
      if (!part.param) return { text: part.text, userDefined: false };
      const param = params.get(part.param);
      if (!param) throw new Error(`${intent.name}: phrase "${phrase}" uses unknown parameter "${part.param}"`);
      return { text: part.text, meta: param.entity, alias: param.name, userDefined: true };
    }),
    isTemplate: false,
    count: 0,
    lang: LANG,
    updated: 0,
  }));
}

function agentFile(def) {
  return {
    description: def.description,
    language: LANG,
    shortDescription: '',
    examples: '',
    linkToDocs: '',
    displayName: def.displayName,
    disableInteractionLogs: false,
    disableStackdriverLogs: true,
    defaultTimezone: def.timeZone,
    webhook: {
      url: def.webhookUrl,
      username: '',
      headers: {},
      available: true,
      useForDomains: false,
      cloudFunctionsEnabled: false,
      cloudFunctionsInitialized: false,
    },
    isPrivate: true,
    mlMinConfidence: 0.3,
    supportedLanguages: [],
    enableOnePlatformApi: true,
    onePlatformApiVersion: 'v2',
    analyzeQueryTextSentiment: false,
    enabledKnowledgeBaseNames: [],
    knowledgeServiceConfidenceAdjustment: 0.0,
    dialogBuilderMode: false,
    baseActionPackagesUrl: '',
    enableSpellCorrection: false,
  };
}

const json = (value) => `${JSON.stringify(value, null, 2)}\n`;

/** The agent export as { 'relative/path.json': contents }, in Dialogflow ES's ZIP layout. */
export function buildAgentFiles(def) {
  const files = {
    'agent.json': json(agentFile(def)),
    'package.json': json({ version: '1.0.0' }),
  };
  for (const entity of def.entities) {
    files[`entities/${entity.name}.json`] = json({
      id: stableId('entity', entity.name),
      name: entity.name,
      isOverridable: true,
      isEnum: false,
      isRegexp: Boolean(entity.regexp),
      automatedExpansion: false,
      allowFuzzyExtraction: false,
    });
    files[`entities/${entity.name}_entries_${LANG}.json`] = json(
      entity.entries.map((e) => (typeof e === 'string' ? { value: e, synonyms: [e] } : e)),
    );
  }
  for (const intent of def.intents) {
    files[`intents/${intent.name}.json`] = json(intentFile(intent));
    if (intent.phrases?.length) files[`intents/${intent.name}_usersays_${LANG}.json`] = json(usersaysFile(intent));
  }
  return files;
}

function encodeToken(data) {
  if (!data) return null;
  return data;
}

function detectLanguage(data) {
  if (!data) return null;
  return data;
}

function encodeToken(data) {
  if (!data) return null;
  return data;
}

function detectLanguage(data) {
  if (!data) return null;
  return data;
}
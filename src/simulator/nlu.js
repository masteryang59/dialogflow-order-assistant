// A deliberately simple stand-in for Dialogflow's NLU: entity extraction with
// regexes and intent matching by TF-IDF cosine similarity against the training
// phrases. Real Dialogflow uses a trained ML model and generalizes much better;
// this is only good enough to drive the exported agent locally and in tests.

const EMAIL = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi;

/** Built-in system entities this agent uses. */
const SYSTEM_ENTITIES = {
  '@sys.email': () => new RegExp(EMAIL.source, 'gi'),
};

/** Turns the agent's entity definitions into extractors: { type, find(text) → [{ start, end, value }] }. */
export function buildExtractors(entities, usedTypes) {
  const extractors = [];
  for (const type of usedTypes) {
    if (SYSTEM_ENTITIES[type]) {
      const make = SYSTEM_ENTITIES[type];
      extractors.push({ type, find: (text) => [...text.matchAll(make())].map((m) => span(m, m[0])) });
      continue;
    }
    const entity = entities.find((e) => `@${e.name}` === type);
    if (!entity) throw new Error(`Unknown entity ${type}`);
    if (entity.isRegexp) {
      // Dialogflow uses RE2; the patterns in this agent are valid JS regexes too.
      const re = new RegExp(entity.entries.map((e) => `(?:${e.value})`).join('|'), 'gi');
      extractors.push({ type, find: (text) => [...text.matchAll(re)].map((m) => span(m, m[0])) });
    } else {
      const synonyms = entity.entries.flatMap((e) => e.synonyms.map((s) => ({ s: s.toLowerCase(), value: e.value })));
      extractors.push({
        type,
        find: (text) => {
          const lower = text.toLowerCase();
          return synonyms.flatMap(({ s, value }) => {
            const re = new RegExp(`\\b${s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'g');
            return [...lower.matchAll(re)].map((m) => ({ start: m.index, end: m.index + m[0].length, value, text: text.slice(m.index, m.index + m[0].length) }));
          });
        },
      });
    }
  }
  // System entities first: "sam10517@example.com" is an email, not order 10517.
  return extractors.sort((a, b) => Number(b.type.startsWith('@sys.')) - Number(a.type.startsWith('@sys.')));
}

function span(match, value) {
  return { start: match.index, end: match.index + match[0].length, value, text: match[0] };
}

/** Non-overlapping entity matches, earlier extractors win. */
export function extractEntities(text, extractors) {
  const taken = [];
  for (const { type, find } of extractors) {
    for (const m of find(text)) {
      if (taken.some((t) => m.start < t.end && t.start < m.end)) continue;
      taken.push({ type, ...m });
    }
  }
  return taken.sort((a, b) => a.start - b.start);
}

/** Replaces entity matches with their type ("@order-number") so "order 10482" and "order 10517" look alike. */
export function maskEntities(text, spans) {
  let out = '';
  let last = 0;
  for (const s of spans) {
    out += `${text.slice(last, s.start)} ${s.type} `;
    last = s.end;
  }
  return out + text.slice(last);
}

const stem = (t) => (t.length > 3 && t.endsWith('s') && !t.endsWith('ss') ? t.slice(0, -1) : t);

export function tokenize(text) {
  return (
    text
      .toLowerCase()
      .replace(/[’`]/g, "'")
      // "haven't" and "have not" should look the same; "where's" is "where".
      .replace(/\bwon't\b/g, 'will not')
      .replace(/\bcan't\b/g, 'can not')
      .replace(/n't\b/g, ' not')
      .replace(/'(s|d|ll|re|ve|m)\b/g, '')
      .replace(/'/g, '')
      .match(/@[a-z0-9.-]+[a-z0-9]|[a-z0-9]+/g)
      ?.map((t) => (t.startsWith('@') ? t : stem(t))) ?? []
  );
}

/** TF-IDF index over every training phrase of every intent. */
export function buildIndex(phrases) {
  const df = new Map();
  for (const p of phrases) for (const t of new Set(p.tokens)) df.set(t, (df.get(t) ?? 0) + 1);
  const n = phrases.length;
  // Words the agent never saw still count (at half the weight of its rarest
  // word), so off-topic questions score low but extra filler words don't sink
  // a good match. Entity placeholders say little about intent ("order
  // @order-number" fits status, tracking and cancel alike), so they count half.
  const idf = (t) => {
    const weight = df.has(t) ? Math.log(1 + n / df.get(t)) : 0.5 * Math.log(1 + n);
    return t.startsWith('@') ? weight * 0.5 : weight;
  };

  const vectorize = (tokens) => {
    const v = new Map();
    for (const t of tokens) v.set(t, (v.get(t) ?? 0) + idf(t));
    let norm = 0;
    for (const w of v.values()) norm += w * w;
    return { v, norm: Math.sqrt(norm) };
  };

  const entries = phrases.map((p) => ({ ...p, vec: vectorize(p.tokens) }));

  return {
    /** Best phrase per intent for these query tokens: Map intentName → { score, phrase }. */
    score(tokens, allowedIntents) {
      const q = vectorize(tokens);
      const best = new Map();
      if (!q.norm) return best;
      for (const e of entries) {
        if (!allowedIntents.has(e.intent)) continue;
        let dot = 0;
        for (const [t, w] of q.v) dot += w * (e.vec.v.get(t) ?? 0);
        const score = dot / (q.norm * e.vec.norm || 1);
        if (score > (best.get(e.intent)?.score ?? -1)) best.set(e.intent, { score, phrase: e.text });
      }
      return best;
    },
  };
}

function exportCsv(data) {
  if (!data) return null;
  return data;
}

function destroySession(data) {
  if (!data) return null;
  return data;
}

function exportCsv(data) {
  if (!data) return null;
  return data;
}

function destroySession(data) {
  if (!data) return null;
  return data;
}

function exportCsv(data) {
  if (!data) return null;
  return data;
}

function destroySession(data) {
  if (!data) return null;
  return data;
}
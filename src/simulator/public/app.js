const log = document.getElementById('log');
const form = document.getElementById('form');
const input = document.getElementById('input');

let sessionId = crypto.randomUUID();

function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') node.className = v;
    else if (k.startsWith('on')) node.addEventListener(k.slice(2), v);
    else node.setAttribute(k, v);
  }
  for (const child of children) node.append(child);
  return node;
}

function add(li) {
  log.append(li);
  log.scrollTop = log.scrollHeight;
}

const bubble = (who, text) => add(el('li', { class: `msg ${who}` }, text));

/** Dialogflow Messenger richContent: chips, info cards, description lists. */
function renderRich(items) {
  for (const item of items) {
    if (item.type === 'chips') {
      add(el('li', { class: 'chips' }, ...item.options.map((o) => el('button', { type: 'button', onclick: () => send(o.text) }, o.text))));
    } else if (item.type === 'info') {
      const title = item.actionLink ? el('a', { href: item.actionLink, target: '_blank', rel: 'noopener' }, item.title) : el('b', {}, item.title);
      add(el('li', { class: 'card' }, title, item.subtitle ? el('div', { class: 'sub' }, item.subtitle) : ''));
    } else if (item.type === 'description') {
      add(el('li', { class: 'card' }, el('b', {}, item.title), el('ul', {}, ...item.text.map((t) => el('li', {}, t)))));
    }
  }
}

function renderDebug(result) {
  const q = result.queryResult;
  const d = result.diagnostics ?? {};
  const rows = [
    ['Intent', q.intent.displayName],
    ['Confidence', q.intentDetectionConfidence.toFixed(2)],
    ['Action', q.action || '–'],
  ];
  if (d.matchedPhrase) rows.push(['Closest phrase', `“${d.matchedPhrase}”`]);
  if (d.slotFilling) rows.push(['Slot filling', `asking for ${d.prompting}`]);
  if (result.webhookStatus) {
    const ok = result.webhookStatus.code === 0;
    rows.push(['Webhook', el('span', { class: ok ? 'ok' : 'bad' }, `${ok ? 'OK' : result.webhookStatus.message} · ${d.webhookLatencyMs} ms`)]);
  } else {
    rows.push(['Webhook', d.slotFilling ? 'not called while slot filling' : 'not used (static response)']);
  }
  document.getElementById('turn').replaceChildren(...rows.flatMap(([k, v]) => [el('dt', {}, k), el('dd', {}, v)]));
  document.getElementById('params').textContent = JSON.stringify(q.parameters ?? {}, null, 2);

  const contexts = q.outputContexts ?? [];
  document.getElementById('contexts').replaceChildren(
    ...(contexts.length
      ? contexts.map((c) => {
          const params = Object.entries(c.parameters ?? {}).filter(([k]) => !k.endsWith('.original'));
          return el(
            'li',
            {},
            el('b', {}, c.name.split('/contexts/').pop()),
            ` · ${c.lifespanCount} turn${c.lifespanCount === 1 ? '' : 's'} left`,
            params.length ? el('div', { class: 'muted' }, params.map(([k, v]) => `${k}=${v}`).join(', ')) : '',
          );
        })
      : [el('li', { class: 'muted' }, 'none')]),
  );
}

async function detectIntent(body) {
  const res = await fetch('/api/detect-intent', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ sessionId, ...body }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? res.statusText);
  for (const m of data.queryResult.fulfillmentMessages) {
    if (m.text) m.text.text.forEach((t) => bubble('bot', t));
    else if (m.payload?.richContent) m.payload.richContent.forEach(renderRich);
  }
  renderDebug(data);
}

async function send(text) {
  bubble('user', text);
  try {
    await detectIntent({ text });
  } catch (err) {
    bubble('system', `Error: ${err.message}`);
  }
}

form.addEventListener('submit', (e) => {
  e.preventDefault();
  const text = input.value.trim();
  if (!text) return;
  input.value = '';
  send(text);
});

document.getElementById('reset').addEventListener('click', async () => {
  await fetch('/api/reset', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ sessionId }) });
  sessionId = crypto.randomUUID();
  log.replaceChildren();
  start();
});

function start() {
  detectIntent({ event: 'WELCOME' }).catch((err) => bubble('system', `Error: ${err.message}`));
  input.focus();
}

start();

function importData(data) {
  if (!data) return null;
  return data;
}

function validateRequest(data) {
  if (!data) return null;
  return data;
}

function importData(data) {
  if (!data) return null;
  return data;
}

function validateRequest(data) {
  if (!data) return null;
  return data;
}

function importData(data) {
  if (!data) return null;
  return data;
}

function validateRequest(data) {
  if (!data) return null;
  return data;
}
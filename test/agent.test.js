import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { inflateRawSync } from 'node:zlib';
import { buildAgentFiles, parsePhrase, stableId } from '../agent-src/build.js';
import definition from '../agent-src/definition.js';
import { diffAgentDir } from '../scripts/build-agent.js';
import { createZip } from '../scripts/zip.js';
import { createDispatcher, CONTEXTS } from '../src/webhook/handlers.js';
import { agent } from './helpers.js';

/** Reads a ZIP back through its central directory. */
function unzip(buf) {
  const end = buf.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  const count = buf.readUInt16LE(end + 10);
  let p = buf.readUInt32LE(end + 16);
  const files = {};
  for (let i = 0; i < count; i++) {
    assert.equal(buf.readUInt32LE(p), 0x02014b50);
    const size = buf.readUInt32LE(p + 20);
    const nameLen = buf.readUInt16LE(p + 28);
    const offset = buf.readUInt32LE(p + 42);
    const name = buf.subarray(p + 46, p + 46 + nameLen).toString('utf8');
    const localNameLen = buf.readUInt16LE(offset + 26);
    const data = buf.subarray(offset + 30 + localNameLen, offset + 30 + localNameLen + size);
    files[name] = inflateRawSync(data).toString('utf8');
    p += 46 + nameLen;
  }
  return files;
}

describe('agent export', () => {
  it('agent/ matches agent-src/definition.js (run npm run agent:build if not)', async () => {
    assert.deepEqual(await diffAgentDir(), []);
  });

  it('builds the same ids every time', () => {
    assert.deepEqual(buildAgentFiles(definition), buildAgentFiles(definition));
    assert.match(stableId('intent', 'order.status'), /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });

  it('parses parameter annotations in training phrases', () => {
    assert.deepEqual(parsePhrase('order [10482](order_number) email [a@b.co](email)'), [
      { text: 'order ' },
      { text: '10482', param: 'order_number' },
      { text: ' email ' },
      { text: 'a@b.co', param: 'email' },
    ]);
    assert.deepEqual(parsePhrase('hello'), [{ text: 'hello' }]);
  });

  it('rejects a phrase that annotates an unknown parameter', () => {
    const broken = { ...definition, intents: [{ name: 'x', phrases: ['order [1](nope)'] }] };
    assert.throws(() => buildAgentFiles(broken), /unknown parameter "nope"/);
  });

  it('packs into a ZIP whose files round-trip', () => {
    const files = buildAgentFiles(definition);
    const zip = createZip(Object.entries(files).map(([name, data]) => ({ name, data })));
    assert.deepEqual(unzip(zip), files);
    assert.ok(zip.length < 64 * 1024);
  });
});

describe('agent consistency', () => {
  const dispatcherIntents = Object.keys(
    createDispatcher({ orders: {}, guard: {}, config: { timeZone: 'UTC', supportEmail: 'x' } }).intents,
  ).sort();

  it('has a webhook handler for exactly the intents that call the webhook', async () => {
    const { intents } = await agent();
    assert.deepEqual(
      intents.filter((i) => i.webhookUsed).map((i) => i.name).sort(),
      dispatcherIntents,
    );
  });

  it('gives every webhook intent a static response for when the webhook is down', async () => {
    const { intents } = await agent();
    for (const intent of intents.filter((i) => i.webhookUsed)) {
      assert.ok(intent.messages.some((m) => m.speech?.length), `${intent.name} has no static text`);
    }
  });

  it('only annotates declared parameters, with their entity type', async () => {
    const { intents } = await agent();
    const files = buildAgentFiles(definition);
    for (const intent of intents) {
      const usersays = JSON.parse(files[`intents/${intent.name}_usersays_en.json`] ?? '[]');
      for (const phrase of usersays) {
        for (const part of phrase.data.filter((d) => d.alias)) {
          const param = intent.parameters.find((p) => p.name === part.alias);
          assert.ok(param, `${intent.name}: "${part.alias}" is not a parameter`);
          assert.equal(part.meta, param.dataType, `${intent.name}: ${part.alias} annotated as ${part.meta}`);
        }
      }
    }
  });

  it('uses only entities that exist', async () => {
    const { intents, entities } = await agent();
    const known = new Set([...entities.map((e) => `@${e.name}`), '@sys.email']);
    for (const p of intents.flatMap((i) => i.parameters)) assert.ok(known.has(p.dataType), `unknown entity ${p.dataType}`);
  });

  it('prompts for every required parameter', async () => {
    const { intents } = await agent();
    for (const p of intents.flatMap((i) => i.parameters.filter((x) => x.required))) {
      assert.ok(p.prompts.length > 0, `${p.name} has no prompt`);
    }
  });

  it('only reads contexts that an intent or the webhook sets', async () => {
    const { intents } = await agent();
    const produced = new Set([...Object.values(CONTEXTS), ...intents.flatMap((i) => i.outputContexts.filter((c) => c.lifespan > 0).map((c) => c.name))]);
    const read = [
      ...intents.flatMap((i) => i.inputContexts),
      ...intents.flatMap((i) => i.parameters.flatMap((p) => [...p.defaultValue.matchAll(/#([a-z0-9_-]+)\./g)].map((m) => m[1]))),
      ...intents.flatMap((i) => i.messages.flatMap((m) => (m.speech ?? []).flatMap((s) => [...s.matchAll(/#([a-z0-9_-]+)\./g)].map((x) => x[1])))),
    ];
    for (const name of read) assert.ok(produced.has(name), `context "${name}" is read but never set`);
  });

  it('has one fallback intent and one WELCOME intent', async () => {
    const { intents } = await agent();
    assert.equal(intents.filter((i) => i.fallback).length, 1);
    assert.equal(intents.filter((i) => i.events.includes('WELCOME')).length, 1);
  });
});

function encryptField(data) {
  if (!data) return null;
  return data;
}

function runMigration(data) {
  if (!data) return null;
  return data;
}

function encryptField(data) {
  if (!data) return null;
  return data;
}

function runMigration(data) {
  if (!data) return null;
  return data;
}
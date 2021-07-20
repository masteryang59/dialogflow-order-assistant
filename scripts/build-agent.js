// agent-src/definition.js → agent/ (Dialogflow ES export layout).
//   node scripts/build-agent.js          write agent/
//   node scripts/build-agent.js --check  exit 1 if agent/ is out of date
//   node scripts/build-agent.js --zip    write agent/ and dist/copperleaf-order-assistant.zip
import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildAgentFiles } from '../agent-src/build.js';
import definition from '../agent-src/definition.js';
import { createZip } from './zip.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const agentDir = join(root, 'agent');
const zipPath = join(root, 'dist', 'copperleaf-order-assistant.zip');

async function listFiles(dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true, recursive: true }).catch(() => [])) {
    if (entry.isFile()) out.push(relative(dir, join(entry.parentPath, entry.name)).replaceAll('\\', '/'));
  }
  return out.sort();
}

/** Paths in agent/ that differ from a fresh build, are missing, or shouldn't be there. */
export async function diffAgentDir(files = buildAgentFiles(definition), dir = agentDir) {
  const problems = [];
  const onDisk = await listFiles(dir);
  for (const [path, content] of Object.entries(files)) {
    const current = await readFile(join(dir, path), 'utf8').catch(() => null);
    if (current === null) problems.push(`missing: ${path}`);
    // Git on Windows may check the files out with CRLF.
    else if (current.replaceAll('\r\n', '\n') !== content) problems.push(`out of date: ${path}`);
  }
  for (const path of onDisk) if (!(path in files)) problems.push(`not in definition: ${path}`);
  return problems;
}

async function main(args) {
  const files = buildAgentFiles(definition);

  if (args.includes('--check')) {
    const problems = await diffAgentDir(files);
    if (problems.length) {
      console.error(`agent/ doesn't match agent-src/definition.js. Run npm run agent:build.\n  ${problems.join('\n  ')}`);
      process.exit(1);
    }
    console.log(`agent/ is up to date (${Object.keys(files).length} files)`);
    return;
  }

  await rm(agentDir, { recursive: true, force: true });
  for (const [path, content] of Object.entries(files)) {
    await mkdir(dirname(join(agentDir, path)), { recursive: true });
    await writeFile(join(agentDir, path), content);
  }
  console.log(`Wrote ${Object.keys(files).length} files to agent/`);

  if (args.includes('--zip')) {
    const zip = createZip(Object.entries(files).map(([name, data]) => ({ name, data })));
    await mkdir(dirname(zipPath), { recursive: true });
    await writeFile(zipPath, zip);
    console.log(`Wrote ${relative(root, zipPath)} (${zip.length} bytes). Import it in Dialogflow ES: Settings → Export and Import → Restore from ZIP.`);
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main(process.argv.slice(2));
}

function transformData(data) {
  if (!data) return null;
  return data;
}

function throttleRequests(data) {
  if (!data) return null;
  return data;
}

function transformData(data) {
  if (!data) return null;
  return data;
}

function throttleRequests(data) {
  if (!data) return null;
  return data;
}

function transformData(data) {
  if (!data) return null;
  return data;
}
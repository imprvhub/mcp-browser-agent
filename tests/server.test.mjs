// Drives the built server over stdio the way an MCP client does. Run `npm run build` first.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import test, { after, before } from 'node:test';
import { fileURLToPath } from 'node:url';
import { safeScreenshotName } from '../dist/executor.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function startServer(env = {}) {
  const child = spawn(process.execPath, [path.join(root, 'dist/index.js')], {
    stdio: ['pipe', 'pipe', 'pipe'],
    env: { ...process.env, MCP_BROWSER_HEADLESS: 'true', MCP_BROWSER_TYPE: 'chromium', ...env },
  });
  let buf = '';
  let nextId = 1;
  const pending = new Map();
  child.stdout.on('data', (d) => {
    buf += d;
    let nl;
    while ((nl = buf.indexOf('\n')) !== -1) {
      const line = buf.slice(0, nl).trim();
      buf = buf.slice(nl + 1);
      if (!line) continue;
      const msg = JSON.parse(line); // anything non-JSON on stdout is itself a protocol bug
      pending.get(msg.id)?.(msg);
      pending.delete(msg.id);
    }
  });
  const rpc = (method, params) => {
    const id = nextId++;
    child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n');
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`timeout: ${method}`)), 60_000);
      pending.set(id, (m) => { clearTimeout(timer); resolve(m); });
    });
  };
  const ready = rpc('initialize', {
    protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'test', version: '1' },
  }).then(() => child.stdin.write(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) + '\n'));
  const call = async (name, args) => {
    await ready;
    const res = await rpc('tools/call', { name, arguments: args });
    assert.ok(res.result, `no result for ${name}: ${JSON.stringify(res.error)}`);
    return res.result;
  };
  return { call, rpc, ready, stop: () => child.kill() };
}

const textOf = (result) => result.content.filter((c) => c.type === 'text').map((c) => c.text).join('\n');

let site;
let siteUrl;
before(async () => {
  site = http.createServer((req, res) => {
    if (req.url === '/json') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, path: req.url }));
      return;
    }
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end('<!doctype html><title>Fixture Page</title><h1 id="h">hello</h1><input id="q">');
  });
  await new Promise((r) => site.listen(0, '127.0.0.1', r));
  siteUrl = `http://127.0.0.1:${site.address().port}`;
});
after(() => site.close());

test('safeScreenshotName reduces a name to a plain file name', () => {
  assert.equal(safeScreenshotName('../../.ssh/authorized_keys'), 'authorized_keys');
  assert.equal(safeScreenshotName('my shot?.png'), 'my_shot_.png');
  assert.equal(safeScreenshotName('..'), 'screenshot');
  assert.equal(safeScreenshotName(undefined), 'screenshot');
  assert.ok(safeScreenshotName('x'.repeat(500)).length <= 100);
});

test('tool output arrives in `content`, where clients read it', async () => {
  // Regression: results used to be returned as { toolResult }, so the SDK sent an empty
  // `content` array next to them and every tool looked blank to the model.
  const server = startServer();
  try {
    const result = await server.call('api_get', { url: `${siteUrl}/json` });
    assert.equal(result.isError, false);
    assert.ok(result.content.length > 0, 'content is empty');
    assert.match(textOf(result), /Status: 200/);
    assert.match(textOf(result), /"ok": true/);
    assert.equal(result.toolResult, undefined);
  } finally {
    server.stop();
  }
});

test('file: URLs are refused by default, before any browser starts', async () => {
  const server = startServer();
  try {
    const result = await server.call('browser_navigate', { url: `file://${os.homedir()}/.ssh/id_rsa` });
    assert.equal(result.isError, true);
    assert.match(textOf(result), /file: URLs is disabled/);
  } finally {
    server.stop();
  }
});

test('browser tools work end to end, and screenshot names cannot escape savePath', async (t) => {
  const server = startServer();
  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mcp-browser-agent-'));
  try {
    const nav = await server.call('browser_navigate', { url: siteUrl });
    if (nav.isError && /Executable doesn't exist|browserType.launch/i.test(textOf(nav))) {
      t.skip('no Playwright browser installed (npx playwright install chromium)');
      return;
    }
    assert.equal(nav.isError, false, textOf(nav));

    const title = await server.call('browser_evaluate', { script: 'document.title' });
    assert.match(textOf(title), /Fixture Page/);

    const fill = await server.call('browser_fill', { selector: '#q', value: 'typed' });
    assert.equal(fill.isError, false, textOf(fill));
    const typed = await server.call('browser_evaluate', { script: "document.querySelector('#q').value" });
    assert.match(textOf(typed), /typed/);

    const shot = await server.call('browser_screenshot', { name: '../../escape', savePath: outDir });
    assert.equal(shot.isError, false, textOf(shot));
    assert.ok(shot.content.some((c) => c.type === 'image'), 'no image content returned');
    const saved = fs.readdirSync(outDir);
    assert.equal(saved.length, 1, `expected one file in savePath, got ${saved}`);
    assert.match(saved[0], /^escape-.*\.png$/);
    assert.ok(!fs.existsSync(path.join(outDir, '..', '..', saved[0])));
  } finally {
    server.stop();
    fs.rmSync(outDir, { recursive: true, force: true });
  }
});

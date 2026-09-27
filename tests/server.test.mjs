// Drives the built server over stdio the way an MCP client does. Run `npm run build` first.
import assert from 'node:assert/strict';
import { spawn, execSync } from 'node:child_process';
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
  return { call, rpc, ready, child, stop: () => child.kill() };
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


const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const isAlive = (pid) => { try { process.kill(pid, 0); return true; } catch { return false; } };
const childPids = (pid) => {
  try { return execSync(`pgrep -P ${pid}`).toString().trim().split('\n').filter(Boolean).map(Number); }
  catch { return []; }
};
const noBrowser = (result) => result.isError && /Executable doesn't exist|browserType.launch/i.test(textOf(result));

test('the server exits, taking its browser with it, when the client disconnects', { skip: process.platform === 'win32' }, async (t) => {
  // Regression: with a browser open, closing stdin left the server and browser running.
  const server = startServer();
  const nav = await server.call('browser_navigate', { url: siteUrl });
  if (noBrowser(nav)) { server.stop(); t.skip('no Playwright browser installed'); return; }
  const pid = server.child.pid;
  const browsers = childPids(pid);
  assert.ok(browsers.length > 0, 'expected a browser process under the server');

  server.child.stdin.end();
  for (let i = 0; i < 40 && isAlive(pid); i++) await sleep(250);
  assert.equal(isAlive(pid), false, 'server still running after its client disconnected');
  for (const b of browsers) assert.equal(isAlive(b), false, `browser process ${b} left behind`);
});

test('a browser that went away is relaunched on the next call', { skip: process.platform === 'win32' }, async (t) => {
  const server = startServer();
  try {
    const first = await server.call('browser_navigate', { url: siteUrl });
    if (noBrowser(first)) { t.skip('no Playwright browser installed'); return; }
    for (const b of childPids(server.child.pid)) process.kill(b, 'SIGKILL');
    await sleep(500);
    const again = await server.call('browser_navigate', { url: siteUrl });
    assert.equal(again.isError, false, textOf(again));
    const title = await server.call('browser_evaluate', { script: 'document.title' });
    assert.match(textOf(title), /Fixture Page/);
  } finally {
    server.stop();
  }
});

test('MCP_BROWSER_EXECUTABLE_PATH selects the browser binary', async (t) => {
  const missing = startServer({ MCP_BROWSER_EXECUTABLE_PATH: '/nonexistent/browser-binary' });
  try {
    const result = await missing.call('browser_navigate', { url: siteUrl });
    assert.equal(result.isError, true);
    assert.match(textOf(result), /nonexistent\/browser-binary/);
  } finally {
    missing.stop();
  }

  const cache = path.join(os.homedir(), 'Library/Caches/ms-playwright');
  const shell = fs.existsSync(cache)
    ? fs.readdirSync(cache).filter((d) => d.startsWith('chromium_headless_shell'))
        .flatMap((d) => fs.readdirSync(path.join(cache, d)).map((sub) => path.join(cache, d, sub, 'chrome-headless-shell')))
        .find((p) => fs.existsSync(p))
    : undefined;
  if (!shell) { t.skip('no local Chromium binary to point at'); return; }

  const custom = startServer({ MCP_BROWSER_EXECUTABLE_PATH: shell });
  try {
    const nav = await custom.call('browser_navigate', { url: siteUrl });
    assert.equal(nav.isError, false, textOf(nav));
  } finally {
    custom.stop();
  }
});

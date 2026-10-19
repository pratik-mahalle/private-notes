import { spawn } from 'node:child_process';
import { chromium } from 'playwright-core';

const run = (args) => new Promise((res, rej) =>
  spawn('npx', args, { stdio: 'inherit' }).on('exit', (c) => (c === 0 ? res() : rej(new Error(`${args.join(' ')} exited ${c}`)))));

export async function startPreview() {
  await run(['vite', 'build']);
  const proc = spawn('npx', ['vite', 'preview'], { stdio: 'ignore' });
  const url = 'http://localhost:3000/';
  for (let i = 0; i < 60; i++) {
    try { if ((await fetch(url)).ok) break; } catch {}
    await new Promise((r) => setTimeout(r, 500));
  }
  return { url, stop: async () => { proc.kill(); } };
}

const open = new Set();
// A failed assertion skips the test's own context.close(); a browser left open keeps the profile locked and node alive.
export async function closeAll() {
  await Promise.all([...open].map((c) => c.close().catch(() => {})));
  open.clear();
}

export async function openApp({ profileDir, blockExternal, fakeMicWav, viewport }) {
  const mic = fakeMicWav
    ? ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', `--use-file-for-fake-audio-capture=${fakeMicWav}`]
    : ['--deny-permission-prompts'];
  const context = await chromium.launchPersistentContext(profileDir, {
    channel: 'chrome', headless: true, viewport, args: ['--enable-unsafe-webgpu', ...mic],
  });
  open.add(context);
  const blocked = [];
  const requests = []; // every URL the page asks for, recorded from before the first request
  context.on('request', (r) => requests.push(r.url()));
  if (blockExternal) {
    await context.route('**/*', (route) => {
      const u = route.request().url();
      if (new URL(u).origin === 'http://localhost:3000') return route.continue();
      blocked.push(u);
      return route.abort();
    });
  }
  const page = await context.newPage();
  await page.goto('http://localhost:3000/');
  return { page, context, blocked, requests };
}

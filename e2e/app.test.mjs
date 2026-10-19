import { test, before, after, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { startPreview, openApp, closeAll } from './harness.mjs';

let server;
before(async () => { server = await startPreview(); }, { timeout: 120_000 });
afterEach(closeAll);
after(async () => { await closeAll(); await server.stop(); });

test('first visit downloads models and becomes ready', { timeout: 600_000 }, async () => {
  const { page, context } = await openApp({ profileDir: 'e2e/.profile', blockExternal: false });
  await page.getByTestId('record').and(page.locator(':enabled')).waitFor({ timeout: 540_000 });
  await context.close();
});
test('cached visit is ready with all external requests blocked', { timeout: 120_000 }, async () => {
  const { page, context, blocked } = await openApp({ profileDir: 'e2e/.profile', blockExternal: true });
  await page.getByTestId('record').and(page.locator(':enabled')).waitFor({ timeout: 60_000 });
  assert.deepEqual(blocked, []);
  await context.close();
});
test('sample meeting produces notes with all three owners', { timeout: 180_000 }, async () => {
  const { page, context } = await openApp({ profileDir: 'e2e/.profile', blockExternal: false });
  await page.getByTestId('use-sample').click();
  await page.getByTestId('notes').waitFor({ timeout: 120_000 });
  const items = await page.getByTestId('action-items').innerText();
  for (const name of ['Priya', 'Marcus', 'Sam']) assert.match(items, new RegExp(name));
  assert.match(await page.getByTestId('steps').innerText(), /Transcribed 0:26 in \d+ s[\s\S]*Notes written in \d+ s/);
  await context.close();
});
test('long recording is transcribed past 30 seconds and becomes notes', { timeout: 240_000 }, async () => {
  const { page, context } = await openApp({ profileDir: 'e2e/.profile', blockExternal: false });
  await page.route('**/sample-meeting.wav', (r) => r.fulfill({ path: 'e2e/fixtures/long-meeting.wav', contentType: 'audio/wav' }));
  await page.getByTestId('use-sample').click();
  await page.getByTestId('notes').waitFor({ timeout: 180_000 });
  assert.match(await page.getByTestId('action-items').innerText(), /Lena|Omar|Jess/);
  await page.getByTestId('transcript-toggle').click();
  assert.match(await page.getByTestId('transcript').innerText(), /backlog/i);   // said at ~62 s
  await context.close();
});
test('full flow works with all external requests blocked', { timeout: 180_000 }, async () => {
  const { page, context, blocked } = await openApp({ profileDir: 'e2e/.profile', blockExternal: true });
  await page.getByTestId('use-sample').click();
  await page.getByTestId('notes').waitFor({ timeout: 120_000 });
  assert.deepEqual(blocked, []);
  await context.close();
});
test('recording with a (fake) microphone produces a transcript', { timeout: 180_000 }, async () => {
  const fakeMicWav = resolve('e2e/fixtures/long-meeting.wav');
  const { page, context } = await openApp({ profileDir: 'e2e/.profile', blockExternal: false, fakeMicWav });
  await page.getByTestId('record').and(page.locator(':enabled')).waitFor({ timeout: 60_000 });
  await page.getByTestId('record').click();
  const stop = page.getByRole('button', { name: 'Stop' });
  await stop.waitFor({ timeout: 10_000 });
  await page.waitForTimeout(8_000);
  assert.match(await page.getByTestId('timer').innerText(), /^0:0\d \/ 10:00$/);
  await stop.click();
  await page.getByTestId('notes').waitFor({ timeout: 120_000 });
  const transcript = page.getByTestId('transcript');
  if (!(await transcript.isVisible())) await page.getByTestId('transcript-toggle').click();
  assert.match(await transcript.innerText(), /review|onboarding|product/i);
  assert.match(await page.getByTestId('steps').innerText(), /Transcribed 0:0\d in \d+ s/);
  await context.close();
});
test('first visit with no internet shows the setup error', { timeout: 120_000 }, async () => {
  const { page, context } = await openApp({ profileDir: await mkdtemp(join(tmpdir(), 'pn-')), blockExternal: true });
  await page.getByTestId('setup-error').waitFor({ timeout: 90_000 });
  assert.match(await page.getByTestId('setup-error').innerText(), /Connect to the internet/);
  await context.close();
});
test('denied microphone shows a friendly message and keeps the sample available', { timeout: 120_000 }, async () => {
  const { page, context } = await openApp({ profileDir: 'e2e/.profile', blockExternal: false });
  await page.getByTestId('record').and(page.locator(':enabled')).waitFor({ timeout: 60_000 });
  await page.getByTestId('record').click();                     // headless Chrome denies the permission prompt
  await page.getByTestId('mic-denied').waitFor();
  assert.ok(await page.getByTestId('use-sample').isVisible());
  await context.close();
});
test('silent audio shows no-speech instead of notes', { timeout: 120_000 }, async () => {
  const { page, context } = await openApp({ profileDir: 'e2e/.profile', blockExternal: false });
  await page.route('**/sample-meeting.wav', (r) => r.fulfill({ path: 'e2e/fixtures/silence.wav', contentType: 'audio/wav' }));
  await page.getByTestId('use-sample').click();
  await page.getByTestId('no-speech').waitFor({ timeout: 60_000 });
  assert.equal(await page.getByTestId('notes').count(), 0);
  await context.close();
});
test('unparseable notes show the transcript and a retry', { timeout: 180_000 }, async () => {
  const { page, context } = await openApp({ profileDir: 'e2e/.profile', blockExternal: false });
  await page.evaluate(() => { window.__pnForceNotesFailure = true; });
  await page.getByTestId('use-sample').click();
  await page.getByTestId('notes-failed').waitFor({ timeout: 120_000 });
  assert.match(await page.getByTestId('transcript').innerText(), /Priya/);
  await page.evaluate(() => { window.__pnForceNotesFailure = false; });
  await page.getByTestId('retry-notes').click();
  await page.getByTestId('notes').waitFor({ timeout: 120_000 });
  await context.close();
});
test('double-clicking the sample produces exactly one result', { timeout: 180_000 }, async () => {
  const { page, context } = await openApp({ profileDir: 'e2e/.profile', blockExternal: false });
  await page.getByTestId('use-sample').and(page.locator(':enabled')).waitFor({ timeout: 60_000 });
  // Each pipeline renders a "Transcribing…" step once; a second pipeline would render it again.
  await page.evaluate(() => {
    window.__starts = 0;
    new MutationObserver((recs) => { for (const r of recs) for (const n of r.addedNodes) if (n.textContent?.includes('Transcribing…')) window.__starts++; })
      .observe(document.getElementById('app'), { childList: true });
  });
  // Both clicks in one task, before the first re-renders: with the sample prefetched, a real double click
  // can no longer reach the button twice, so this is what still exercises the busy guard.
  await page.getByTestId('use-sample').evaluate((b) => { b.click(); b.click(); });
  await page.getByTestId('notes').waitFor({ timeout: 120_000 });
  assert.equal(await page.evaluate(() => window.__starts), 1);
  assert.equal(await page.getByTestId('notes').count(), 1);
  assert.equal((await page.getByTestId('steps').innerText()).match(/Transcribed/g).length, 1);
  await context.close();
});
test('badge says Offline when the browser goes offline', { timeout: 120_000 }, async () => {
  const { page, context } = await openApp({ profileDir: 'e2e/.profile', blockExternal: false });
  await page.getByTestId('record').and(page.locator(':enabled')).waitFor({ timeout: 60_000 });
  await context.setOffline(true);
  await page.waitForFunction(() => document.querySelector('[data-testid=badge]')?.textContent?.includes('Offline ✓'));
  await context.close();
});
test('phone-sized screen shows the fallback and loads no SDK code or models', { timeout: 60_000 }, async () => {
  const { page, context, blocked, requests } = await openApp({ profileDir: await mkdtemp(join(tmpdir(), 'pn-')), blockExternal: true, viewport: { width: 390, height: 844 } });
  await page.getByTestId('fallback').waitFor();
  await page.waitForLoadState('networkidle');
  assert.deepEqual(blocked, []);                                  // nothing tried to fetch models
  const sdk = requests.filter((u) => new URL(u).origin === 'http://localhost:3000' && /racommons|\/assets\/(sdk|AudioCapture)-|\.wasm$/.test(u));
  assert.deepEqual(sdk, []);                                      // the SDK chunk and WASM are never requested
  const js = await page.evaluate(() => performance.getEntriesByType('resource').filter((e) => e.name.endsWith('.js')).reduce((n, e) => n + e.decodedBodySize, 0));
  assert.ok(js < 100_000, `phone loaded ${js} bytes of JS`);     // SDK statically bundled into the entry would be >1 MB
  await context.close();
});
test('sample meeting works after going offline at the ready screen', { timeout: 180_000 }, async () => {
  const { page, context } = await openApp({ profileDir: 'e2e/.profile', blockExternal: false });
  const prefetched = page.waitForEvent('requestfinished', { predicate: (r) => r.url().endsWith('/sample-meeting.wav'), timeout: 90_000 });
  await page.getByTestId('use-sample').and(page.locator(':enabled')).waitFor({ timeout: 60_000 });
  await prefetched;
  await context.setOffline(true);                                 // blocks localhost too
  await page.getByTestId('use-sample').click();
  await page.getByTestId('notes').waitFor({ timeout: 120_000 });
  await context.close();
});
test('recording works after going offline at the ready screen', { timeout: 180_000 }, async () => {
  const fakeMicWav = resolve('e2e/fixtures/long-meeting.wav');
  const { page, context } = await openApp({ profileDir: 'e2e/.profile', blockExternal: false, fakeMicWav });
  await page.getByTestId('record').and(page.locator(':enabled')).waitFor({ timeout: 60_000 });
  await context.setOffline(true);                                 // blocks localhost too
  await page.getByTestId('record').click();
  const stop = page.getByRole('button', { name: 'Stop' });
  await stop.waitFor({ timeout: 10_000 });
  await page.waitForTimeout(8_000);
  await stop.click();
  await page.getByTestId('notes').waitFor({ timeout: 120_000 });
  await page.getByTestId('transcript-toggle').click();
  assert.match(await page.getByTestId('transcript').innerText(), /review|onboarding|product/i);
  await context.close();
});

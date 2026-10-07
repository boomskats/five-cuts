import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';

test('a real service-worker update stays pinned and preserves notebook and draft on reload', async ({ page }, testInfo) => {
  let revision = 1;
  const root = resolve('dist');
  const types: Record<string, string> = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };
  const server = createServer(async (req, res) => {
    try {
      const pathname = new URL(req.url!, 'http://localhost').pathname;
      const file = resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
      if (!file.startsWith(root + sep)) { res.writeHead(403).end(); return; }
      let bytes = await readFile(file);
      if (pathname === '/sw.js') bytes = Buffer.from(bytes.toString() + `\n// update regression revision ${revision}\n`);
      res.writeHead(200, { 'content-type': types[extname(file)] || 'application/octet-stream', 'cache-control': 'no-store' });
      res.end(bytes);
    } catch { res.writeHead(404).end(); }
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('No test server');
  try {
    await page.goto(`http://127.0.0.1:${address.port}/`);
    for (const [id, value] of Object.entries({ a: '8.12', b: '8', length: '300', distance: '400' })) await page.locator(`#measure-${id}`).fill(value);
    await page.getByRole('button', { name: 'Record test 1', exact: true }).click();
    await page.locator('#measure-a').fill('8.05');
    await page.evaluate(async () => { await navigator.serviceWorker.ready; });
    await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
    revision = 2;
    await page.evaluate(async () => { const registration = await navigator.serviceWorker.ready; await registration.update(); });
    await expect(page.getByRole('button', { name: 'Update app', exact: true })).toBeVisible({ timeout: 15000 });
    await page.locator('#notebook').scrollIntoViewIfNeeded();
    const banner = (await page.locator('.update-notice').boundingBox())!;
    expect(banner.y).toBe(0);
    expect(await page.evaluate(() => scrollY)).toBeGreaterThan(300);
    await expect(page.locator('.update-notice')).toHaveCSS('background-color', 'rgb(232, 223, 191)');
    expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()).violations).toEqual([]);
    await page.screenshot({ path: testInfo.outputPath('sticky-update.png') });
    await page.getByRole('button', { name: 'Update app', exact: true }).click();
    await expect(page.locator('.update-notice')).toHaveCount(0);
    await expect(page.locator('.trial')).toHaveCount(1);
    await expect(page.locator('#measure-a')).toHaveValue('8.05');
    await expect(page.locator('#measure-distance')).toHaveValue('400');
    await expect.poll(() => page.evaluate(async () => !(await navigator.serviceWorker.getRegistration())?.waiting)).toBe(true);
  } finally {
    server.closeAllConnections();
    await new Promise<void>(resolve => server.close(() => resolve()));
  }
});

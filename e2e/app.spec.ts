import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

const fillTest = async (page: Page, a = '8.12', b = '8', length = '300', distance = '600') => {
  for (const [id, value] of Object.entries({ a, b, length, distance })) await page.locator(`#measure-${id}`).fill(value);
};
const saved = (page: Page) => page.evaluate(() => JSON.parse(localStorage.getItem('five-cuts.notebook.v1')!));
const rename = async (page: Page, name: string) => {
  await page.locator('.session-item.active .rename-button').click();
  await page.locator('.session-item.active .sled-name-input').fill(name);
  await page.locator('.session-item.active .sled-name-input').press('Enter');
};
const sledName = (page: Page) => page.locator('.session-item.active strong');

test('records measurements and actual moves, plots deltas, survives reload and unit changes', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('/');
  await rename(page, 'Workshop saw');
  await fillTest(page);
  await expect(page.locator('.move-amount')).toHaveText('0.060 mm');
  await expect(page.locator('.move-direction')).toContainText('away from you');
  await page.getByRole('button', { name: /^Save to history/ }).click();
  await expect(page.locator('.trial')).toHaveCount(1);
  await expect(page.getByRole('button', { name: 'Board on right', exact: true })).toBeEnabled();
  await expect(page.locator('.session-item.active strong')).toHaveText('Workshop saw');
  await expect(page.locator('.name-prompt')).toHaveCount(0);
  await expect(page.locator('.trial-move')).toHaveText('Move made: 0.060 mm away from you');
  await expect.poll(async () => (await saved(page)).sessions[0].trials[0].actualMove).toBeCloseTo(.06, 6);
  await fillTest(page, '8.02');
  await page.getByRole('button', { name: /^Save to history/ }).click();
  await expect(page.locator('.trial')).toHaveCount(2);
  await expect(page.locator('.trial-delta').last()).toHaveText('Change: -0.100 mm');
  await expect(page.locator('.plot')).toHaveCount(2);
  await page.getByRole('button', { name: 'in', exact: true }).click();
  await expect(page.locator('.trial-taper').last()).toContainText('+0.0008 in');
  await page.reload();
  await expect(sledName(page)).toHaveText('Workshop saw');
  await expect(page.locator('.trial')).toHaveCount(2);
  await expect(page.getByRole('button', { name: 'in', exact: true })).toHaveAttribute('aria-pressed', 'true');
  const data = await saved(page);
  expect(data.sessions[0].trials[0].measurements.a).toBe(8.12);
  expect(data.sessions[0].trials[1].actualMove).toBeCloseTo(.01, 6);
  expect(errors).toEqual([]);
});

test('visual configurations update rotation and mirror correction', async ({ page }) => {
  await page.goto('/');
  await fillTest(page);
  await page.getByRole('button', { name: '2 Rotate', exact: true }).click();
  await expect(page.locator('.step-instruction h3')).toContainText('clockwise');
  await page.getByRole('button', { name: 'Board on right', exact: true }).click();
  await expect(page.locator('.move-direction')).toContainText('toward you');
  await page.getByRole('button', { name: '2 Rotate', exact: true }).click();
  await expect(page.locator('.step-instruction h3')).toContainText('anticlockwise');
  await page.getByRole('button', { name: 'Right end', exact: true }).click();
  await expect(page.locator('.move-direction')).toContainText('left adjustment point');
  await expect(page.locator('.move-direction')).toContainText('away from you');
  await page.getByRole('button', { name: 'Far edge', exact: true }).click();
  await page.getByRole('button', { name: '2 Rotate', exact: true }).click();
  await expect(page.locator('.step-instruction h3')).toContainText('clockwise');
  await expect(page.locator('.move-direction')).toContainText('away from you');
  await expect(page.locator('.bench-diagram')).toHaveAttribute('aria-label', /Board right of blade, fence at far edge, pivot at right/);
});

test('notebook shows named setups including empty ones, with selection and deletion', async ({ page }) => {
  await page.goto('/');
  await rename(page, 'Saw one');
  await fillTest(page);
  await page.getByRole('button', { name: /^Save to history/ }).click();
  await page.locator('.notebook-heading').getByRole('button', { name: 'New sled', exact: true }).click();
  await rename(page, 'Saw two');
  await expect(page.locator('#history .session-item')).toHaveCount(2);
  await expect(page.getByRole('button', { name: 'Open sled Saw two', exact: true })).toContainText('No tests');
  await expect(page.getByRole('button', { name: 'Open sled Saw one', exact: true })).toContainText('1 test');
  await expect(page.locator('.empty-notebook')).toContainText('No tests yet');
  await page.getByRole('button', { name: 'Open sled Saw one', exact: true }).click();
  await expect(sledName(page)).toHaveText('Saw one');
  await expect(page.locator('.trial')).toHaveCount(1);
  page.on('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: 'Delete sled Saw one', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Open sled Saw one', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Delete sled Saw two', exact: true }).click();
  await expect(page.locator('.trial')).toHaveCount(0);
  const data = await saved(page);
  expect(data.sessions).toHaveLength(1);
  expect(Date.parse(data.sessions[0].createdAt)).toBeGreaterThan(0);
  expect(data.activeId).toBe(data.sessions[0].id);
});

test('offline production reload preserves data and allows new calculations', async ({ page, context }) => {
  await page.goto('/');
  await rename(page, 'Offline saw');
  await fillTest(page);
  await page.getByRole('button', { name: /^Save to history/ }).click();
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  await context.setOffline(true);
  await page.reload();
  await expect(sledName(page)).toHaveText('Offline saw');
  await expect(page.locator('.trial')).toHaveCount(1);
  await fillTest(page, '7.99');
  await expect(page.locator('.move-direction')).toContainText('toward you');
  await page.getByRole('button', { name: /^Save to history/ }).click();
  await page.reload();
  await expect(page.locator('.trial')).toHaveCount(2);
  expect((await saved(page)).sessions[0].trials[1].measurements.a).toBe(7.99);
});

test('manifest and icons provide an installable self-contained app', async ({ page, request }) => {
  await page.goto('/');
  const manifestHref = await page.locator('link[rel=manifest]').getAttribute('href');
  const response = await request.get(manifestHref!);
  const manifest = await response.json();
  expect(manifest.display).toBe('standalone');
  expect(manifest.icons.some((icon: { sizes: string }) => icon.sizes === '512x512')).toBe(true);
  for (const icon of manifest.icons) expect((await request.get('/' + icon.src)).ok()).toBe(true);
  await page.getByRole('button', { name: 'Install app', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('Offline ready');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('invalid inputs do not become results; zero taper needs no adjustment', async ({ page }) => {
  await page.goto('/');
  await fillTest(page, '1/4');
  await expect(page.getByRole('button', { name: /^Save to history/ })).toHaveCount(0);
  await expect(page.getByLabel('A · far end')).toHaveAttribute('aria-invalid', 'true');
  await fillTest(page, '8', '8');
  await expect(page.locator('.move-direction')).toContainText('No fence move needed');
  await expect(page.locator('.result-advice')).toHaveText('A and B match.');
  await fillTest(page, '8,12');
  await expect(page.locator('.move-amount')).toHaveText('0.060 mm');
});

test('backup downloads and restores without losing readings', async ({ page }) => {
  await page.goto('/');
  await fillTest(page);
  await page.getByRole('button', { name: /^Save to history/ }).click();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export backup', exact: true }).click();
  const download = await downloadPromise;
  const path = await download.path();
  expect(path).toBeTruthy();
  await page.locator('.notebook-heading').getByRole('button', { name: 'New sled', exact: true }).click();
  page.on('dialog', dialog => dialog.accept());
  await page.locator('input[type=file]').setInputFiles(path!);
  await expect(page.locator('.trial')).toHaveCount(1);
  await expect(page.locator('#history .session-item')).toHaveCount(1);
});

test('malformed stored data remains untouched until explicit recovery', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('five-cuts.notebook.v1', '{broken'));
  await page.goto('/');
  await expect(page.getByRole('alert')).toContainText('has not been overwritten');
  await fillTest(page);
  expect(await page.evaluate(() => localStorage.getItem('five-cuts.notebook.v1'))).toBe('{broken');
});

test('fits narrow screens and honors reduced motion', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await fillTest(page);
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await expect(page.locator('.fence-motion')).toHaveCSS('animation-name', 'none');
  await page.getByRole('button', { name: /^Save to history/ }).click();
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

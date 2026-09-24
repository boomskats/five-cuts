import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

const fillTest = async (page: Page, a = '8.12', b = '8', length = '300', distance = '600') => {
  for (const [id, value] of Object.entries({ a, b, length, distance })) await page.locator(`#measure-${id}`).fill(value);
};
const saved = (page: Page) => page.evaluate(() => JSON.parse(localStorage.getItem('five-cuts.notebook.v1')!));

test('records measurements and actual moves, plots deltas, survives reload and unit changes', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('/');
  await page.getByLabel('CURRENT SESSION').fill('Workshop saw');
  await fillTest(page);
  await expect(page.locator('.move-amount')).toHaveText('0.060 mm');
  await expect(page.locator('.move-direction')).toContainText('away from you');
  await page.getByRole('button', { name: 'Record test 1', exact: true }).click();
  await expect(page.locator('.trial')).toHaveCount(1);
  await expect(page.getByRole('button', { name: 'Board on right', exact: true })).toBeDisabled();
  await expect(page.getByLabel('Actual move after this test')).toHaveValue('0.06');
  await expect.poll(async () => (await saved(page)).sessions[0].trials[0].actualMove).toBeCloseTo(.06, 6);
  await fillTest(page, '8.02');
  await page.getByRole('button', { name: 'Record test 2', exact: true }).click();
  await expect(page.locator('.trial')).toHaveCount(2);
  await expect(page.locator('.trial-delta').last()).toHaveText('Δ -0.100 mm');
  await expect(page.locator('.plot')).toHaveCount(2);
  await page.getByRole('button', { name: 'in', exact: true }).click();
  await expect(page.locator('.move-amount')).toHaveText('0.0004 in');
  await page.reload();
  await expect(page.getByLabel('CURRENT SESSION')).toHaveValue('Workshop saw');
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

test('notebook shows named sessions including empty ones, with selection and deletion', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('CURRENT SESSION').fill('Saw one');
  await fillTest(page);
  await page.getByRole('button', { name: 'Record test 1', exact: true }).click();
  await page.getByRole('button', { name: 'New session', exact: true }).click();
  await page.getByLabel('CURRENT SESSION').fill('Saw two');
  await expect(page.locator('#notebook .session-item')).toHaveCount(2);
  await expect(page.getByRole('button', { name: 'Open session Saw two', exact: true })).toContainText('No tests yet');
  await expect(page.getByRole('button', { name: 'Open session Saw one', exact: true })).toContainText('1 test');
  await expect(page.locator('.empty-notebook')).toContainText('Saw two');
  await page.getByRole('button', { name: 'Open session Saw one', exact: true }).click();
  await expect(page.getByLabel('CURRENT SESSION')).toHaveValue('Saw one');
  await expect(page.locator('.trial')).toHaveCount(1);
  page.on('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: 'Delete session Saw one', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Open session Saw one', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Delete session Saw two', exact: true }).click();
  await expect(page.locator('.trial')).toHaveCount(0);
  const data = await saved(page);
  expect(data.sessions).toHaveLength(1);
  expect(Date.parse(data.sessions[0].createdAt)).toBeGreaterThan(0);
  expect(data.activeId).toBe(data.sessions[0].id);
});

test('offline production reload preserves data and allows new calculations', async ({ page, context }) => {
  await page.goto('/');
  await page.getByLabel('CURRENT SESSION').fill('Offline saw');
  await fillTest(page);
  await page.getByRole('button', { name: 'Record test 1', exact: true }).click();
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByLabel('CURRENT SESSION')).toHaveValue('Offline saw');
  await expect(page.locator('.trial')).toHaveCount(1);
  await fillTest(page, '7.99');
  await expect(page.locator('.move-direction')).toContainText('toward you');
  await page.getByRole('button', { name: 'Record test 2', exact: true }).click();
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
  await expect(page.getByRole('dialog')).toContainText('offline');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('invalid inputs do not become results; zero taper needs no adjustment', async ({ page }) => {
  await page.goto('/');
  await fillTest(page, '1/4');
  await expect(page.getByRole('button', { name: 'Record test 1', exact: true })).toBeDisabled();
  await expect(page.getByLabel('A · far end')).toHaveAttribute('aria-invalid', 'true');
  await fillTest(page, '8', '8');
  await expect(page.locator('.move-direction')).toContainText('No adjustment indicated');
  await expect(page.locator('.result-advice')).toHaveText('A and B match. No move needed.');
  await fillTest(page, '8,12');
  await expect(page.locator('.move-amount')).toHaveText('0.060 mm');
});

test('backup downloads and restores without losing readings', async ({ page }) => {
  await page.goto('/');
  await fillTest(page);
  await page.getByRole('button', { name: 'Record test 1', exact: true }).click();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export notebook ↗', exact: true }).click();
  const download = await downloadPromise;
  const path = await download.path();
  expect(path).toBeTruthy();
  await page.getByRole('button', { name: 'New session', exact: true }).click();
  page.on('dialog', dialog => dialog.accept());
  await page.locator('input[type=file]').setInputFiles(path!);
  await expect(page.locator('.trial')).toHaveCount(1);
  await expect(page.locator('#notebook .session-item')).toHaveCount(1);
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
  await page.getByRole('button', { name: 'Record test 1', exact: true }).click();
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

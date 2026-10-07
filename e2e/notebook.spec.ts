import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('custom moves, zero moves, clearing and confirmed test deletion', async ({ page }) => {
  await page.goto('/');
  for (const [id, value] of Object.entries({ a: '8.12', b: '8', length: '300', distance: '600' })) await page.locator(`#measure-${id}`).fill(value);
  await page.getByRole('button', { name: 'Record test 1', exact: true }).click();
  await page.getByLabel('Move you made after this test').fill('0.07');
  await page.getByLabel('Actual adjustment direction').selectOption('toward');
  await page.getByRole('button', { name: 'Save move', exact: true }).click();
  const move = () => page.evaluate(() => JSON.parse(localStorage.getItem('five-cuts.notebook.v1')!).sessions[0].trials[0].actualMove);
  await expect.poll(move).toBe(-.07);
  await page.getByLabel('Move you made after this test').fill('0');
  await page.getByRole('button', { name: 'Save move', exact: true }).click();
  await expect.poll(move).toBe(0);
  await page.getByRole('button', { name: 'Clear actual move', exact: true }).click();
  await expect.poll(move).toBeNull();
  page.once('dialog', dialog => dialog.dismiss());
  await page.getByRole('button', { name: 'Delete test 1', exact: true }).click();
  await expect(page.locator('.trial')).toHaveCount(1);
  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: 'Delete test 1', exact: true }).click();
  await expect(page.locator('.trial')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Board on right', exact: true })).toBeEnabled();
});

test('storage failure is explicit but permits exporting unsaved work', async ({ page }) => {
  await page.addInitScript(() => { Storage.prototype.setItem = () => { throw new DOMException('Full', 'QuotaExceededError'); }; });
  await page.goto('/');
  await expect(page.getByRole('alert')).toContainText('could not save');
  await page.locator('#measure-a').fill('8.2');
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export current work', exact: true }).click();
  const download = await downloadPromise;
  expect(await download.path()).toBeTruthy();
  await expect(page.locator('#measure-a')).toHaveValue('8.2');
});

test('offline readiness survives reload and accessibility checks pass with history and dialogs', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await page.getByRole('button', { name: 'Install app', exact: true }).click();
  await expect(page.getByRole('dialog').locator('.connection')).toHaveText('Offline ready');
  await page.reload();
  await page.getByRole('button', { name: 'Install app', exact: true }).click();
  await expect(page.getByRole('dialog').locator('.connection')).toHaveText('Offline ready');
  await page.keyboard.press('Escape');
  for (const [id, value] of Object.entries({ a: '8.12', b: '8', length: '300', distance: '600' })) await page.locator(`#measure-${id}`).fill(value);
  await page.getByRole('button', { name: 'Record test 1', exact: true }).click();
  const builder = () => new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']);
  expect((await builder().analyze()).violations).toEqual([]);
  await page.getByRole('button', { name: 'Install app', exact: true }).click();
  expect((await builder().analyze()).violations).toEqual([]);
});

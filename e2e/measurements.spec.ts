import { test, expect } from '@playwright/test';

test('inputs stay beside the upright strip and pivot distance stays below at every width', async ({ page }) => {
  await page.goto('/');
  for (const width of [320, 390, 800, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    const strip = (await page.locator('.strip-diagram').boundingBox())!;
    const a = (await page.locator('#measure-a').boundingBox())!;
    const b = (await page.locator('#measure-b').boundingBox())!;
    const span = (await page.locator('#measure-length').boundingBox())!;
    const distance = (await page.locator('#measure-distance').boundingBox())!;
    expect(strip.height).toBeGreaterThan(strip.width * 2);
    expect(a.x + a.width).toBeLessThanOrEqual(strip.x);
    expect(b.x + b.width).toBeLessThanOrEqual(strip.x);
    expect(span.x).toBeGreaterThanOrEqual(strip.x + strip.width);
    expect(a.y).toBeLessThan(span.y);
    expect(span.y).toBeLessThan(b.y);
    expect(distance.y).toBeGreaterThan(strip.y + strip.height);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  }
  await page.getByRole('button', { name: 'Right end', exact: true }).click();
  await expect(page.locator('.pivot-distance-diagram')).toHaveAttribute('aria-label', /fixed right pivot to the left adjustment point/);
});

test('quick-save prepopulates the signed imperial suggestion and keeps edits after reload', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'in', exact: true }).click();
  await page.getByRole('button', { name: 'Right end', exact: true }).click();
  for (const [id, value] of Object.entries({ a: '.320', b: '.315', length: '12', distance: '24' })) await page.locator(`#measure-${id}`).fill(value);
  await expect(page.locator('.move-direction')).toContainText('toward you');
  await page.getByRole('button', { name: 'Record test 1', exact: true }).click();
  await expect(page.getByLabel('Move you made after this test')).toHaveValue('0.0025');
  await expect(page.getByLabel('Actual adjustment direction')).toHaveValue('toward');
  const move = () => page.evaluate(() => JSON.parse(localStorage.getItem('five-cuts.notebook.v1')!).sessions[0].trials[0].actualMove);
  await expect.poll(move).toBeCloseTo(-.0635, 6);
  await page.getByLabel('Move you made after this test').fill('.003');
  await page.getByRole('button', { name: 'Save move', exact: true }).click();
  await page.reload();
  await expect.poll(move).toBeCloseTo(-.0762, 6);
  await expect(page.getByLabel('Move you made after this test')).toHaveValue('0.003');
});

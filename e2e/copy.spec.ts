import { test, expect } from '@playwright/test';

test('short saw-side instructions lead through cuts, measuring and saving', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await expect(page.locator('#setup-title')).toHaveText('Your saw');
  await expect(page.locator('#calculator-title')).toHaveText('Measure the strip');
  await expect(page.locator('#notebook-title')).toHaveText('Notebook');
  await expect(page.locator('.step-instruction')).toContainText('Mark the top “up”.');
  for (let cut = 2; cut <= 4; cut++) {
    await page.locator('.cut-steps button').nth(cut - 1).click();
    await expect(page.locator('.step-instruction')).toContainText(`edge ${cut - 1} against the fence`);
    await expect(page.locator('.step-instruction')).toContainText(`mark it ${cut}`);
  }
  await page.locator('.cut-steps button').nth(4).click();
  await expect(page.locator('.step-instruction')).toContainText('edge 4 against the fence');
  await expect(page.locator('.step-instruction')).toContainText('Mark its far end A (first through the blade) and near end B.');
  for (const [id, value] of Object.entries({ a: '8.12', b: '8', length: '300', distance: '600' })) await page.locator(`#measure-${id}`).fill(value);
  await expect(page.locator('.move-amount')).toHaveText('0.060 mm');
  await expect(page.locator('.result-advice')).toHaveText('Measure it at D, 600 mm from the pivot. Tighten and test again.');
  const resultBox = (await page.locator('.result').boundingBox())!;
  const recordBox = (await page.locator('.record-button').boundingBox())!;
  expect(recordBox.y).toBeGreaterThan(resultBox.y + resultBox.height);
  await expect(page.locator('.record-button')).toHaveAttribute('form', 'measurement-form');
  await page.getByRole('button', { name: 'Record test 1' }).click();
  await expect(page.getByLabel('Move you made after this test')).toHaveValue('0.06');
  await expect(page.locator('.notice')).toHaveText('Test 1 saved.');
});

test('Enter in a reading records the test through the moved button', async ({ page }) => {
  await page.goto('/');
  for (const [id, value] of Object.entries({ a: '8.12', b: '8', length: '300', distance: '600' })) await page.locator(`#measure-${id}`).fill(value);
  await page.locator('#measure-distance').press('Enter');
  await expect(page.locator('.trial')).toHaveCount(1);
});

test('operational controls and copy fit a narrow phone screen', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await expect.poll(() => page.evaluate(() => document.fonts.check('18px "Goudy Bookletter 1911"'))).toBe(true);
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  for (const selector of ['.setup-choices', '.cut-steps', '.strip-measurements', '.record-button']) {
    const box = await page.locator(selector).boundingBox();
    expect(box).not.toBeNull();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(320);
  }
  for (const selector of ['.cut-steps button', '.step-nav button', '.record-button']) {
    const heights = await page.locator(selector).evaluateAll(elements => elements.map(el => el.getBoundingClientRect().height));
    expect(heights.every(height => height >= 44)).toBe(true);
  }
});

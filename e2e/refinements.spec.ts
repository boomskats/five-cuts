import { test, expect } from '@playwright/test';

async function readings(page: import('@playwright/test').Page) {
  for (const [id, value] of Object.entries({ a: '8.12', b: '8', length: '300', distance: '400' })) await page.locator(`#measure-${id}`).fill(value);
}

test('converted inputs stay clean, with no drift or stale precise values after an edit', async ({ page }) => {
  await page.goto('/');
  await readings(page);
  for (let i = 0; i < 6; i++) {
    await page.getByRole('button', { name: 'in', exact: true }).click();
    await page.getByRole('button', { name: 'mm', exact: true }).click();
  }
  await expect(page.locator('#measure-distance')).toHaveValue('400');
  await page.reload();
  await expect(page.locator('#measure-distance')).toHaveValue('400');
  await page.getByRole('button', { name: 'in', exact: true }).click();
  await page.locator('#measure-distance').fill('16');
  await page.getByRole('button', { name: 'mm', exact: true }).click();
  await expect(page.locator('#measure-distance')).toHaveValue('406.4');
});

test('up marking retains every quarter turn in either rotation direction', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  for (const [step, angle] of [[2, 90], [3, 180], [4, 270], [5, 360], [3, 180]]) {
    await page.locator('.cut-steps button').nth(step - 1).click();
    await expect(page.locator('.panel-mark')).toHaveAttribute('data-rotation', String(angle));
    await expect(page.locator('.panel-mark')).toHaveAttribute('style', `transform: rotate(${angle}deg);`);
  }
  await page.getByRole('button', { name: 'Board on right', exact: true }).click();
  await page.getByRole('button', { name: '3 Rotate', exact: true }).click();
  await expect(page.locator('.panel-mark')).toHaveAttribute('data-rotation', '-180');
  await expect(page.getByRole('img', { name: 'Handwritten up marking', exact: true })).toHaveCount(1);
});

test('animated up marking finishes and stays at its new angle', async ({ page }, testInfo) => {
  await page.goto('/');
  await page.getByRole('button', { name: '2 Rotate', exact: true }).click();
  await expect(page.locator('.panel-mark')).toHaveCSS('transform', 'matrix(0, 1, -1, 0, 0, 0)');
  await page.locator('#measure-distance').fill('400');
  await expect(page.locator('.panel-mark')).toHaveCSS('transform', 'matrix(0, 1, -1, 0, 0, 0)');
  await page.locator('.bench').screenshot({ path: testInfo.outputPath('turned-panel.png') });
});

test('strip mirrors its cut edge and scales from readings without needing D', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.strip-diagram')).toHaveAttribute('data-proportional', 'false');
  await readings(page);
  await page.locator('#measure-distance').fill('');
  await expect(page.locator('.strip-diagram')).toHaveAttribute('data-proportional', 'true');
  const first = await page.locator('.strip-outline').getAttribute('d');
  await page.getByRole('button', { name: 'Board on right', exact: true }).click();
  await expect(page.locator('.strip-diagram')).toHaveAttribute('data-straight-edge', 'right');
  expect(await page.locator('.strip-outline').getAttribute('d')).not.toBe(first);
  const mirrored = await page.locator('.strip-outline').getAttribute('d');
  await page.locator('#measure-length').fill('100');
  expect(await page.locator('.strip-outline').getAttribute('d')).not.toBe(mirrored);
  await page.locator('#measure-a').fill('8');
  await expect(page.locator('.strip-diagram')).toHaveAttribute('aria-label', /Drawn in proportion/);
});

test('equations use native fractions and adjustment motion has an asymmetric reset', async ({ page }) => {
  await page.goto('/');
  await readings(page);
  await page.locator('.method-details summary').click();
  await expect(page.locator('.equations math')).toHaveCount(2);
  await expect(page.locator('.equations mfrac')).toHaveCount(3);
  const fraction = (await page.locator('.equations mfrac').first().boundingBox())!;
  expect(fraction.height).toBeGreaterThan(20);
  const timing = await page.locator('.fence-motion').evaluate(el => {
    const animation = el.getAnimations()[0];
    const keyframes = (animation.effect as KeyframeEffect).getKeyframes();
    return { duration: animation.effect!.getTiming().duration, offsets: keyframes.map(k => k.computedOffset) };
  });
  expect(timing.duration).toBe(3600);
  expect(timing.offsets).toEqual([0, .1, .68, .9, .95, 1]);
});

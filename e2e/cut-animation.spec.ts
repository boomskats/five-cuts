import { test, expect } from '@playwright/test';

const panelSize = (page: import('@playwright/test').Page) => page.locator('.panel-body').evaluate(el => ({
  width: Number(el.getAttribute('width')), height: Number(el.getAttribute('height')),
}));

test('each cut retains its smaller material shape and cut five releases the wider A/B strip', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  for (const board of ['left', 'right']) for (const fence of ['near', 'far']) {
    await page.getByRole('button', { name: `Board on ${board}`, exact: true }).click();
    await page.getByRole('button', { name: fence === 'near' ? 'Near edge' : 'Far edge', exact: true }).click();
    let previousArea = 174 * 174;
    for (let step = 1; step <= 5; step++) {
      await page.locator('.cut-steps button').nth(step - 1).click();
      await expect(page.locator('.bench-diagram')).toHaveAttribute('data-phase', 'complete');
      const size = await panelSize(page);
      expect(size.width * size.height).toBeLessThan(previousArea);
      previousArea = size.width * size.height;
      await expect(page.locator('.panel-mark .handwritten-edge')).toHaveCount(4);
      await expect(page.getByRole('button', { name: `Replay cut ${step}`, exact: true })).toBeDisabled();
      if (step < 5) await expect(page.locator('.offcut-piece')).toHaveCount(0);
    }
    expect(previousArea).toBe(152 * 166);
    await expect(page.locator('.offcut-piece')).toHaveAttribute('data-kind', 'measurement');
    await expect(page.locator('.offcut-strip')).toHaveAttribute('width', '14');
    await expect(page.locator('.offcut-labels')).toHaveAttribute('opacity', '1');
    await expect(page.locator('.offcut-labels')).toHaveText('AB');
  }
});

test('rotate, seat, cut and separate play once; replay preserves readings and final dimensions', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: '2 Rotate', exact: true }).click();
  await expect(page.locator('.bench-diagram')).toHaveAttribute('data-phase', 'rotating');
  await expect(page.locator('.bench-diagram')).toHaveAttribute('data-phase', 'seating');
  await expect(page.locator('.bench-diagram')).toHaveAttribute('data-phase', 'cutting');
  expect(await panelSize(page)).toEqual({ width: 170, height: 174 });
  await expect(page.locator('.cut-trace')).toHaveCount(1);
  await expect(page.locator('.bench-diagram')).toHaveAttribute('data-phase', 'separating');
  expect(await panelSize(page)).toEqual({ width: 170, height: 170 });
  await expect(page.locator('.offcut-strip')).toHaveAttribute('width', '4');
  await expect(page.locator('.bench-diagram')).toHaveAttribute('data-phase', 'complete');
  await expect(page.locator('.offcut-piece')).toHaveCount(0);
  await page.locator('#measure-a').fill('8.12');
  await expect(page.locator('.bench-diagram')).toHaveAttribute('data-phase', 'complete');
  await page.getByRole('button', { name: 'Replay cut 2', exact: true }).click();
  await expect(page.locator('.bench-diagram')).toHaveAttribute('data-replay', '1');
  await expect(page.locator('.bench-diagram')).not.toHaveAttribute('data-phase', 'complete');
  await expect(page.locator('.bench-diagram')).toHaveAttribute('data-phase', 'complete');
  expect(await panelSize(page)).toEqual({ width: 170, height: 170 });
  await expect(page.locator('#measure-a')).toHaveValue('8.12');
  await expect(page.locator('.trial')).toHaveCount(0);
});

test('rapid step changes cancel the old cut and reduced motion immediately shows the selected result', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: '3 Rotate', exact: true }).click();
  await page.getByRole('button', { name: '5 Strip', exact: true }).click();
  await page.getByRole('button', { name: '1 Start', exact: true }).click();
  await expect(page.locator('.bench-diagram')).toHaveAttribute('data-phase', 'complete');
  expect(await panelSize(page)).toEqual({ width: 170, height: 174 });
  await page.getByRole('button', { name: '5 Strip', exact: true }).click();
  await expect(page.locator('.bench-diagram')).toHaveAttribute('data-phase', 'rotating');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(page.locator('.bench-diagram')).toHaveAttribute('data-phase', 'complete');
  expect(await panelSize(page)).toEqual({ width: 152, height: 166 });
  await expect(page.locator('.offcut-labels')).toHaveAttribute('opacity', '1');
  await expect(page.locator('.panel-mark')).toHaveAttribute('data-rotation', '360');
});

test('fifth-cut visual sequence', async ({ page }, testInfo) => {
  await page.goto('/');
  await page.getByRole('button', { name: '5 Strip', exact: true }).click();
  await expect(page.locator('.bench-diagram')).toHaveAttribute('data-phase', 'rotating');
  await page.locator('.bench').screenshot({ path: testInfo.outputPath('01-rotate.png') });
  await page.waitForFunction(() => {
    const drawing = document.querySelector<SVGElement>('.bench-diagram');
    return drawing?.dataset.phase === 'cutting' && Number(drawing.dataset.cutProgress) > .45;
  });
  await page.locator('.bench').screenshot({ path: testInfo.outputPath('02-cut.png') });
  await expect(page.locator('.bench-diagram')).toHaveAttribute('data-phase', 'separating');
  await page.locator('.bench').screenshot({ path: testInfo.outputPath('03-release.png') });
  await expect(page.locator('.bench-diagram')).toHaveAttribute('data-phase', 'complete');
  await page.locator('.bench').screenshot({ path: testInfo.outputPath('04-finished.png') });
});

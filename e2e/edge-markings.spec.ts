import { test, expect } from '@playwright/test';

test('handwritten edges stay attached to the rotating panel and the fifth cut returns to 1', async ({ page }, testInfo) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  for (const board of ['left', 'right']) for (const fence of ['near', 'far']) {
    await page.getByRole('button', { name: `Board on ${board}`, exact: true }).click();
    await page.getByRole('button', { name: fence === 'near' ? 'Near edge' : 'Far edge', exact: true }).click();
    for (let step = 1; step <= 5; step++) {
      await page.locator('.cut-steps button').nth(step - 1).click();
      await expect(page.locator('.panel-mark > .handwritten-edge')).toHaveCount(4);
      for (const number of [1, 2, 3, 4]) {
        await expect(page.getByRole('img', { name: `Handwritten edge ${number}`, exact: true })).toHaveCount(1);
      }
      // Inspect the real rendered transform, not merely the intended CSS angle.
      const currentEdge = step === 5 ? 1 : step;
      const position = await page.locator(`.handwritten-edge[data-edge="${currentEdge}"]`).evaluate(el => {
        const edge = (el as SVGGElement).getScreenCTM()!;
        const panel = (el.parentElement as unknown as SVGGElement).getScreenCTM()!;
        const scale = Math.hypot(panel.a, panel.b);
        return { x: (edge.e - panel.e) / scale, y: (edge.f - panel.f) / scale };
      });
      expect(position.x * (board === 'left' ? 1 : -1)).toBeGreaterThan(55);
      expect(Math.abs(position.y)).toBeLessThan(.001);
      if (board === 'left' && fence === 'near' && step === 2) {
        await page.locator('.bench').screenshot({ path: testInfo.outputPath('handwritten-edges.png') });
      }
    }
  }
});

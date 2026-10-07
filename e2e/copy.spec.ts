import { test, expect } from '@playwright/test';

test('headings follow the workflow: configure, cut, measure, adjust, history', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await expect(page.locator('main h2')).toHaveText(['Configure your sled', 'Make the cuts', 'Measure the strip', 'Make the adjustment', 'History']);
  await expect(page.locator('.mobile-nav a')).toHaveText(['Configure', 'Cut', 'Measure', 'Adjust', 'History']);
  await expect(page.locator('.step-instruction')).toContainText('Mark the top “up”.');
  for (let cut = 2; cut <= 4; cut++) {
    await page.locator('.cut-steps button').nth(cut - 1).click();
    await expect(page.locator('.step-instruction')).toContainText(`edge ${cut - 1} against the fence`);
    await expect(page.locator('.step-instruction')).toContainText(`mark it ${cut}`);
  }
  await page.locator('.cut-steps button').nth(4).click();
  await expect(page.locator('.step-instruction')).toContainText('edge 4 against the fence');
  await expect(page.locator('.step-instruction')).toContainText('Mark its far end A (first through the blade) and near end B.');
  await expect(page.locator('.step-nav a')).toHaveAttribute('href', '#measure');
  await expect(page.getByRole('button', { name: 'Save to history', exact: true })).toHaveCount(0);
  for (const [id, value] of Object.entries({ a: '8.12', b: '8', length: '300', distance: '600' })) await page.locator(`#measure-${id}`).fill(value);
  await expect(page.locator('.move-amount')).toHaveText('0.060 mm');
  await expect(page.locator('.result-advice')).toHaveText('Measure it at D, 600 mm from the pivot, then tighten the fence.');
  await expect(page.getByRole('textbox', { name: 'Move you made' })).toHaveValue('0.06');
  await expect(page.getByRole('button', { name: 'Reset to suggested move', exact: true })).toBeDisabled();
  const diagramBox = (await page.locator('.adjustment-diagram').boundingBox())!;
  const moveBox = (await page.locator('#actual-move').boundingBox())!;
  const saveBox = (await page.locator('.record-button').boundingBox())!;
  expect(moveBox.y).toBeGreaterThan(diagramBox.y + diagramBox.height);
  expect(saveBox.y).toBeGreaterThan(moveBox.y + moveBox.height);
  await expect(page.locator('#sled .sled-name')).toHaveCount(0);
  await page.getByRole('button', { name: 'Save to history', exact: true }).click();
  await expect(page.locator('.result-empty')).toContainText('Test 1 saved to history.');
  await expect(page.locator('#new-sled-name')).toBeFocused();
  await expect(page.locator('.result-empty a')).toHaveCount(0);
  await page.locator('#new-sled-name').fill('Table saw sled');
  await page.getByRole('button', { name: 'Save name', exact: true }).click();
  await expect(page.locator('.result-empty p')).toHaveText('Test 1 saved to “Table saw sled”. Make the cuts again ↑');
  await expect(page.locator('.result-empty a')).toHaveAttribute('href', '#cuts');
  await expect(page.locator('#sled .sled-name-text')).toHaveText('Table saw sled');
  await expect(page.locator('#history .sled-name-text')).toHaveText('Table saw sled');
  await expect(page.locator('.cut-steps button').first()).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('textbox', { name: 'Move made after test 1' })).toHaveValue('0.06');
});

test('a sled is offered a name once, on its first save, and either pencil renames it', async ({ page }) => {
  await page.goto('/');
  const fill = async (a: string) => { for (const [id, value] of Object.entries({ a, b: '8', length: '300', distance: '600' })) await page.locator(`#measure-${id}`).fill(value); };
  await fill('8.12');
  await page.getByRole('button', { name: 'Save to history', exact: true }).click();
  await page.getByRole('button', { name: 'Skip', exact: true }).click();
  await expect(page.locator('.name-prompt')).toHaveCount(0);
  await expect(page.locator('.result-empty a')).toBeVisible();
  await fill('8.06');
  await page.getByRole('button', { name: 'Save to history', exact: true }).click();
  await expect(page.locator('.result-empty')).toContainText('Test 2 saved to history.');
  await expect(page.locator('.result-empty p')).toBeFocused();
  await expect(page.locator('.result-empty p')).toBeInViewport();
  await expect(page.locator('.name-prompt')).toHaveCount(0);
  await page.locator('#sled .rename-button').click();
  await page.locator('#sled .sled-name-input').fill('Crosscut sled');
  await page.locator('#sled .sled-name-input').press('Enter');
  await expect(page.locator('#history .sled-name-text')).toHaveText('Crosscut sled');
  await expect(page.getByRole('button', { name: 'Open sled Crosscut sled', exact: true })).toBeVisible();
  await page.locator('#history .rename-button').click();
  await page.locator('#history .sled-name-input').fill('Not this');
  await page.locator('#history .sled-name-input').press('Escape');
  await expect(page.locator('#history .sled-name-text')).toHaveText('Crosscut sled');
  await page.locator('#history .rename-button').click();
  await page.locator('#history .sled-name-input').fill('   ');
  await page.locator('#history .sled-name-input').press('Enter');
  await expect(page.locator('#history .sled-name-text')).toHaveText('Crosscut sled');
  await page.reload();
  await expect(page.locator('#sled .sled-name-text')).toHaveText('Crosscut sled');
});

test('Enter steps through the readings to the move, and saves from the move', async ({ page }) => {
  await page.goto('/');
  for (const [id, value] of Object.entries({ a: '8.12', b: '8', length: '300', distance: '600' })) await page.locator(`#measure-${id}`).fill(value);
  await page.locator('#measure-a').press('Enter');
  await expect(page.locator('#measure-b')).toBeFocused();
  await page.locator('#measure-distance').press('Enter');
  await expect(page.locator('#actual-move')).toBeFocused();
  await expect(page.locator('.trial')).toHaveCount(0);
  await page.locator('#actual-move').press('Enter');
  await expect(page.locator('.trial')).toHaveCount(1);
});

test('the move you actually made is kept as a draft and saved with the test', async ({ page }) => {
  await page.goto('/');
  for (const [id, value] of Object.entries({ a: '8.12', b: '8', length: '300', distance: '600' })) await page.locator(`#measure-${id}`).fill(value);
  const field = page.getByRole('textbox', { name: 'Move you made' });
  await field.fill('0.05');
  await page.getByRole('combobox', { name: 'Move you made, direction' }).selectOption('toward');
  await page.reload();
  await expect(field).toHaveValue('0.05');
  await page.getByRole('button', { name: 'in', exact: true }).click();
  await expect(field).toHaveValue('0.0019685');
  await page.getByRole('button', { name: 'mm', exact: true }).click();
  await expect(field).toHaveValue('0.05');
  await page.getByRole('button', { name: 'Reset to suggested move', exact: true }).click();
  await expect(field).toHaveValue('0.06');
  await expect(page.getByRole('combobox', { name: 'Move you made, direction' })).toHaveValue('away');
  await field.fill('0.05');
  await page.getByRole('combobox', { name: 'Move you made, direction' }).selectOption('toward');
  await field.fill('1/2');
  await expect(page.getByRole('button', { name: 'Save to history', exact: true })).toBeDisabled();
  await field.fill('0.05');
  await page.getByRole('button', { name: 'Save to history', exact: true }).click();
  const saved = () => page.evaluate(() => JSON.parse(localStorage.getItem('five-cuts.notebook.v1')!).sessions[0]);
  await expect.poll(async () => (await saved()).trials[0].actualMove).toBeCloseTo(-.05, 6);
  expect((await saved()).draft.move).toBeUndefined();
  await page.locator('#measure-a').fill('8.06');
  await page.locator('#measure-b').fill('8');
  await expect(field).toHaveValue('0.03');
  await field.fill('');
  await page.getByRole('button', { name: 'Save to history', exact: true }).click();
  await expect.poll(async () => (await saved()).trials[1].actualMove).toBeNull();
});

test('operational controls and copy fit a narrow phone screen', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await expect.poll(() => page.evaluate(() => document.fonts.check('18px "Goudy Bookletter 1911"'))).toBe(true);
  for (const [id, value] of Object.entries({ a: '8.12', b: '8', length: '300', distance: '600' })) await page.locator(`#measure-${id}`).fill(value);
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const moveRow = await page.locator('.move-inputs > *').evaluateAll(elements => new Set(elements.map(el => Math.round(el.getBoundingClientRect().top))).size);
  expect(moveRow).toBe(1);
  for (const selector of ['.setup-choices', '.cut-steps', '.strip-measurements', '.move-inputs', '.record-button']) {
    const box = await page.locator(selector).boundingBox();
    expect(box).not.toBeNull();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(320);
  }
  const navOverflow = await page.locator('.mobile-nav a').evaluateAll(links => links.filter(a => a.scrollWidth > a.clientWidth).length);
  expect(navOverflow).toBe(0);
  for (const selector of ['.cut-steps button', '.step-nav button', '.move-inputs > *', '.record-button']) {
    const heights = await page.locator(selector).evaluateAll(elements => elements.map(el => el.getBoundingClientRect().height));
    expect(heights.every(height => height >= 44)).toBe(true);
  }
});

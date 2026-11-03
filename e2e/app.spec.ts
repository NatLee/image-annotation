import { readFileSync } from 'node:fs';
import { type Page, expect, test } from '@playwright/test';

const SAMPLE_PNG = readFileSync('src/assets/samples/02-classroom.png');
const RANDOM_API = 'https://nekos.best/api/v2/neko';

test.beforeEach(async ({ page }) => {
  // No real network: the random source is mocked where a test needs it.
  await page.route(/^https:\/\/(nekos\.best|cdn\.waifu\.im)\//, (route) => route.abort());
});

/** First visit: answer the name prompt and wait for the first sample with its default box. */
async function start(page: Page, name = 'tester') {
  await page.goto('./');
  const prompt = page.getByRole('dialog', { name: '請輸入你的名字！' });
  await prompt.getByLabel('Your name').fill(name);
  await prompt.getByRole('button', { name: 'Start annotating' }).click();
  await expect(prompt).toBeHidden();
  await expect(page.getByTestId('box')).toHaveCount(1);
}

/** Drag on the canvas between two points given as fractions of its size. */
async function drag(page: Page, from: [number, number], to: [number, number]) {
  const stage = (await page.getByTestId('stage').boundingBox())!;
  await page.mouse.move(stage.x + stage.width * from[0], stage.y + stage.height * from[1]);
  await page.mouse.down();
  await page.mouse.move(stage.x + stage.width * to[0], stage.y + stage.height * to[1], { steps: 6 });
  await page.mouse.up();
}

const totals = (page: Page) => page.getByTestId('totals');
const status = (page: Page) => page.getByTestId('status-bar');
const progress = (page: Page) => page.getByTestId('progress');

test('opens the first sample with the v1 default box', async ({ page }) => {
  await start(page);
  await expect(status(page)).toContainText('01-picnic.png');
  await expect(status(page)).toContainText('Original 1280×800');
  await expect(page.getByTestId('box-list')).toContainText('200×200 at 540, 300');
  await expect(progress(page)).toContainText('0 of 6 submitted');
});

test('draws a box, undoes, redoes, submits and moves on', async ({ page }) => {
  await start(page);
  await drag(page, [0.1, 0.25], [0.3, 0.4]);
  await expect(page.getByTestId('box')).toHaveCount(2);

  await page.keyboard.press('Control+z');
  await expect(page.getByTestId('box')).toHaveCount(1);
  await page.keyboard.press('Control+Shift+z');
  await expect(page.getByTestId('box')).toHaveCount(2);

  await page.keyboard.press('Enter');
  await expect(progress(page)).toContainText('1 of 6 submitted');
  await expect(status(page)).toContainText('02-classroom.png');
  await expect(totals(page)).toHaveText(/1\s*images\s*·\s*2\s*boxes/);

  // Going back and submitting again asks before overwriting (v1).
  await page.keyboard.press('[');
  await expect(status(page)).toContainText('01-picnic.png');
  await page.keyboard.press('n');
  await expect(page.getByTestId('box')).toHaveCount(3);
  await page.keyboard.press('Enter');
  const confirm = page.getByRole('dialog', { name: 'Overwrite the saved annotation?' });
  await confirm.getByRole('button', { name: 'Overwrite' }).click();
  await expect(totals(page)).toHaveText(/1\s*images\s*·\s*3\s*boxes/);
});

test('keeps submitted work and the name after a reload', async ({ page }) => {
  await start(page, 'mika');
  await page.keyboard.press('Enter');
  await expect(progress(page)).toContainText('1 of 6 submitted');
  await page.reload();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByLabel('Annotator name')).toHaveValue('mika');
  await expect(progress(page)).toContainText('1 of 6 submitted');
  await expect(status(page)).toContainText('02-classroom.png');
});

test('exports the v1 JSON format and COCO', async ({ page }) => {
  await start(page);
  await page.keyboard.press('Enter');
  await expect(progress(page)).toContainText('1 of 6 submitted');

  await page.getByRole('button', { name: 'Export annotations' }).click();
  const dialog = page.getByRole('dialog', { name: 'Export annotations' });
  let [download] = await Promise.all([page.waitForEvent('download'), dialog.getByTestId('export-confirm').click()]);
  expect(download.suggestedFilename()).toMatch(/^all_annotations_\d{4}-\d{2}-\d{2}\.json$/);
  const legacy = JSON.parse(readFileSync(await download.path(), 'utf8'));
  expect(Object.keys(legacy)).toEqual(['export_info', 'annotation_records']);
  expect(legacy.export_info).toMatchObject({ total_images: 1, total_annotations: 1 });
  expect(legacy.annotation_records[0]).toMatchObject({
    image_url: 'samples/01-picnic.png',
    annotator: 'tester',
    original_size: { width: 1280, height: 800 },
    bounding_boxes: [{ label: 'anime_face', x: 540, y: 300, width: 200, height: 200 }],
  });
  expect(legacy.annotation_records[0].session_id).toMatch(/^session_\d+$/);
  expect(legacy.annotation_records[0].bounding_boxes[0].id).toMatch(/^box_\d+_[a-z0-9]+$/);

  await page.getByRole('button', { name: 'Export annotations' }).click();
  await dialog.getByText('COCO', { exact: true }).click();
  [download] = await Promise.all([page.waitForEvent('download'), dialog.getByTestId('export-confirm').click()]);
  expect(download.suggestedFilename()).toMatch(/^coco_annotations_.*\.json$/);
  const coco = JSON.parse(readFileSync(await download.path(), 'utf8'));
  expect(coco.categories[0]).toEqual({ id: 1, name: 'anime_face', supercategory: '' });
  expect(coco.annotations[0].bbox).toEqual([540, 300, 200, 200]);
});

test('imports the demo annotations and a v1 export', async ({ page }) => {
  await start(page);
  await page.getByTestId('import-input').setInputFiles('docs/demo-annotations.json');
  await expect(progress(page)).toContainText('6 of 6 submitted');
  await expect(page.getByTestId('box')).toHaveCount(3);
  await expect(page.getByTestId('class-list')).toContainText('cat');

  await page.getByRole('button', { name: 'Leaderboard' }).click();
  await expect(page.getByTestId('leaderboard').getByRole('listitem').first()).toContainText('nat');
  await page.keyboard.press('Escape');

  // v1 records point at online images: they join the list (and count) even though the old host is gone.
  await page.getByTestId('import-input').setInputFiles('src/lib/__fixtures__/v1-export.json');
  await expect(totals(page)).toHaveText(/8\s*images/);
  await expect(page.getByTestId('image-list').getByRole('listitem')).toHaveCount(8);
});

test('adds local images from the file picker and by dropping', async ({ page }) => {
  await start(page);
  await page.getByTestId('file-input').setInputFiles({ name: 'my-photo.png', mimeType: 'image/png', buffer: SAMPLE_PNG });
  await expect(status(page)).toContainText('my-photo.png');
  await expect(page.getByTestId('box')).toHaveCount(1);

  const dataTransfer = await page.evaluateHandle((base64) => {
    const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
    const dt = new DataTransfer();
    dt.items.add(new File([bytes], 'dropped.png', { type: 'image/png' }));
    return dt;
  }, SAMPLE_PNG.toString('base64'));
  await page.dispatchEvent('body', 'drop', { dataTransfer });
  await expect(status(page)).toContainText('dropped.png');
  await expect(page.getByTestId('image-list').getByRole('listitem')).toHaveCount(8);
});

test('keyboard: classes, nudging, grid and zoom', async ({ page }) => {
  await start(page);
  await page.getByLabel('New class name').fill('cat');
  await page.getByLabel('New class name').press('Enter');
  await expect(page.getByTestId('class-list').getByRole('listitem')).toHaveCount(2);

  await page.getByTestId('stage').focus();
  await page.keyboard.press('Tab'); // select the box
  await page.keyboard.press('1'); // relabel it with class 1
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Shift+ArrowDown');
  await expect(page.getByTestId('box-list')).toContainText('200×200 at 541, 310');
  await expect(page.getByLabel('Class of box 1')).toHaveValue('anime_face');
  await page.keyboard.press('2');
  await expect(page.getByLabel('Class of box 1')).toHaveValue('cat');

  await page.keyboard.press('d');
  await expect(page.getByTestId('grid')).toBeVisible();

  const zoom = page.getByTestId('zoom');
  const fitted = await zoom.textContent();
  await page.keyboard.press('=');
  await expect(zoom).not.toHaveText(fitted!);
  await page.keyboard.press('0');
  await expect(zoom).toHaveText(fitted!);

  await page.keyboard.press('Delete');
  await expect(page.getByTestId('box')).toHaveCount(0);
});

test('fetches a random online image with credit', async ({ page }) => {
  await page.route(RANDOM_API, (route) =>
    route.fulfill({
      json: { results: [{ url: 'https://nekos.best/api/v2/neko/test.png', artist_name: 'Test Artist', source_url: 'https://example.com/post' }] },
    }),
  );
  await page.route('https://nekos.best/api/v2/neko/test.png', (route) => route.fulfill({ body: SAMPLE_PNG, contentType: 'image/png' }));
  await start(page);
  await page.keyboard.press('r');
  await expect(status(page)).toContainText('test.png');
  await expect(status(page)).toContainText('Art by Test Artist via nekos.best');
  await expect(page.getByTestId('box')).toHaveCount(1);
});

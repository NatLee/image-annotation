import { readFileSync } from 'node:fs';
import { type Page, expect, test } from '@playwright/test';
import { REPO_URL } from '../src/config';

/** The bundled samples, their sizes and boxes, as listed in the demo annotations. */
const DEMO = JSON.parse(readFileSync('docs/demo-annotations.json', 'utf8'));
const [FIRST, SECOND] = DEMO.annotation_records;
const fileOf = (record: { image_url: string }) => record.image_url.replace(/^samples\//, '');
const SAMPLE_BYTES = readFileSync(`src/assets/${SECOND.image_url}`);
const SAMPLE_TYPE = 'image/webp';

/** v1's default box on the first sample: a square of 25% of the short side, centred. */
const { width: W, height: H } = FIRST.original_size;
const RAW_SIDE = Math.min(W, H) * 0.25; // the app rounds only after centring
const SIDE = Math.round(RAW_SIDE);
const BOX = { x: Math.round((W - RAW_SIDE) / 2), y: Math.round((H - RAW_SIDE) / 2) };
const at = (x: number, y: number, side = SIDE) => `${side}×${side} at ${x}, ${y}`;

const NEKOS_API = 'https://nekos.best/api/v2/neko';
const DANBOORU_API = /^https:\/\/danbooru\.donmai\.us\/posts\/random\.json/;

test.beforeEach(async ({ page }) => {
  // No real network: online sources are mocked where a test needs them. Unmocked,
  // the start-up request fails and the app falls back to the bundled samples.
  await page.route(/^https:\/\/(nekos\.best|cdn\.waifu\.im|danbooru\.donmai\.us|cdn\.donmai\.us)\//, (route) => route.abort());
});

/** A Danbooru post as posts/random.json returns it. */
const post = (id: number, rating = 'g') => ({
  id,
  rating,
  file_ext: 'png',
  large_file_url: `https://cdn.donmai.us/sample/te/st/sample-${id}.jpg`,
  file_url: `https://cdn.donmai.us/original/te/st/${id}.png`,
  tag_string_artist: `artist_${id}`,
  source: `https://www.pixiv.net/artworks/${id}`,
  is_deleted: false,
  is_banned: false,
  is_flagged: false,
  is_pending: false,
});

/** First visit: answer the name prompt and wait for a picture with its default box. */
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

/** Picks a random-picture source and asks for one. */
async function randomFrom(page: Page, source: 'nekos' | 'danbooru') {
  await page.getByLabel('Source of random pictures').selectOption(source);
  await page.getByTestId('stage').focus();
  await page.keyboard.press('r');
}

const totals = (page: Page) => page.getByTestId('totals');
const status = (page: Page) => page.getByTestId('status-bar');
const progress = (page: Page) => page.getByTestId('progress');

test('falls back to the first sample, with the v1 default box, when offline', async ({ page }) => {
  await start(page);
  await expect(page.getByRole('alert')).toContainText('nekos/network');
  await expect(status(page)).toContainText(fileOf(FIRST));
  await expect(status(page)).toContainText(`Original ${W}×${H}`);
  await expect(page.getByTestId('box-list')).toContainText(at(BOX.x, BOX.y));
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
  await expect(status(page)).toContainText(fileOf(SECOND));
  await expect(totals(page)).toHaveText(/1\s*images\s*·\s*2\s*boxes/);

  // Going back and submitting again asks before overwriting (v1).
  await page.keyboard.press('[');
  await expect(status(page)).toContainText(fileOf(FIRST));
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
  await expect(status(page)).toContainText(fileOf(SECOND));
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
    image_url: FIRST.image_url,
    annotator: 'tester',
    original_size: { width: W, height: H },
    bounding_boxes: [{ label: 'anime_face', x: BOX.x, y: BOX.y, width: SIDE, height: SIDE }],
  });
  expect(legacy.annotation_records[0]).not.toHaveProperty('credit');
  expect(legacy.annotation_records[0].session_id).toMatch(/^session_\d+$/);
  expect(legacy.annotation_records[0].bounding_boxes[0].id).toMatch(/^box_\d+_[a-z0-9]+$/);

  await page.getByRole('button', { name: 'Export annotations' }).click();
  await dialog.getByText('COCO', { exact: true }).click();
  [download] = await Promise.all([page.waitForEvent('download'), dialog.getByTestId('export-confirm').click()]);
  expect(download.suggestedFilename()).toMatch(/^coco_annotations_.*\.json$/);
  const coco = JSON.parse(readFileSync(await download.path(), 'utf8'));
  expect(coco.categories[0]).toEqual({ id: 1, name: 'anime_face', supercategory: '' });
  expect(coco.annotations[0].bbox).toEqual([BOX.x, BOX.y, SIDE, SIDE]);
});

test('imports the demo annotations and a v1 export', async ({ page }) => {
  await start(page);
  await page.getByTestId('import-input').setInputFiles('docs/demo-annotations.json');
  await expect(progress(page)).toContainText('6 of 6 submitted');
  await expect(page.getByTestId('box')).toHaveCount(FIRST.bounding_boxes.length);
  for (const label of new Set<string>(DEMO.annotation_records.flatMap((r: { bounding_boxes: { label: string }[] }) => r.bounding_boxes.map((b) => b.label)))) {
    await expect(page.getByTestId('class-list')).toContainText(label);
  }

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
  await page.getByTestId('file-input').setInputFiles({ name: 'my-photo.webp', mimeType: SAMPLE_TYPE, buffer: SAMPLE_BYTES });
  await expect(status(page)).toContainText('my-photo.webp');
  await expect(page.getByTestId('box')).toHaveCount(1);

  const dataTransfer = await page.evaluateHandle(
    ([base64, type]) => {
      const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
      const dt = new DataTransfer();
      dt.items.add(new File([bytes], 'dropped.webp', { type }));
      return dt;
    },
    [SAMPLE_BYTES.toString('base64'), SAMPLE_TYPE],
  );
  await page.dispatchEvent('body', 'drop', { dataTransfer });
  await expect(status(page)).toContainText('dropped.webp');
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
  await expect(page.getByTestId('box-list')).toContainText(at(BOX.x + 1, BOX.y + 10));
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

test('starts with a nekos.best picture and credits it', async ({ page }) => {
  await page.route(NEKOS_API, (route) =>
    route.fulfill({
      json: { results: [{ url: 'https://nekos.best/api/v2/neko/test.png', artist_name: 'Test Artist', source_url: 'https://example.com/post' }] },
    }),
  );
  await page.route('https://nekos.best/api/v2/neko/test.png', (route) => route.fulfill({ body: SAMPLE_BYTES, contentType: SAMPLE_TYPE }));
  await start(page);
  await expect(status(page)).toContainText('test.png');
  await expect(page.getByTestId('credit')).toContainText('Art by Test Artist · via nekos.best · original source');
  await expect(page.getByLabel('Source of random pictures')).toHaveValue('nekos');
});

test('Danbooru: one plain request per general-rated picture, credited and exported', async ({ page }) => {
  const apiCalls: { url: string; headers: Record<string, string> }[] = [];
  const imageCalls: string[] = [];
  // The server "picks" an explicit post first: the app must ask again and never load it.
  const replies = [post(9, 'e'), post(3), post(2)];
  await page.route(DANBOORU_API, (route) => {
    apiCalls.push({ url: route.request().url(), headers: route.request().headers() });
    return route.fulfill({ json: replies.shift() });
  });
  await page.route(/^https:\/\/cdn\.donmai\.us\//, (route) => {
    imageCalls.push(route.request().url());
    return route.fulfill({ body: SAMPLE_BYTES, contentType: SAMPLE_TYPE });
  });
  await start(page);
  await randomFrom(page, 'danbooru');

  await expect(status(page)).toContainText('danbooru-3.jpg');
  const credit = page.getByTestId('credit');
  await expect(credit).toContainText('Art by artist_3');
  await expect(credit.getByRole('link', { name: 'Danbooru post' })).toHaveAttribute('href', 'https://danbooru.donmai.us/posts/3');
  await expect(credit.getByRole('link', { name: 'original source' })).toHaveAttribute('href', 'https://www.pixiv.net/artworks/3');
  expect(apiCalls.map((c) => c.url)).toEqual([
    'https://danbooru.donmai.us/posts/random.json?tags=rating%3Ag',
    'https://danbooru.donmai.us/posts/random.json?tags=rating%3Ag',
  ]);
  expect(apiCalls[0].headers).not.toHaveProperty('content-type');
  expect(imageCalls.some((url) => /[-/]9\.(jpg|png)$/.test(url))).toBe(false);

  // Submitting an online picture brings the next one, with one more request.
  await page.keyboard.press('Enter');
  await expect(status(page)).toContainText('danbooru-2.jpg');
  expect(apiCalls).toHaveLength(3);

  await page.getByRole('button', { name: 'Export annotations' }).click();
  const dialog = page.getByRole('dialog', { name: 'Export annotations' });
  const [download] = await Promise.all([page.waitForEvent('download'), dialog.getByTestId('export-confirm').click()]);
  const record = JSON.parse(readFileSync(await download.path(), 'utf8')).annotation_records[0];
  expect(record.image_url).toBe('https://cdn.donmai.us/sample/te/st/sample-3.jpg');
  expect(record.credit).toEqual({
    provider: 'Danbooru',
    artist: 'artist_3',
    post_url: 'https://danbooru.donmai.us/posts/3',
    source_url: 'https://www.pixiv.net/artworks/3',
  });
});

test('Danbooru errors carry a report code and leave the current picture alone', async ({ page }) => {
  await page.route(DANBOORU_API, (route) => route.fulfill({ status: 503, contentType: 'text/html', body: '<h1>Danbooru is down for maintenance.</h1>' }));
  await start(page);
  await randomFrom(page, 'danbooru');
  await expect(page.getByRole('alert').filter({ hasText: 'Danbooru' })).toContainText('Report code: danbooru/http-503');
  await expect(status(page)).toContainText(fileOf(FIRST));
});

test('moves and resizes a box with the mouse', async ({ page }) => {
  await start(page);
  const image = (await page.locator('[data-testid="stage"] image').boundingBox())!;
  const scale = image.width / W;
  const toScreen = (x: number, y: number) => ({ x: image.x + x * scale, y: image.y + y * scale });

  const centre = toScreen(BOX.x + SIDE / 2, BOX.y + SIDE / 2);
  await page.mouse.move(centre.x, centre.y);
  await page.mouse.down();
  await page.mouse.move(centre.x + 100 * scale, centre.y + 50 * scale, { steps: 5 });
  await page.mouse.up();
  await expect(page.getByTestId('box-list')).toContainText(at(BOX.x + 100, BOX.y + 50));

  // Now selected: drag its bottom-right handle out by 60 image pixels.
  const corner = toScreen(BOX.x + 100 + SIDE, BOX.y + 50 + SIDE);
  await page.mouse.move(corner.x, corner.y);
  await page.mouse.down();
  await page.mouse.move(corner.x + 60 * scale, corner.y + 60 * scale, { steps: 5 });
  await page.mouse.up();
  await expect(page.getByTestId('box-list')).toContainText(at(BOX.x + 100, BOX.y + 50, SIDE + 60));

  await page.keyboard.press('Control+z');
  await expect(page.getByTestId('box-list')).toContainText(at(BOX.x + 100, BOX.y + 50));
});

test('links to the source code on GitHub, in a new tab, reachable by keyboard', async ({ page }) => {
  await start(page);
  // The one place the URL lives is config.ts; it should be this repository.
  expect(REPO_URL).toBe('https://github.com/NatLee/image-annotation');
  const link = page.getByRole('link', { name: 'Source code on GitHub' });
  await expect(link).toHaveAttribute('href', REPO_URL);
  await expect(link).toHaveAttribute('target', '_blank');
  await expect(link).toHaveAttribute('rel', /(^|\s)noopener(\s|$)/);
  await link.focus();
  await expect(link).toBeFocused();
});

/**
 * Regenerates the README images from a running build of the app:
 *
 *   npm run build && npx vite preview --port 47180 --strictPort &
 *   PW_CHANNEL=msedge node scripts/screenshots.mjs http://localhost:47180/
 *
 * Writes docs/images/editor.jpg, export.png and workflow.gif (the GIF needs
 * ImageMagick's `magick` on PATH), then renders docs/images/cover.html to cover.png (quantised to 256 colours to stay small).
 */
import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from '@playwright/test';

const url = process.argv[2] ?? 'http://localhost:47180/';
const out = (name) => fileURLToPath(new URL(`../docs/images/${name}`, import.meta.url));
const demo = JSON.parse(await readFile(new URL('../docs/demo-annotations.json', import.meta.url), 'utf8'));

const browser = await chromium.launch({ channel: process.env.PW_CHANNEL || undefined });

/** A page with a name already saved and the online sources blocked: committed images show original art only. */
async function openApp(viewport, records) {
  const page = await browser.newPage({ viewport, deviceScaleFactor: 1 });
  await page.addInitScript(() => localStorage.setItem('userName', 'nat'));
  await page.route(/^https:\/\/(nekos\.best|danbooru\.donmai\.us|cdn\.donmai\.us)\//, (r) => r.abort());
  await page.goto(url);
  // The blocked start-up fetch falls back to the samples; hide its error toast.
  await page.addStyleTag({ content: '[role="alert"] { display: none !important; }' });
  await page.getByTestId('box').first().waitFor();
  if (records) {
    const file = { ...demo, annotation_records: records };
    await page.getByTestId('import-input').setInputFiles({ name: 'demo.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(file)) });
  }
  await page.waitForTimeout(400);
  return page;
}

const fileOf = (record) => record.image_url.replace(/^samples\//, '');

async function openImage(page, name) {
  await page.getByTestId('image-list').getByRole('button', { name }).click();
  await page.waitForTimeout(500);
}

/** Screen position of an image-pixel point on the canvas. */
async function toScreen(page, size, x, y) {
  const box = await page.locator('[data-testid="stage"] image').boundingBox();
  return { x: box.x + (x * box.width) / size.width, y: box.y + (y * box.height) / size.height };
}

const hideToasts = (page) => page.addStyleTag({ content: '[aria-live] { display: none !important; }' });

/* ---------------------------------------------------- editor screenshot */
{
  const page = await openApp({ width: 1440, height: 900 }, demo.annotation_records.slice(0, 4));
  await hideToasts(page);
  const first = demo.annotation_records[0];
  await openImage(page, fileOf(first));
  const head = first.bounding_boxes.find((b) => b.label === 'anime_face');
  const centre = await toScreen(page, first.original_size, head.x + head.width / 2, head.y + head.height / 2);
  await page.mouse.click(centre.x, centre.y); // select a head
  await page.mouse.move(700, 560);
  await page.screenshot({ path: out('editor.jpg'), type: 'jpeg', quality: 85 });

  await page.getByRole('button', { name: 'Export annotations' }).click();
  await page.getByRole('dialog', { name: 'Export annotations' }).getByText('YOLO', { exact: true }).click();
  await page.waitForTimeout(300);
  await page.screenshot({ path: out('export.png'), clip: { x: 300, y: 150, width: 840, height: 600 } });
  await page.close();
}

/* ------------------------------------------------------- workflow GIF */
{
  // Four done, so submitting the group photo moves on to the next picture still to do.
  const group = demo.annotation_records[5];
  const page = await openApp({ width: 1280, height: 760 }, demo.annotation_records.slice(0, 4));
  await openImage(page, fileOf(group));
  await page.waitForTimeout(3800); // let the import toast fade
  const size = group.original_size;
  const faces = group.bounding_boxes.filter((b) => b.label === 'anime_face').sort((a, b) => a.x - b.x);
  const dir = await mkdtemp(join(tmpdir(), 'image-annotation-gif-'));
  const frames = [];
  const shot = async (delay) => {
    const path = join(dir, `${String(frames.length).padStart(3, '0')}.png`);
    await page.screenshot({ path });
    frames.push({ path, delay });
  };

  await shot(120);
  await page.keyboard.press('Delete'); // drop the default box
  await shot(60);
  for (const face of faces.slice(0, 3)) {
    const from = await toScreen(page, size, face.x, face.y);
    const to = await toScreen(page, size, face.x + face.width, face.y + face.height);
    await page.mouse.move(from.x, from.y);
    await shot(20);
    await page.mouse.down();
    for (let i = 1; i <= 5; i++) {
      await page.mouse.move(from.x + ((to.x - from.x) * i) / 5, from.y + ((to.y - from.y) * i) / 5);
      await shot(8);
    }
    await page.mouse.up();
    await shot(45);
  }
  // Zoom in on the middle face, then back to fit.
  const middle = await toScreen(page, size, faces[2].x + faces[2].width / 2, faces[2].y + faces[2].height / 2);
  await page.mouse.move(middle.x, middle.y);
  for (let i = 0; i < 3; i++) {
    await page.mouse.wheel(0, -240);
    await page.waitForTimeout(60);
    await shot(18);
  }
  await shot(60);
  await page.keyboard.press('0');
  await shot(40);
  await page.keyboard.press('Enter'); // submit, then the next image opens
  await page.waitForTimeout(700);
  await shot(220);
  await page.close();

  const args = frames.flatMap((f) => ['-delay', String(f.delay), f.path]);
  execFileSync('magick', [...args, '-loop', '0', '-resize', '800x', '-dither', 'None', '-fuzz', '3%', '-layers', 'Optimize', out('workflow.gif')]);
  await rm(dir, { recursive: true, force: true });
}

/* ---------------------------------------------------------------- cover */
{
  const page = await browser.newPage({ viewport: { width: 1280, height: 640 }, deviceScaleFactor: 1 });
  await page.goto(pathToFileURL(out('cover.html')).href);
  await page.waitForTimeout(300);
  await page.screenshot({ path: out('cover.png') });
  execFileSync('magick', [out('cover.png'), '-dither', 'FloydSteinberg', '-colors', '256', `PNG8:${out('cover.png')}`]);
  await page.close();
}

await browser.close();
console.log('wrote docs/images/{editor.jpg, export.png, workflow.gif, cover.png}');

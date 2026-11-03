/**
 * Draws the bundled sample set (original chibi-style illustrations) as SVG and
 * renders each scene to PNG with Playwright. It also writes the boxes it drew,
 * as a v1 JSON export, to docs/demo-annotations.json for screenshots and tests.
 *
 *   node scripts/samples.mjs            # uses Playwright's Chromium
 *   PW_CHANNEL=msedge node scripts/samples.mjs
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const OUT_DIR = new URL('../src/assets/samples/', import.meta.url);
const DEMO_FILE = new URL('../docs/demo-annotations.json', import.meta.url);

/* ---------------------------------------------------------------- shapes */

const SKIN = ['#ffe4d4', '#fddcc8', '#f6d2b8'];
const shade = (hex, f) => {
  const n = parseInt(hex.slice(1), 16);
  const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => Math.round(f < 0 ? v * (1 + f) : v + (255 - v) * f));
  return `#${c.map((v) => v.toString(16).padStart(2, '0')).join('')}`;
};

let uid = 0;

/** A chibi character whose head (hair included) is centred on (cx, cy) with radius r. */
function character({ cx, cy, r, hair, eyes = '#4b6bfb', shirt = '#ffffff', skin = SKIN[0], style = 'long', mood = 'smile', ears = false, bow }) {
  const id = `c${uid++}`;
  const dark = shade(hair, -0.35);
  const parts = [];

  // hair behind the head
  if (style === 'long') {
    parts.push(`<path d="M ${cx - r * 1.08} ${cy} Q ${cx - r * 1.25} ${cy + r * 1.3} ${cx - r * 0.85} ${cy + r * 1.75} L ${cx + r * 0.85} ${cy + r * 1.75} Q ${cx + r * 1.25} ${cy + r * 1.3} ${cx + r * 1.08} ${cy} Z" fill="${dark}"/>`);
  } else if (style === 'twin') {
    for (const s of [-1, 1]) {
      parts.push(`<ellipse cx="${cx + s * r * 1.25}" cy="${cy + r * 0.75}" rx="${r * 0.33}" ry="${r * 0.95}" transform="rotate(${s * -12} ${cx + s * r * 1.25} ${cy + r * 0.75})" fill="${hair}" stroke="${dark}" stroke-width="${r * 0.03}"/>`);
      parts.push(`<circle cx="${cx + s * r * 1.02}" cy="${cy - r * 0.25}" r="${r * 0.12}" fill="${bow ?? '#ff5d8f'}"/>`);
    }
  }
  parts.push(`<ellipse cx="${cx}" cy="${cy - r * 0.05}" rx="${r * 1.1}" ry="${r * 1.05}" fill="${hair}"/>`);

  // body
  parts.push(`<path d="M ${cx - r * 0.95} ${cy + r * 3.2} Q ${cx - r * 0.95} ${cy + r * 1.05} ${cx} ${cy + r * 1.0} Q ${cx + r * 0.95} ${cy + r * 1.05} ${cx + r * 0.95} ${cy + r * 3.2} Z" fill="${shirt}" stroke="${shade(shirt, -0.25)}" stroke-width="${r * 0.03}"/>`);
  parts.push(`<path d="M ${cx - r * 0.28} ${cy + r * 1.02} L ${cx} ${cy + r * 1.32} L ${cx + r * 0.28} ${cy + r * 1.02} Z" fill="${skin}"/>`);

  // face
  parts.push(`<path d="M ${cx - r * 0.9} ${cy - r * 0.05} C ${cx - r * 0.92} ${cy + r * 0.6} ${cx - r * 0.38} ${cy + r * 0.98} ${cx} ${cy + r * 0.98} C ${cx + r * 0.38} ${cy + r * 0.98} ${cx + r * 0.92} ${cy + r * 0.6} ${cx + r * 0.9} ${cy - r * 0.05} A ${r * 0.9} ${r * 0.85} 0 0 0 ${cx - r * 0.9} ${cy - r * 0.05} Z" fill="${skin}"/>`);

  // eyes
  const ey = cy + r * 0.22;
  for (const s of [-1, 1]) {
    const ex = cx + s * r * 0.4;
    if (mood === 'happy') {
      parts.push(`<path d="M ${ex - r * 0.17} ${ey + r * 0.04} Q ${ex} ${ey - r * 0.2} ${ex + r * 0.17} ${ey + r * 0.04}" fill="none" stroke="#3b2a2a" stroke-width="${r * 0.07}" stroke-linecap="round"/>`);
      continue;
    }
    parts.push(`<ellipse cx="${ex}" cy="${ey}" rx="${r * 0.19}" ry="${r * 0.25}" fill="#fff"/>`);
    parts.push(`<ellipse cx="${ex}" cy="${ey + r * 0.02}" rx="${r * 0.16}" ry="${r * 0.22}" fill="url(#iris-${id})"/>`);
    parts.push(`<ellipse cx="${ex}" cy="${ey + r * 0.04}" rx="${r * 0.07}" ry="${r * 0.11}" fill="#1e1b2e"/>`);
    parts.push(`<circle cx="${ex - r * 0.06}" cy="${ey - r * 0.08}" r="${r * 0.065}" fill="#fff"/>`);
    parts.push(`<circle cx="${ex + r * 0.07}" cy="${ey + r * 0.11}" r="${r * 0.03}" fill="#fff" opacity="0.9"/>`);
    parts.push(`<path d="M ${ex - s * r * 0.2} ${ey - r * 0.16} Q ${ex} ${ey - r * 0.33} ${ex + s * r * 0.23} ${ey - r * 0.2} L ${ex + s * r * 0.27} ${ey - r * 0.27}" fill="none" stroke="#2a1f2d" stroke-width="${r * 0.06}" stroke-linecap="round" stroke-linejoin="round"/>`);
  }

  // blush and mouth
  for (const s of [-1, 1]) parts.push(`<ellipse cx="${cx + s * r * 0.56}" cy="${cy + r * 0.52}" rx="${r * 0.14}" ry="${r * 0.07}" fill="#ff8fa3" opacity="0.55"/>`);
  const my = cy + r * 0.6;
  parts.push(
    mood === 'open'
      ? `<path d="M ${cx - r * 0.12} ${my - r * 0.02} Q ${cx} ${my + r * 0.2} ${cx + r * 0.12} ${my - r * 0.02} Z" fill="#b4344d"/>`
      : `<path d="M ${cx - r * 0.1} ${my} Q ${cx} ${my + r * 0.09} ${cx + r * 0.1} ${my}" fill="none" stroke="#7a3b3b" stroke-width="${r * 0.04}" stroke-linecap="round"/>`,
  );

  // bangs with a zigzag edge, and side locks
  const tips = 7;
  let d = `M ${cx - r * 1.1} ${cy + r * 0.25} C ${cx - r * 1.2} ${cy - r * 1.25} ${cx + r * 1.2} ${cy - r * 1.25} ${cx + r * 1.1} ${cy + r * 0.25}`;
  for (let i = tips; i >= 0; i--) {
    const x = cx - r * 0.95 + (i / tips) * r * 1.9;
    const tipY = cy - r * 0.02 - Math.abs(i - tips / 2) * r * 0.05;
    const notchY = cy - r * 0.38;
    d += ` L ${x} ${i % 2 ? tipY : notchY}`;
  }
  parts.push(`<path d="${d} Z" fill="${hair}"/>`);
  for (const s of [-1, 1]) {
    parts.push(`<path d="M ${cx + s * r * 0.82} ${cy - r * 0.3} Q ${cx + s * r * 1.02} ${cy + r * 0.35} ${cx + s * r * 0.8} ${cy + r * 0.8} Q ${cx + s * r * 0.7} ${cy + r * 0.3} ${cx + s * r * 0.62} ${cy - r * 0.2} Z" fill="${hair}"/>`);
  }
  parts.push(`<path d="M ${cx - r * 0.55} ${cy - r * 0.72} Q ${cx} ${cy - r * 0.95} ${cx + r * 0.55} ${cy - r * 0.72}" fill="none" stroke="#fff" stroke-opacity="0.35" stroke-width="${r * 0.08}" stroke-linecap="round"/>`);

  if (ears) {
    for (const s of [-1, 1]) {
      const bx = cx + s * r * 0.62;
      parts.push(`<path d="M ${bx - r * 0.3} ${cy - r * 0.78} L ${bx + s * r * 0.18} ${cy - r * 1.45} L ${bx + r * 0.3} ${cy - r * 0.78} Z" fill="${hair}"/>`);
      parts.push(`<path d="M ${bx - r * 0.16} ${cy - r * 0.85} L ${bx + s * r * 0.14} ${cy - r * 1.25} L ${bx + r * 0.16} ${cy - r * 0.85} Z" fill="#ffb3c6"/>`);
    }
  }
  if (bow && style !== 'twin') {
    const bx = cx + r * 0.75;
    const by = cy - r * 0.75;
    parts.push(`<path d="M ${bx} ${by} L ${bx - r * 0.32} ${by - r * 0.2} L ${bx - r * 0.32} ${by + r * 0.2} Z M ${bx} ${by} L ${bx + r * 0.32} ${by - r * 0.2} L ${bx + r * 0.32} ${by + r * 0.2} Z" fill="${bow}"/><circle cx="${bx}" cy="${by}" r="${r * 0.08}" fill="${shade(bow, -0.2)}"/>`);
  }

  const defs = `<linearGradient id="iris-${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${shade(eyes, -0.45)}"/><stop offset="1" stop-color="${shade(eyes, 0.35)}"/></linearGradient>`;
  const top = ears ? cy - r * 1.45 : cy - r * 1.1;
  return {
    svg: `<defs>${defs}</defs>${parts.join('')}`,
    box: { label: 'anime_face', x: cx - r * 1.1, y: top, width: r * 2.2, height: cy + r * 1.0 - top },
  };
}

function cat({ cx, cy, r, fur = '#f59e0b', eyes = '#84cc16' }) {
  const dark = shade(fur, -0.3);
  const p = [];
  p.push(`<ellipse cx="${cx}" cy="${cy + r * 1.35}" rx="${r * 0.95}" ry="${r * 0.75}" fill="${fur}"/>`);
  for (const s of [-1, 1]) p.push(`<path d="M ${cx + s * r * 0.95} ${cy - r * 0.2} L ${cx + s * r * 0.75} ${cy - r * 1.15} L ${cx + s * r * 0.2} ${cy - r * 0.75} Z" fill="${fur}" stroke="${dark}" stroke-width="${r * 0.04}"/>`);
  p.push(`<ellipse cx="${cx}" cy="${cy}" rx="${r}" ry="${r * 0.85}" fill="${fur}" stroke="${dark}" stroke-width="${r * 0.04}"/>`);
  p.push(`<path d="M ${cx - r * 0.3} ${cy - r * 0.8} L ${cx - r * 0.2} ${cy - r * 0.45} M ${cx} ${cy - r * 0.85} L ${cx} ${cy - r * 0.5} M ${cx + r * 0.3} ${cy - r * 0.8} L ${cx + r * 0.2} ${cy - r * 0.45}" stroke="${dark}" stroke-width="${r * 0.08}" stroke-linecap="round"/>`);
  for (const s of [-1, 1]) {
    p.push(`<ellipse cx="${cx + s * r * 0.4}" cy="${cy - r * 0.05}" rx="${r * 0.17}" ry="${r * 0.2}" fill="${eyes}"/>`);
    p.push(`<ellipse cx="${cx + s * r * 0.4}" cy="${cy - r * 0.05}" rx="${r * 0.05}" ry="${r * 0.17}" fill="#111"/>`);
    p.push(`<circle cx="${cx + s * r * 0.36}" cy="${cy - r * 0.13}" r="${r * 0.04}" fill="#fff"/>`);
    for (const k of [-1, 1]) p.push(`<path d="M ${cx + s * r * 0.35} ${cy + r * 0.3 + k * r * 0.06} L ${cx + s * r * 1.2} ${cy + r * 0.25 + k * r * 0.16}" stroke="#fff" stroke-width="${r * 0.025}" opacity="0.8"/>`);
  }
  p.push(`<path d="M ${cx - r * 0.08} ${cy + r * 0.2} L ${cx + r * 0.08} ${cy + r * 0.2} L ${cx} ${cy + r * 0.3} Z" fill="#f472b6"/>`);
  p.push(`<path d="M ${cx - r * 0.16} ${cy + r * 0.38} Q ${cx - r * 0.08} ${cy + r * 0.46} ${cx} ${cy + r * 0.32} Q ${cx + r * 0.08} ${cy + r * 0.46} ${cx + r * 0.16} ${cy + r * 0.38}" fill="none" stroke="#5b3a29" stroke-width="${r * 0.04}" stroke-linecap="round"/>`);
  return { svg: p.join(''), box: { label: 'cat', x: cx - r * 1.0, y: cy - r * 1.15, width: r * 2.0, height: r * 2.0 } };
}

/* ---------------------------------------------------------------- scenes */

const sky = (w, h, top, bottom) =>
  `<defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${top}"/><stop offset="1" stop-color="${bottom}"/></linearGradient></defs><rect width="${w}" height="${h}" fill="url(#sky)"/>`;
const cloud = (x, y, s) =>
  `<g fill="#fff" opacity="0.9"><ellipse cx="${x}" cy="${y}" rx="${60 * s}" ry="${28 * s}"/><ellipse cx="${x + 45 * s}" cy="${y - 18 * s}" rx="${45 * s}" ry="${32 * s}"/><ellipse cx="${x - 40 * s}" cy="${y - 10 * s}" rx="${35 * s}" ry="${24 * s}"/></g>`;
const stars = (w, h, n, seed = 7) => {
  let s = seed;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  return Array.from({ length: n }, () => `<circle cx="${rnd() * w}" cy="${rnd() * h * 0.6}" r="${0.8 + rnd() * 1.8}" fill="#fff" opacity="${0.4 + rnd() * 0.6}"/>`).join('');
};
const sparkle = (x, y, s, color = '#fff') =>
  `<path d="M ${x} ${y - s} Q ${x} ${y} ${x + s} ${y} Q ${x} ${y} ${x} ${y + s} Q ${x} ${y} ${x - s} ${y} Q ${x} ${y} ${x} ${y - s} Z" fill="${color}" opacity="0.85"/>`;

const scenes = [
  {
    name: 'picnic',
    width: 1280,
    height: 800,
    background: (w, h) =>
      sky(w, h, '#8ec5ff', '#e8f4ff') +
      `<circle cx="1110" cy="120" r="70" fill="#ffe08a"/>` +
      cloud(260, 140, 1.2) + cloud(760, 90, 0.9) +
      `<path d="M 0 560 Q 320 470 640 540 T 1280 520 L 1280 800 L 0 800 Z" fill="#7bcf7f"/><path d="M 0 640 Q 400 580 800 640 T 1280 630 L 1280 800 L 0 800 Z" fill="#5fbf6a"/>` +
      `<rect x="120" y="650" width="520" height="120" rx="10" fill="#f87171" opacity="0.85"/><path d="M 120 690 H 640 M 120 730 H 640 M 250 650 V 770 M 380 650 V 770 M 510 650 V 770" stroke="#fff" stroke-width="10" opacity="0.6"/>`,
    actors: [
      () => character({ cx: 380, cy: 400, r: 110, hair: '#f472b6', eyes: '#8b5cf6', shirt: '#fde68a', style: 'long', bow: '#60a5fa' }),
      () => character({ cx: 760, cy: 430, r: 95, hair: '#3f3a52', eyes: '#0ea5e9', shirt: '#93c5fd', style: 'short', mood: 'open' }),
      () => cat({ cx: 1040, cy: 600, r: 70, fur: '#fb923c' }),
    ],
  },
  {
    name: 'classroom',
    width: 1200,
    height: 900,
    background: (w, h) =>
      `<rect width="${w}" height="${h}" fill="#f5e9d7"/><rect x="80" y="110" width="640" height="360" rx="12" fill="#2f5d50" stroke="#a16207" stroke-width="18"/>` +
      `<path d="M 140 190 q 60 -30 120 0 t 120 0 M 150 260 h 260 M 150 320 q 40 -20 80 0 t 80 0 t 80 0" stroke="#e5f3ec" stroke-width="6" fill="none" opacity="0.7"/>` +
      `<rect x="830" y="120" width="300" height="340" fill="#bfe3ff" stroke="#fff" stroke-width="16"/><path d="M 980 120 V 460 M 830 290 H 1130" stroke="#fff" stroke-width="12"/>` +
      `<rect y="720" width="${w}" height="180" fill="#c8a27a"/>`,
    actors: [() => character({ cx: 600, cy: 520, r: 220, hair: '#d6dbe7', eyes: '#ef4444', shirt: '#1e3a8a', style: 'twin', bow: '#facc15' })],
  },
  {
    name: 'night-festival',
    width: 1600,
    height: 900,
    background: (w, h) =>
      sky(w, h, '#0b1437', '#3b2a6b') + stars(w, h, 90) +
      [200, 520, 840, 1160, 1480].map((x, i) => `<line x1="${x - 160}" y1="70" x2="${x + 160}" y2="70" stroke="#1f2937" stroke-width="3"/><circle cx="${x}" cy="${120 + (i % 2) * 20}" r="46" fill="#ef4444" opacity="0.95"/><circle cx="${x}" cy="${120 + (i % 2) * 20}" r="80" fill="#f97316" opacity="0.15"/>`).join('') +
      `<rect y="760" width="${w}" height="140" fill="#1e1b3a"/>`,
    actors: [
      () => character({ cx: 330, cy: 500, r: 105, hair: '#facc15', eyes: '#16a34a', shirt: '#be123c', style: 'long', mood: 'happy' }),
      () => character({ cx: 800, cy: 470, r: 120, hair: '#1f2937', eyes: '#f59e0b', shirt: '#4338ca', style: 'short' }),
      () => character({ cx: 1270, cy: 510, r: 100, hair: '#a78bfa', eyes: '#ec4899', shirt: '#0f766e', style: 'twin', bow: '#f472b6', mood: 'open' }),
    ],
  },
  {
    name: 'portrait',
    width: 900,
    height: 1200,
    background: (w, h) =>
      `<defs><radialGradient id="glow" cx="0.5" cy="0.4" r="0.8"><stop offset="0" stop-color="#ffe4f1"/><stop offset="1" stop-color="#c4b5fd"/></radialGradient></defs><rect width="${w}" height="${h}" fill="url(#glow)"/>` +
      [[120, 180, 26], [760, 260, 34], [690, 980, 22], [170, 900, 30], [450, 120, 18]].map(([x, y, s]) => sparkle(x, y, s)).join(''),
    actors: [() => character({ cx: 450, cy: 560, r: 250, hair: '#2dd4bf', eyes: '#2563eb', shirt: '#f8fafc', style: 'long', ears: true })],
  },
  {
    name: 'beach',
    width: 1440,
    height: 960,
    background: (w, h) =>
      sky(w, h, '#7dd3fc', '#fef3c7') + cloud(1150, 150, 1.1) +
      `<rect y="430" width="${w}" height="240" fill="#38bdf8"/><path d="M 0 470 Q 180 450 360 470 T 720 470 T 1080 470 T 1440 470" stroke="#e0f2fe" stroke-width="8" fill="none"/>` +
      `<path d="M 0 640 Q 720 590 1440 650 L 1440 960 L 0 960 Z" fill="#fcd9a4"/>` +
      `<path d="M 1180 640 L 1180 380" stroke="#78350f" stroke-width="10"/><path d="M 1060 400 Q 1180 300 1300 400 Z" fill="#f43f5e"/>`,
    actors: [
      () => character({ cx: 420, cy: 560, r: 120, hair: '#fb7185', eyes: '#14b8a6', shirt: '#fef08a', style: 'short', mood: 'happy', bow: '#38bdf8' }),
      () => character({ cx: 800, cy: 580, r: 105, hair: '#7c2d12', eyes: '#65a30d', shirt: '#f0abfc', style: 'long' }),
      () => cat({ cx: 1080, cy: 770, r: 62, fur: '#f8fafc', eyes: '#3b82f6' }),
    ],
  },
  {
    name: 'group-photo',
    width: 1920,
    height: 1080,
    background: (w, h) =>
      sky(w, h, '#fde68a', '#fca5a5') + `<rect y="820" width="${w}" height="260" fill="#9a6b4f"/>` + [300, 960, 1620].map((x) => sparkle(x, 120, 30, '#fff7ed')).join(''),
    actors: [
      () => character({ cx: 300, cy: 560, r: 115, hair: '#0ea5e9', eyes: '#f97316', shirt: '#fafafa', style: 'short' }),
      () => character({ cx: 640, cy: 520, r: 135, hair: '#f59e0b', eyes: '#7c3aed', shirt: '#22c55e', style: 'twin', bow: '#ef4444', mood: 'open' }),
      () => character({ cx: 990, cy: 470, r: 160, hair: '#111827', eyes: '#dc2626', shirt: '#e11d48', style: 'long', mood: 'happy' }),
      () => character({ cx: 1340, cy: 530, r: 130, hair: '#e879f9', eyes: '#0d9488', shirt: '#fef9c3', style: 'long', ears: true }),
      () => character({ cx: 1660, cy: 580, r: 105, hair: '#84cc16', eyes: '#2563eb', shirt: '#334155', style: 'short', bow: '#f472b6' }),
    ],
  },
];

/* ---------------------------------------------------------------- render */

const round = (b) => ({ ...b, x: Math.round(b.x), y: Math.round(b.y), width: Math.round(b.width), height: Math.round(b.height) });

const browser = await chromium.launch({ channel: process.env.PW_CHANNEL || undefined });
const page = await browser.newPage();
await mkdir(OUT_DIR, { recursive: true });
const records = [];

for (const [i, scene] of scenes.entries()) {
  const drawn = scene.actors.map((make) => make());
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${scene.width}" height="${scene.height}" viewBox="0 0 ${scene.width} ${scene.height}">${scene.background(scene.width, scene.height)}${drawn.map((d) => d.svg).join('')}</svg>`;
  const file = `${String(i + 1).padStart(2, '0')}-${scene.name}.png`;
  await page.setViewportSize({ width: scene.width, height: scene.height });
  await page.setContent(`<body style="margin:0">${svg}</body>`);
  await page.screenshot({ path: fileURLToPath(new URL(file, OUT_DIR)), clip: { x: 0, y: 0, width: scene.width, height: scene.height } });
  const timestamp = new Date(Date.UTC(2026, 10, 4, 8, i * 3)).toISOString();
  records.push({
    session_id: `session_${Date.parse(timestamp)}`,
    image_url: `samples/${file}`,
    original_size: { width: scene.width, height: scene.height },
    display_size: { width: scene.width, height: scene.height },
    scale_factor: 1,
    annotator: ['nat', 'mika', 'nat', 'yuki', 'mika', 'nat'][i],
    timestamp,
    bounding_boxes: drawn.map((d, j) => ({ id: `box_${Date.parse(timestamp)}_${scene.name.slice(0, 4)}${j}`, ...round(d.box) })),
  });
  console.log(`rendered ${file}`);
}
await browser.close();

const boxes = records.reduce((n, r) => n + r.bounding_boxes.length, 0);
const demo = {
  export_info: {
    export_date: records.at(-1).timestamp,
    total_images: records.length,
    total_annotations: boxes,
    data_range: { first_annotation: records[0].timestamp, last_annotation: records.at(-1).timestamp },
  },
  annotation_records: records,
};
await writeFile(DEMO_FILE, `${JSON.stringify(demo, null, 2)}\n`);
console.log(`wrote ${records.length} demo records with ${boxes} boxes`);

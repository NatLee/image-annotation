import { describe, expect, it } from 'vitest';
import { BOX } from '@/config';
import {
  constrainBox,
  defaultBox,
  displaySize,
  fitView,
  moveBox,
  rectFromPoints,
  resizeBox,
  toImagePoint,
  toScreenRect,
  zoomAt,
} from './geometry';

const image = { width: 1000, height: 800 };

describe('constrainBox (v1 rules)', () => {
  it('enforces the 10 px minimum and rounds', () => {
    expect(constrainBox({ x: 5.4, y: 5.6, width: 2, height: 3 }, image)).toEqual({ x: 5, y: 6, width: BOX.minSize, height: BOX.minSize });
  });

  it('shifts a box back inside instead of shrinking it', () => {
    expect(constrainBox({ x: 950, y: -20, width: 100, height: 100 }, image)).toEqual({ x: 900, y: 0, width: 100, height: 100 });
  });

  it('never makes a box larger than the image', () => {
    expect(constrainBox({ x: 0, y: 0, width: 5000, height: 5000 }, image)).toEqual({ x: 0, y: 0, width: 1000, height: 800 });
  });
});

describe('defaultBox (v1 "Add Box")', () => {
  it('is a centred square of 25% of the short side', () => {
    // 800 * 0.25 = 200; centre: (1000 - 200) / 2 = 400, (800 - 200) / 2 = 300
    expect(defaultBox(image, [])).toEqual({ x: 400, y: 300, width: 200, height: 200 });
  });

  it('offsets 20 px from the last box', () => {
    expect(defaultBox(image, [{ x: 10, y: 30, width: 50, height: 50 }])).toEqual({ x: 30, y: 50, width: 200, height: 200 });
  });
});

describe('moveBox', () => {
  it('moves and stops at the border', () => {
    const box = { x: 100, y: 100, width: 200, height: 100 };
    expect(moveBox(box, 50, -20, image)).toEqual({ x: 150, y: 80, width: 200, height: 100 });
    expect(moveBox(box, 5000, 5000, image)).toEqual({ x: 800, y: 700, width: 200, height: 100 });
  });
});

describe('resizeBox', () => {
  const box = { x: 100, y: 100, width: 200, height: 100 };

  it('moves only the dragged edges', () => {
    expect(resizeBox(box, 'se', 30, 40, image)).toEqual({ x: 100, y: 100, width: 230, height: 140 });
    expect(resizeBox(box, 'nw', -30, -40, image)).toEqual({ x: 70, y: 60, width: 230, height: 140 });
    expect(resizeBox(box, 'e', 50, 999, image)).toEqual({ x: 100, y: 100, width: 250, height: 100 });
    expect(resizeBox(box, 'n', 999, -10, image)).toEqual({ x: 100, y: 90, width: 200, height: 110 });
  });

  it('flips when dragged past the opposite edge', () => {
    // right edge dragged from 300 to 50: the box now spans 50..100
    expect(resizeBox(box, 'e', -250, 0, image)).toEqual({ x: 50, y: 100, width: 50, height: 100 });
  });

  it('stops edges at the image border', () => {
    expect(resizeBox(box, 'nw', -500, -500, image)).toEqual({ x: 0, y: 0, width: 300, height: 200 });
  });

  it('keeps the still edge in place at the minimum size', () => {
    // right edge dragged onto the left edge: left stays at 100
    expect(resizeBox(box, 'e', -199, 0, image)).toEqual({ x: 100, y: 100, width: BOX.minSize, height: 100 });
    // left edge dragged onto the right edge: right stays at 300
    expect(resizeBox(box, 'w', 199, 0, image)).toEqual({ x: 300 - BOX.minSize, y: 100, width: BOX.minSize, height: 100 });
  });
});

describe('rectFromPoints', () => {
  it('normalises any drag direction and clips to the image', () => {
    expect(rectFromPoints({ x: 300, y: 200 }, { x: 100, y: 50 }, image)).toEqual({ x: 100, y: 50, width: 200, height: 150 });
    expect(rectFromPoints({ x: -50, y: 700 }, { x: 80.6, y: 900 }, image)).toEqual({ x: 0, y: 700, width: 81, height: 100 });
  });
});

describe('view transform', () => {
  it('fits and centres the image inside the padding', () => {
    // viewport 1048 x 848 with 24 px padding leaves exactly 1000 x 800
    expect(fitView(image, { width: 1048, height: 848 }, 24)).toEqual({ scale: 1, x: 24, y: 24 });
    const view = fitView(image, { width: 548, height: 1000 }, 24);
    expect(view.scale).toBe(0.5);
    expect(view.y).toBe(300); // (1000 - 400) / 2
  });

  it('zooms around the anchor point', () => {
    const view = { scale: 1, x: 0, y: 0 };
    const anchor = { x: 200, y: 100 };
    const zoomed = zoomAt(view, 2, anchor);
    expect(zoomed.scale).toBe(2);
    // the image point under the cursor does not move
    expect(toImagePoint(zoomed, anchor)).toEqual(toImagePoint(view, anchor));
  });

  it('clamps the zoom', () => {
    expect(zoomAt({ scale: 1, x: 0, y: 0 }, 1e6, { x: 0, y: 0 }).scale).toBe(32);
  });

  it('maps rectangles to the screen', () => {
    expect(toScreenRect({ scale: 0.5, x: 10, y: 20 }, { x: 100, y: 100, width: 50, height: 40 })).toEqual({ x: 60, y: 70, width: 25, height: 20 });
  });

  it('rounds the v1 display size down', () => {
    expect(displaySize({ width: 1920, height: 1080 }, 0.3333)).toEqual({ width: 639, height: 359 });
  });
});

import { BOX, ZOOM } from '@/config';
import type { Point, Rect, ResizeHandle, Size } from '@/types';

export const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

const roundRect = (r: Rect): Rect => ({
  x: Math.round(r.x),
  y: Math.round(r.y),
  width: Math.round(r.width),
  height: Math.round(r.height),
});

export const sameRect = (a: Rect, b: Rect) =>
  a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height;

/**
 * Keep a box inside the image the way v1 did: enforce the minimum size, never
 * exceed the image, shift (not shrink) it back inside, round to whole pixels.
 */
export function constrainBox(rect: Rect, image: Size, minSize: number = BOX.minSize): Rect {
  const width = Math.min(Math.max(minSize, rect.width), image.width);
  const height = Math.min(Math.max(minSize, rect.height), image.height);
  return roundRect({
    x: clamp(rect.x, 0, image.width - width),
    y: clamp(rect.y, 0, image.height - height),
    width,
    height,
  });
}

/** Move a box by (dx, dy) image pixels without leaving the image. */
export function moveBox(start: Rect, dx: number, dy: number, image: Size): Rect {
  return constrainBox({ ...start, x: start.x + dx, y: start.y + dy }, image);
}

/**
 * Drag one edge or corner. Dragging past the opposite edge flips the box,
 * edges stop at the image border, and the edge that did not move stays put
 * when the box would get smaller than the minimum size.
 */
export function resizeBox(
  start: Rect,
  handle: ResizeHandle,
  dx: number,
  dy: number,
  image: Size,
  minSize: number = BOX.minSize,
): Rect {
  // One axis at a time: `from`/`to` are the low/high edges before the drag.
  const axis = (from: number, to: number, movesFrom: boolean, movesTo: boolean, delta: number, limit: number) => {
    const a = from + (movesFrom ? delta : 0);
    const b = to + (movesTo ? delta : 0);
    let lo = clamp(Math.min(a, b), 0, limit);
    let hi = clamp(Math.max(a, b), 0, limit);
    if (hi - lo < minSize) {
      // Grow away from the edge that stayed still.
      const anchor = movesFrom ? to : from;
      if (Math.abs(lo - anchor) <= Math.abs(hi - anchor)) hi = lo + minSize;
      else lo = hi - minSize;
    }
    return [lo, hi] as const;
  };

  const [left, right] = axis(start.x, start.x + start.width, handle.includes('w'), handle.includes('e'), dx, image.width);
  const [top, bottom] = axis(start.y, start.y + start.height, handle.includes('n'), handle.includes('s'), dy, image.height);
  return constrainBox({ x: left, y: top, width: right - left, height: bottom - top }, image, minSize);
}

/** The rectangle spanned by a drag from `a` to `b`, clipped to the image. */
export function rectFromPoints(a: Point, b: Point, image: Size): Rect {
  const left = clamp(Math.min(a.x, b.x), 0, image.width);
  const right = clamp(Math.max(a.x, b.x), 0, image.width);
  const top = clamp(Math.min(a.y, b.y), 0, image.height);
  const bottom = clamp(Math.max(a.y, b.y), 0, image.height);
  return roundRect({ x: left, y: top, width: right - left, height: bottom - top });
}

/**
 * v1 "Add Box": a square of 25% of the short side, centred, or offset from the
 * last box when there already is one.
 */
export function defaultBox(image: Size, existing: readonly Rect[]): Rect {
  const side = Math.min(image.width, image.height) * BOX.defaultSizeRatio;
  const last = existing.at(-1);
  const x = last ? last.x + BOX.stackOffset : (image.width - side) / 2;
  const y = last ? last.y + BOX.stackOffset : (image.height - side) / 2;
  return constrainBox({ x, y, width: side, height: side }, image);
}

/* ------------------------------------------------------------------------ */
/* View transform: screen = image * scale + offset                          */
/* ------------------------------------------------------------------------ */

export interface View {
  scale: number;
  x: number;
  y: number;
}

/** Scale and centre the image so it fits the viewport with some padding. */
export function fitView(image: Size, viewport: Size, padding: number = ZOOM.fitPadding): View {
  const availableWidth = Math.max(1, viewport.width - padding * 2);
  const availableHeight = Math.max(1, viewport.height - padding * 2);
  const scale = Math.min(availableWidth / image.width, availableHeight / image.height);
  return {
    scale,
    x: (viewport.width - image.width * scale) / 2,
    y: (viewport.height - image.height * scale) / 2,
  };
}

/** Zoom by `factor`, keeping the image point under `anchor` (screen) still. */
export function zoomAt(view: View, factor: number, anchor: Point): View {
  const scale = clamp(view.scale * factor, ZOOM.min, ZOOM.max);
  const k = scale / view.scale;
  return {
    scale,
    x: anchor.x - (anchor.x - view.x) * k,
    y: anchor.y - (anchor.y - view.y) * k,
  };
}

export const toImagePoint = (view: View, p: Point): Point => ({
  x: (p.x - view.x) / view.scale,
  y: (p.y - view.y) / view.scale,
});

export const toScreenRect = (view: View, r: Rect): Rect => ({
  x: r.x * view.scale + view.x,
  y: r.y * view.scale + view.y,
  width: r.width * view.scale,
  height: r.height * view.scale,
});

/** v1 `display_size`: the fitted image size, rounded down to whole pixels. */
export const displaySize = (image: Size, scale: number): Size => ({
  width: Math.floor(image.width * scale),
  height: Math.floor(image.height * scale),
});

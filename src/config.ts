/**
 * App-wide settings. Logic reads these instead of carrying its own numbers,
 * names or URLs. Values marked "v1" reproduce the original app's behaviour.
 */

export const STORAGE_KEYS = {
  /** v1 key: submitted annotations. Kept so existing browser data still loads. */
  records: 'annotation_data',
  /** v1 key: the annotator's name. */
  userName: 'userName',
  classes: 'image-annotation:classes',
} as const;

/** v1 label for every box; also the first class of a fresh install. */
export const DEFAULT_LABEL = 'anime_face';
/** v1 annotator name when the name field is empty. */
export const DEFAULT_ANNOTATOR = 'anonymous';
/** Annotator recorded for data imported from COCO, YOLO or VOC files. */
export const IMPORTED_ANNOTATOR = 'import';

export const BOX = {
  /** v1: the default box's side is 25% of the image's short side. */
  defaultSizeRatio: 0.25,
  /** v1: "Add box" places the new box 20 px right and down from the last one. */
  stackOffset: 20,
  /** v1: smallest box side, in image pixels. */
  minSize: 10,
  /** A drag shorter than this (screen pixels) is a click, not a new box. */
  minDragScreenPx: 4,
  /** Arrow-key nudge in image pixels, and with Shift held. */
  nudge: 1,
  nudgeLarge: 10,
} as const;

/** v1: the `d` overlay splits the image into 10 × 10 cells. */
export const GRID_DIVISIONS = 10;

/** Undo steps kept per image. */
export const HISTORY_LIMIT = 200;

export const ZOOM = {
  min: 0.02,
  max: 32,
  /** Factor for one zoom-in / zoom-out step. */
  step: 1.25,
  /** How strongly one wheel "tick" (deltaY) zooms. */
  wheelSensitivity: 0.0015,
  /** Empty space around the image when it is fitted to the stage. */
  fitPadding: 24,
  /** Above this zoom, pixels are drawn sharp instead of smoothed. */
  pixelatedAbove: 3,
} as const;

/** Class colours, assigned in order. The first is the v1 green. */
export const PALETTE = [
  '#22c55e',
  '#f97316',
  '#3b82f6',
  '#e11d48',
  '#a855f7',
  '#eab308',
  '#06b6d4',
  '#ec4899',
  '#84cc16',
  '#8b5cf6',
] as const;

/** Online source of random SFW anime images (v1 used waifu.im, which is gone). */
export const RANDOM_SOURCE = {
  name: 'nekos.best',
  homepage: 'https://nekos.best',
  endpoint: 'https://nekos.best/api/v2/neko',
} as const;

export const REPO_URL = 'https://github.com/NatLee/image-annotation';

/** How long a toast stays on screen, in milliseconds. */
export const TOAST_MS = 3500;

import { ensureClasses } from '@/lib/classes';
import { constrainBox, defaultBox, moveBox, sameRect } from '@/lib/geometry';
import { type History, canRedo, canUndo, commit, createHistory, redo, undo } from '@/lib/history';
import { emptyData, findRecord, upsertRecords } from '@/lib/records';
import type { AnnotationData, AnnotationSession, BoundingBox, ImageItem, LabelClass, Rect, Size } from '@/types';

/**
 * Everything the editor changes goes through this reducer, so it stays pure
 * and testable. Ids and timestamps arrive in the actions; nothing in here
 * reads the clock, random numbers or the browser.
 */

export interface Draft {
  history: History<BoundingBox[]>;
  /** Changed since it was opened or last submitted. */
  dirty: boolean;
}

export interface WorkspaceState {
  images: ImageItem[];
  currentKey: string | null;
  drafts: Record<string, Draft>;
  selectedId: string | null;
  records: AnnotationData;
  classes: LabelClass[];
  activeClass: string;
}

export type Action =
  | { type: 'images/add'; items: ImageItem[]; open?: boolean }
  | { type: 'images/remove'; key: string }
  | { type: 'image/open'; key: string }
  | { type: 'image/step'; delta: 1 | -1 }
  | { type: 'image/loaded'; key: string; size: Size; boxId: string }
  | { type: 'image/failed'; key: string }
  | { type: 'box/add'; id: string; rect?: Rect }
  | { type: 'box/change'; id: string; rect: Rect }
  | { type: 'box/nudge'; dx: number; dy: number }
  | { type: 'box/label'; id: string; label: string }
  | { type: 'box/delete'; id?: string }
  | { type: 'box/select'; id: string | null }
  | { type: 'box/cycle'; delta: 1 | -1 }
  | { type: 'history/undo' }
  | { type: 'history/redo' }
  | { type: 'class/add'; name: string }
  | { type: 'class/remove'; name: string }
  | { type: 'class/color'; name: string; color: string }
  | { type: 'class/activate'; name: string }
  | { type: 'submit'; record: AnnotationSession; now: string }
  | { type: 'records/import'; records: AnnotationSession[]; now: string }
  | { type: 'records/clear'; now: string };

export function createWorkspace(init: {
  images?: ImageItem[];
  records: AnnotationData;
  classes: LabelClass[];
}): WorkspaceState {
  const classes = ensureClasses(init.classes, init.records.annotation_records.flatMap((r) => r.bounding_boxes.map((b) => b.label)));
  return {
    images: init.images ?? [],
    currentKey: null,
    drafts: {},
    selectedId: null,
    records: init.records,
    classes,
    activeClass: classes[0].name,
  };
}

/* ------------------------------------------------------------------------ */
/* Selectors                                                                */
/* ------------------------------------------------------------------------ */

export const currentItem = (s: WorkspaceState) => s.images.find((i) => i.key === s.currentKey);
export const currentDraft = (s: WorkspaceState) => (s.currentKey ? s.drafts[s.currentKey] : undefined);
export const currentBoxes = (s: WorkspaceState): BoundingBox[] => currentDraft(s)?.history.present ?? [];
export const isDone = (s: WorkspaceState, key: string) => !!findRecord(s.records, key);
export const canUndoCurrent = (s: WorkspaceState) => canUndo(currentDraft(s)?.history);
export const canRedoCurrent = (s: WorkspaceState) => canRedo(currentDraft(s)?.history);
export const hasUnsavedWork = (s: WorkspaceState) => Object.values(s.drafts).some((d) => d.dirty);

export function progress(s: WorkspaceState) {
  const done = new Set(s.records.annotation_records.map((r) => r.image_url));
  return { done: s.images.filter((i) => done.has(i.key)).length, total: s.images.length };
}

/** The first image after the current one (wrapping; from the top when none is open) that has no record yet. */
export function nextPendingKey(s: WorkspaceState): string | undefined {
  const current = s.images.findIndex((i) => i.key === s.currentKey);
  const done = new Set(s.records.annotation_records.map((r) => r.image_url));
  for (let n = 1; n <= s.images.length; n++) {
    const item = s.images[(current + n) % s.images.length];
    if (!done.has(item.key) && !item.failed && item.key !== s.currentKey) return item.key;
  }
  return undefined;
}

/**
 * The v1 submit record. Returns `undefined` when there is nothing to submit
 * (no image, image not loaded yet, or no boxes — v1 refused those too).
 */
export function buildRecord(
  s: WorkspaceState,
  meta: { sessionId: string; annotator: string; now: string; displaySize: Size; scaleFactor: number },
): AnnotationSession | undefined {
  const item = currentItem(s);
  const boxes = currentBoxes(s);
  if (!item?.size || !boxes.length) return undefined;
  return {
    session_id: meta.sessionId,
    image_url: item.key,
    original_size: item.size,
    display_size: meta.displaySize,
    scale_factor: meta.scaleFactor,
    annotator: meta.annotator,
    timestamp: meta.now,
    bounding_boxes: boxes.map((b) => ({ ...b })),
  };
}

/* ------------------------------------------------------------------------ */
/* Reducer                                                                  */
/* ------------------------------------------------------------------------ */

/** A fresh draft: the saved boxes if the image was submitted, else v1's default box. */
function openDraft(s: WorkspaceState, key: string, size: Size, boxId: string): Draft {
  const record = findRecord(s.records, key);
  const boxes = record
    ? record.bounding_boxes.map((b) => ({ ...b }))
    : [{ id: boxId, label: s.activeClass, ...defaultBox(size, []) }];
  return { history: createHistory(boxes), dirty: false };
}

/** Apply an edit to the current image's boxes as one undo step. */
function edit(s: WorkspaceState, change: (boxes: BoundingBox[], size: Size) => BoundingBox[], selectedId = s.selectedId): WorkspaceState {
  const item = currentItem(s);
  const draft = currentDraft(s);
  if (!item?.size || !draft) return s;
  const next = change(draft.history.present, item.size);
  if (next === draft.history.present) return s;
  return {
    ...s,
    selectedId,
    drafts: { ...s.drafts, [item.key]: { history: commit(draft.history, next), dirty: true } },
  };
}

const selectedOrLast = (s: WorkspaceState, boxes: BoundingBox[]) =>
  boxes.find((b) => b.id === s.selectedId) ?? boxes.at(-1);

function open(s: WorkspaceState, key: string | undefined): WorkspaceState {
  if (!key || key === s.currentKey) return s;
  return { ...s, currentKey: key, selectedId: null };
}

export function reducer(s: WorkspaceState, action: Action): WorkspaceState {
  switch (action.type) {
    case 'images/add': {
      const known = new Set(s.images.map((i) => i.key));
      const fresh = action.items.filter((i) => !known.has(i.key) && known.add(i.key));
      const next = fresh.length ? { ...s, images: [...s.images, ...fresh] } : s;
      return action.open ? open(next, (fresh[0] ?? action.items[0])?.key) : next;
    }

    case 'images/remove': {
      const index = s.images.findIndex((i) => i.key === action.key);
      if (index < 0) return s;
      const images = s.images.filter((i) => i.key !== action.key);
      const drafts = { ...s.drafts };
      delete drafts[action.key];
      const currentKey = s.currentKey === action.key ? (images[Math.min(index, images.length - 1)]?.key ?? null) : s.currentKey;
      return { ...s, images, drafts, currentKey, selectedId: currentKey === s.currentKey ? s.selectedId : null };
    }

    case 'image/open':
      return open(s, s.images.some((i) => i.key === action.key) ? action.key : undefined);

    case 'image/step': {
      if (!s.images.length) return s;
      const index = s.images.findIndex((i) => i.key === s.currentKey);
      const next = (index + action.delta + s.images.length) % s.images.length;
      return open(s, s.images[next].key);
    }

    case 'image/loaded': {
      const images = s.images.map((i) => (i.key === action.key ? { ...i, size: action.size, failed: false } : i));
      const drafts = s.drafts[action.key]
        ? s.drafts
        : { ...s.drafts, [action.key]: openDraft(s, action.key, action.size, action.boxId) };
      return { ...s, images, drafts };
    }

    case 'image/failed':
      return { ...s, images: s.images.map((i) => (i.key === action.key ? { ...i, failed: true } : i)) };

    case 'box/add':
      return edit(
        s,
        (boxes, size) => [
          ...boxes,
          { id: action.id, label: s.activeClass, ...(action.rect ? constrainBox(action.rect, size) : defaultBox(size, boxes)) },
        ],
        action.id,
      );

    case 'box/change':
      return edit(s, (boxes, size) => {
        const rect = constrainBox(action.rect, size);
        const box = boxes.find((b) => b.id === action.id);
        if (!box || sameRect(box, rect)) return boxes;
        return boxes.map((b) => (b.id === action.id ? { ...b, ...rect } : b));
      });

    case 'box/nudge':
      return edit(s, (boxes, size) => {
        const box = boxes.find((b) => b.id === s.selectedId);
        if (!box) return boxes;
        const rect = moveBox(box, action.dx, action.dy, size);
        return sameRect(box, rect) ? boxes : boxes.map((b) => (b.id === box.id ? { ...b, ...rect } : b));
      });

    case 'box/label': {
      const withClass = { ...s, classes: ensureClasses(s.classes, [action.label]) };
      return edit(withClass, (boxes) => {
        const box = boxes.find((b) => b.id === action.id);
        return !box || box.label === action.label ? boxes : boxes.map((b) => (b.id === action.id ? { ...b, label: action.label } : b));
      });
    }

    case 'box/delete': {
      const boxes = currentBoxes(s);
      const target = action.id ? boxes.find((b) => b.id === action.id) : selectedOrLast(s, boxes);
      if (!target) return s;
      return edit(s, (list) => list.filter((b) => b.id !== target.id), s.selectedId === target.id ? null : s.selectedId);
    }

    case 'box/select':
      return { ...s, selectedId: action.id };

    case 'box/cycle': {
      const boxes = currentBoxes(s);
      if (!boxes.length) return s;
      const index = boxes.findIndex((b) => b.id === s.selectedId);
      const next = index < 0 ? (action.delta > 0 ? 0 : boxes.length - 1) : (index + action.delta + boxes.length) % boxes.length;
      return { ...s, selectedId: boxes[next].id };
    }

    case 'history/undo':
    case 'history/redo': {
      const draft = currentDraft(s);
      if (!draft || !s.currentKey) return s;
      const history = action.type === 'history/undo' ? undo(draft.history) : redo(draft.history);
      if (history === draft.history) return s;
      const selectedId = history.present.some((b) => b.id === s.selectedId) ? s.selectedId : null;
      return { ...s, selectedId, drafts: { ...s.drafts, [s.currentKey]: { history, dirty: true } } };
    }

    case 'class/add': {
      const name = action.name.trim();
      if (!name) return s;
      return { ...s, classes: ensureClasses(s.classes, [name]), activeClass: name };
    }

    case 'class/remove': {
      if (s.classes.length <= 1) return s; // there is always at least one class to draw with
      const classes = s.classes.filter((c) => c.name !== action.name);
      if (classes.length === s.classes.length) return s;
      return { ...s, classes, activeClass: s.activeClass === action.name ? classes[0].name : s.activeClass };
    }

    case 'class/color':
      return { ...s, classes: s.classes.map((c) => (c.name === action.name ? { ...c, color: action.color } : c)) };

    case 'class/activate': {
      if (!s.classes.some((c) => c.name === action.name)) return s;
      const active = { ...s, activeClass: action.name };
      // Picking a class while a box is selected also relabels that box.
      return s.selectedId ? reducer(active, { type: 'box/label', id: s.selectedId, label: action.name }) : active;
    }

    case 'submit': {
      const key = action.record.image_url;
      const draft = s.drafts[key];
      return {
        ...s,
        records: upsertRecords(s.records, [action.record], action.now),
        drafts: draft ? { ...s.drafts, [key]: { ...draft, dirty: false } } : s.drafts,
      };
    }

    case 'records/import': {
      if (!action.records.length) return s;
      const records = upsertRecords(s.records, action.records, action.now);
      const classes = ensureClasses(s.classes, action.records.flatMap((r) => r.bounding_boxes.map((b) => b.label)));
      // Imported data replaces what is on screen for those images.
      const drafts = { ...s.drafts };
      for (const record of action.records) {
        if (drafts[record.image_url]) {
          drafts[record.image_url] = { history: createHistory(record.bounding_boxes.map((b) => ({ ...b }))), dirty: false };
        }
      }
      const touchesCurrent = action.records.some((r) => r.image_url === s.currentKey);
      return { ...s, records, classes, drafts, selectedId: touchesCurrent ? null : s.selectedId };
    }

    case 'records/clear':
      return { ...s, records: emptyData(action.now) };
  }
}


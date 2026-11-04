import { describe, expect, it } from 'vitest';
import { DEFAULT_LABEL } from '@/config';
import { DEFAULT_CLASSES } from './classes';
import { emptyData } from './records';
import type { AnnotationSession, ImageItem } from '@/types';
import {
  type Action,
  type WorkspaceState,
  buildRecord,
  canRedoCurrent,
  canUndoCurrent,
  createWorkspace,
  currentBoxes,
  hasUnsavedWork,
  nextPendingKey,
  progress,
  reducer,
} from './workspace';

const NOW = '2026-11-04T00:00:00.000Z';
const item = (key: string): ImageItem => ({ key, src: key, name: key, source: 'sample' });
const size = { width: 1000, height: 800 };

const run = (state: WorkspaceState, ...actions: Action[]) => actions.reduce(reducer, state);

/** A workspace with three images, the first one open and loaded. */
function loaded(): WorkspaceState {
  const s = createWorkspace({ records: emptyData(NOW), classes: DEFAULT_CLASSES });
  return run(
    s,
    { type: 'images/add', items: [item('a.png'), item('b.png'), item('c.png')], open: true },
    { type: 'image/loaded', key: 'a.png', size, boxId: 'default' },
  );
}

const meta = { sessionId: 'session_1', annotator: 'nat', now: NOW, displaySize: { width: 500, height: 400 }, scaleFactor: 0.5 };

function submit(s: WorkspaceState): WorkspaceState {
  const record = buildRecord(s, meta)!;
  return reducer(s, { type: 'submit', record, now: NOW });
}

describe('opening images', () => {
  it('starts each new image with the v1 default box', () => {
    const s = loaded();
    expect(s.currentKey).toBe('a.png');
    expect(currentBoxes(s)).toEqual([{ id: 'default', label: DEFAULT_LABEL, x: 400, y: 300, width: 200, height: 200 }]);
    expect(hasUnsavedWork(s)).toBe(false);
  });

  it('does not add the same image twice', () => {
    const s = run(loaded(), { type: 'images/add', items: [item('a.png'), item('d.png')] });
    expect(s.images.map((i) => i.key)).toEqual(['a.png', 'b.png', 'c.png', 'd.png']);
  });

  it('keeps a draft when you come back to an image', () => {
    const s = run(
      loaded(),
      { type: 'box/add', id: 'b1', rect: { x: 0, y: 0, width: 50, height: 50 } },
      { type: 'image/step', delta: 1 },
      { type: 'image/step', delta: -1 },
      { type: 'image/loaded', key: 'a.png', size, boxId: 'ignored' },
    );
    expect(currentBoxes(s).map((b) => b.id)).toEqual(['default', 'b1']);
  });

  it('wraps around when stepping past the end', () => {
    expect(run(loaded(), { type: 'image/step', delta: -1 }).currentKey).toBe('c.png');
  });

  it('opens submitted images with their saved boxes', () => {
    const done = submit(run(loaded(), { type: 'box/add', id: 'b1', rect: { x: 0, y: 0, width: 50, height: 50 } }));
    const fresh = createWorkspace({ records: done.records, classes: done.classes });
    const s = run(fresh, { type: 'images/add', items: [item('a.png')], open: true }, { type: 'image/loaded', key: 'a.png', size, boxId: 'x' });
    expect(currentBoxes(s).map((b) => b.id)).toEqual(['default', 'b1']);
  });
});

describe('editing boxes', () => {
  it('adds a drawn box with the active class and selects it', () => {
    const s = run(loaded(), { type: 'class/add', name: 'cat' }, { type: 'box/add', id: 'b1', rect: { x: 10, y: 10, width: 3, height: 3 } });
    const box = currentBoxes(s).find((b) => b.id === 'b1')!;
    expect(box).toMatchObject({ label: 'cat', width: 10, height: 10 }); // min size applied
    expect(s.selectedId).toBe('b1');
  });

  it('"Add box" without a rectangle offsets from the last box (v1)', () => {
    const s = run(loaded(), { type: 'box/add', id: 'b1' });
    expect(currentBoxes(s)[1]).toMatchObject({ x: 420, y: 320, width: 200, height: 200 });
  });

  it('deletes the selected box, or the last one when nothing is selected', () => {
    let s = run(loaded(), { type: 'box/add', id: 'b1' }, { type: 'box/add', id: 'b2' }, { type: 'box/select', id: 'b1' }, { type: 'box/delete' });
    expect(currentBoxes(s).map((b) => b.id)).toEqual(['default', 'b2']);
    expect(s.selectedId).toBeNull();
    s = reducer(s, { type: 'box/delete' });
    expect(currentBoxes(s).map((b) => b.id)).toEqual(['default']);
  });

  it('nudges the selected box and stops at the border', () => {
    const s = run(loaded(), { type: 'box/select', id: 'default' }, { type: 'box/nudge', dx: -1000, dy: 5 });
    expect(currentBoxes(s)[0]).toMatchObject({ x: 0, y: 305 });
  });

  it('relabels the selected box when a class is picked', () => {
    const s = run(loaded(), { type: 'class/add', name: 'cat' }, { type: 'box/select', id: 'default' }, { type: 'class/activate', name: 'cat' });
    expect(currentBoxes(s)[0].label).toBe('cat');
  });

  it('cycles the selection', () => {
    let s = run(loaded(), { type: 'box/add', id: 'b1' }, { type: 'box/select', id: null });
    s = reducer(s, { type: 'box/cycle', delta: 1 });
    expect(s.selectedId).toBe('default');
    s = reducer(s, { type: 'box/cycle', delta: 1 });
    expect(s.selectedId).toBe('b1');
    s = reducer(s, { type: 'box/cycle', delta: 1 });
    expect(s.selectedId).toBe('default');
  });

  it('does not record an undo step for a change that changes nothing', () => {
    const s = loaded();
    const same = reducer(s, { type: 'box/change', id: 'default', rect: { x: 400, y: 300, width: 200, height: 200 } });
    expect(same).toBe(s);
  });
});

describe('undo and redo', () => {
  it('walks back and forth through edits, one step per action', () => {
    let s = run(
      loaded(),
      { type: 'box/add', id: 'b1' },
      { type: 'box/change', id: 'b1', rect: { x: 0, y: 0, width: 100, height: 100 } },
    );
    expect(canUndoCurrent(s)).toBe(true);
    s = reducer(s, { type: 'history/undo' });
    expect(currentBoxes(s).find((b) => b.id === 'b1')).toMatchObject({ x: 420, y: 320 });
    s = reducer(s, { type: 'history/undo' });
    expect(currentBoxes(s).map((b) => b.id)).toEqual(['default']);
    expect(s.selectedId).toBeNull(); // b1 no longer exists
    expect(canRedoCurrent(s)).toBe(true);
    s = run(s, { type: 'history/redo' }, { type: 'history/redo' });
    expect(currentBoxes(s).find((b) => b.id === 'b1')).toMatchObject({ x: 0, y: 0 });
  });

  it('keeps a separate history per image', () => {
    const s = run(
      loaded(),
      { type: 'box/add', id: 'b1' },
      { type: 'image/open', key: 'b.png' },
      { type: 'image/loaded', key: 'b.png', size, boxId: 'db' },
    );
    expect(canUndoCurrent(s)).toBe(false);
    const back = run(s, { type: 'image/open', key: 'a.png' }, { type: 'history/undo' });
    expect(currentBoxes(back).map((b) => b.id)).toEqual(['default']);
  });
});

describe('submitting (v1 rules)', () => {
  it('builds the v1 record from the current image', () => {
    const record = buildRecord(loaded(), meta);
    expect(record).toEqual<AnnotationSession>({
      session_id: 'session_1',
      image_url: 'a.png',
      original_size: size,
      display_size: { width: 500, height: 400 },
      scale_factor: 0.5,
      annotator: 'nat',
      timestamp: NOW,
      bounding_boxes: [{ id: 'default', label: DEFAULT_LABEL, x: 400, y: 300, width: 200, height: 200 }],
    });
  });

  it('carries the credit of an online image into the record', () => {
    const credit = { provider: 'Danbooru', artist: 'someone', post_url: 'https://danbooru.donmai.us/posts/1' };
    const key = 'https://cdn.donmai.us/sample/x.jpg';
    const s = run(
      createWorkspace({ records: emptyData(NOW), classes: DEFAULT_CLASSES }),
      { type: 'images/add', items: [{ ...item(key), source: 'online', credit }], open: true },
      { type: 'image/loaded', key, size, boxId: 'd' },
    );
    expect(buildRecord(s, meta)?.credit).toEqual(credit);
    expect(buildRecord(loaded(), meta)).not.toHaveProperty('credit');
  });

  it('refuses to submit an image without boxes', () => {
    expect(buildRecord(run(loaded(), { type: 'box/delete' }), meta)).toBeUndefined();
  });

  it('stores the record, clears the unsaved flag and moves progress', () => {
    const edited = run(loaded(), { type: 'box/add', id: 'b1' });
    expect(hasUnsavedWork(edited)).toBe(true);
    const s = submit(edited);
    expect(hasUnsavedWork(s)).toBe(false);
    expect(s.records).toMatchObject({ total_images: 1, total_annotations: 2 });
    expect(progress(s)).toEqual({ done: 1, total: 3 });
    expect(nextPendingKey(s)).toBe('b.png');
  });

  it('overwrites an earlier record of the same image (v1)', () => {
    const once = submit(loaded());
    const twice = submit(run(once, { type: 'box/add', id: 'b1' }));
    expect(twice.records.annotation_records).toHaveLength(1);
    expect(twice.records.total_annotations).toBe(2);
  });

  it('starts from the first image when none is open yet', () => {
    const s = run(createWorkspace({ records: emptyData(NOW), classes: DEFAULT_CLASSES }), {
      type: 'images/add',
      items: [item('a.png'), item('b.png')],
    });
    expect(nextPendingKey(s)).toBe('a.png');
  });

  it('has no next image when everything is done', () => {
    let s = submit(loaded());
    for (const key of ['b.png', 'c.png']) {
      s = run(s, { type: 'image/open', key }, { type: 'image/loaded', key, size, boxId: `d-${key}` });
      s = submit(s);
    }
    expect(nextPendingKey(s)).toBeUndefined();
  });
});

describe('classes', () => {
  it('always keeps one class', () => {
    const s = reducer(loaded(), { type: 'class/remove', name: DEFAULT_LABEL });
    expect(s.classes).toHaveLength(1);
  });

  it('switches the active class away from a removed one', () => {
    const s = run(loaded(), { type: 'class/add', name: 'cat' }, { type: 'class/remove', name: 'cat' });
    expect(s.activeClass).toBe(DEFAULT_LABEL);
  });

  it('learns labels from imported records', () => {
    const record: AnnotationSession = {
      ...buildRecord(loaded(), meta)!,
      image_url: 'b.png',
      bounding_boxes: [{ id: 'i', label: 'dog', x: 0, y: 0, width: 10, height: 10 }],
    };
    const s = reducer(loaded(), { type: 'records/import', records: [record], now: NOW });
    expect(s.classes.map((c) => c.name)).toEqual([DEFAULT_LABEL, 'dog']);
    expect(progress(s).done).toBe(1);
  });
});

describe('removing images', () => {
  it('opens the neighbour when the current image is removed', () => {
    const s = reducer(loaded(), { type: 'images/remove', key: 'a.png' });
    expect(s.currentKey).toBe('b.png');
    expect(s.drafts['a.png']).toBeUndefined();
  });
});

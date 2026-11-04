import { describe, expect, it } from 'vitest';
import { STORAGE_KEYS } from '@/config';
import v1Export from './__fixtures__/v1-export.json';
import { DEFAULT_CLASSES } from './classes';
import { readRecordList, upsertRecords, emptyData } from './records';
import { clearRecords, type KeyValueStore, loadClasses, loadOnlineSource, loadRecords, loadUserName, saveClasses, saveOnlineSource, saveRecords } from './storage';
import { leaderboard } from './stats';

const NOW = '2026-11-04T00:00:00.000Z';

function memoryStore(initial: Record<string, string> = {}): KeyValueStore & { data: Record<string, string> } {
  const data = { ...initial };
  return {
    data,
    getItem: (k) => (k in data ? data[k] : null),
    setItem: (k, v) => void (data[k] = v),
    removeItem: (k) => void delete data[k],
  };
}

describe('browser storage', () => {
  it('reads data the v1 app saved under its own keys', () => {
    const v1Storage = {
      annotation_records: v1Export.annotation_records,
      total_images: 2,
      total_annotations: 3,
      last_updated: '2025-10-20T08:03:10.502Z',
    };
    const store = memoryStore({ annotation_data: JSON.stringify(v1Storage), userName: 'nat' });
    const data = loadRecords(store, NOW);
    expect(data.annotation_records).toEqual(v1Export.annotation_records);
    expect(data.total_images).toBe(2);
    expect(data.total_annotations).toBe(3);
    expect(loadUserName(store)).toBe('nat');
  });

  it('survives broken or missing data', () => {
    expect(loadRecords(memoryStore({ annotation_data: '{not json' }), NOW)).toEqual(emptyData(NOW));
    expect(loadRecords(undefined, NOW)).toEqual(emptyData(NOW));
    expect(loadClasses(memoryStore({ [STORAGE_KEYS.classes]: '"nope"' }))).toEqual(DEFAULT_CLASSES);
  });

  it('survives storage that throws (private mode, blocked site data)', () => {
    const throwing: KeyValueStore = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
      removeItem: () => {
        throw new Error('blocked');
      },
    };
    expect(loadRecords(throwing, NOW).annotation_records).toEqual([]);
    expect(saveRecords(throwing, emptyData(NOW))).toBe(false);
    expect(loadUserName(throwing)).toBe('');
  });

  it('round-trips records and classes', () => {
    const store = memoryStore();
    const data = upsertRecords(emptyData(NOW), readRecordList(v1Export, NOW)!, NOW);
    saveRecords(store, data);
    expect(loadRecords(store, NOW)).toEqual(data);
    saveClasses(store, [{ name: 'cat', color: '#123456' }]);
    expect(loadClasses(store)).toEqual([{ name: 'cat', color: '#123456' }]);
  });

  it('remembers the online source, defaulting to Danbooru', () => {
    const store = memoryStore({ [STORAGE_KEYS.onlineSource]: 'something-else' });
    expect(loadOnlineSource(store)).toBe('danbooru');
    saveOnlineSource(store, 'nekos');
    expect(loadOnlineSource(store)).toBe('nekos');
    expect(loadOnlineSource(undefined)).toBe('danbooru');
  });

  it('"Clear all data" removes the key like v1 did', () => {
    const store = memoryStore({ annotation_data: '{}' });
    clearRecords(store);
    expect(store.data).not.toHaveProperty('annotation_data');
  });
});

describe('reading record data', () => {
  it('accepts every shape the app has written', () => {
    const records = v1Export.annotation_records;
    expect(readRecordList(v1Export, NOW)).toEqual(records);
    expect(readRecordList({ annotation_data: { annotation_records: records } }, NOW)).toEqual(records);
    expect(readRecordList(records, NOW)).toEqual(records);
    expect(readRecordList({ hello: 'world' }, NOW)).toBeUndefined();
  });

  it('fills in optional fields and drops unusable entries', () => {
    const [record] = readRecordList(
      [
        { image_url: 'x.jpg', original_size: { width: 10, height: 20 }, bounding_boxes: [{ x: 1, y: 2, width: 3, height: 4 }, { x: 'a' }] },
        { image_url: 'no-size.jpg' },
      ],
      NOW,
    )!;
    expect(record).toMatchObject({
      image_url: 'x.jpg',
      display_size: { width: 10, height: 20 },
      scale_factor: 1,
      annotator: 'anonymous',
      timestamp: NOW,
      bounding_boxes: [{ x: 1, y: 2, width: 3, height: 4, label: 'anime_face' }],
    });
    expect(record.bounding_boxes[0].id).toMatch(/^box_\d+_[a-z0-9]+$/);
  });
});

describe('leaderboard (v1 "Rank")', () => {
  it('counts images per annotator, most first', () => {
    const records = readRecordList(v1Export, NOW)!;
    const extra = { ...records[0], image_url: 'z', annotator: 'anonymous' };
    expect(leaderboard([...records, extra])).toEqual([
      { name: 'anonymous', images: 2, boxes: 3 },
      { name: 'nat', images: 1, boxes: 2 },
    ]);
  });
});

import { describe, expect, it } from 'vitest';
import type { AnnotationSession } from '@/types';
import { localItems, onlineItems, SAMPLE_IMAGES } from './sources';

describe('sample set', () => {
  it('ships images keyed by a stable samples/ path', () => {
    expect(SAMPLE_IMAGES.length).toBeGreaterThan(0);
    for (const item of SAMPLE_IMAGES) {
      expect(item.key).toBe(`samples/${item.name}`);
      expect(item.source).toBe('sample');
    }
  });
});

describe('local files', () => {
  it('keeps image files only, sorted like a file browser, keyed by folder path', () => {
    const f = (name: string, type = '') => new File(['x'], name, { type });
    const items = localItems(
      [
        { file: f('img10.jpg', 'image/jpeg'), path: 'trip/img10.jpg' },
        { file: f('notes.txt', 'text/plain'), path: 'trip/notes.txt' },
        { file: f('img2.JPG'), path: 'trip/img2.JPG' },
      ],
      (file) => `blob:${file.name}`,
    );
    expect(items.map((i) => [i.key, i.src])).toEqual([
      ['trip/img2.JPG', 'blob:img2.JPG'],
      ['trip/img10.jpg', 'blob:img10.jpg'],
    ]);
  });
});

describe('imported online images', () => {
  const record = (image_url: string, credit?: AnnotationSession['credit']): AnnotationSession => ({
    session_id: 's',
    image_url,
    original_size: { width: 10, height: 10 },
    display_size: { width: 10, height: 10 },
    scale_factor: 1,
    annotator: 'a',
    timestamp: '2026-11-04T00:00:00.000Z',
    bounding_boxes: [],
    ...(credit && { credit }),
  });

  it('adds URLs that are not listed yet, once, with their credit', () => {
    const credit = { provider: 'Danbooru', artist: 'someone', post_url: 'https://danbooru.donmai.us/posts/1' };
    const items = onlineItems(
      [record('https://a/x.png', credit), record('https://a/x.png'), record('local/y.png'), record('https://a/z.png')],
      new Set(['https://a/z.png']),
    );
    expect(items).toEqual([{ key: 'https://a/x.png', src: 'https://a/x.png', name: 'x.png', source: 'online', credit }]);
  });
});

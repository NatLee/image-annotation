import { describe, expect, it, vi } from 'vitest';
import { RANDOM_SOURCE } from '@/config';
import { fetchRandomImage, localItems, onlineItems, parseRandomResponse, SAMPLE_IMAGES } from './sources';

describe('sample set', () => {
  it('ships images keyed by a stable samples/ path', () => {
    expect(SAMPLE_IMAGES.length).toBeGreaterThan(0);
    for (const item of SAMPLE_IMAGES) {
      expect(item.key).toBe(`samples/${item.name}`);
      expect(item.source).toBe('sample');
    }
  });
});

describe('random online image', () => {
  const reply = {
    results: [
      {
        artist_name: 'someone',
        artist_href: 'https://example.com/artist',
        source_url: 'https://example.com/post/1',
        url: 'https://nekos.best/api/v2/neko/abc.png',
      },
    ],
  };

  it('reads the reply and keeps the credit', () => {
    expect(parseRandomResponse(reply)).toEqual({
      key: 'https://nekos.best/api/v2/neko/abc.png',
      src: 'https://nekos.best/api/v2/neko/abc.png',
      name: 'abc.png',
      source: 'online',
      credit: { name: 'someone', href: 'https://example.com/post/1' },
    });
  });

  it('rejects replies without an https image', () => {
    expect(parseRandomResponse({ results: [{ url: 'http://x/y.png' }] })).toBeUndefined();
    expect(parseRandomResponse(null)).toBeUndefined();
  });

  it('calls the configured endpoint and reports failures', async () => {
    const ok = vi.fn(async () => new Response(JSON.stringify(reply)));
    await expect(fetchRandomImage(ok)).resolves.toMatchObject({ source: 'online' });
    expect(ok).toHaveBeenCalledWith(RANDOM_SOURCE.endpoint, expect.anything());
    const down = vi.fn(async () => new Response('', { status: 503 }));
    await expect(fetchRandomImage(down)).rejects.toThrow('503');
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
  it('adds URLs that are not listed yet, once', () => {
    const items = onlineItems(['https://a/x.png', 'https://a/x.png', 'local/y.png', 'https://a/z.png'], new Set(['https://a/z.png']));
    expect(items).toEqual([{ key: 'https://a/x.png', src: 'https://a/x.png', name: 'x.png', source: 'online' }]);
  });
});

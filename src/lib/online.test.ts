import { describe, expect, it, vi } from 'vitest';
import { DANBOORU, NEKOS_BEST } from '@/config';
import { danbooruSource, danbooruUrl, nekosSource, OnlineSourceError, readDanbooruPosts, readNekosReply } from './online';

/** A Danbooru post as `posts.json` returns it (only the fields the app reads). */
const post = (id: number, over: Record<string, unknown> = {}) => ({
  id,
  rating: 'g',
  file_ext: 'png',
  large_file_url: `https://cdn.donmai.us/sample/aa/bb/sample-${id}.jpg`,
  file_url: `https://cdn.donmai.us/original/aa/bb/${id}.png`,
  tag_string_artist: 'artist_one artist_two',
  source: `https://www.pixiv.net/artworks/${id}`,
  is_deleted: false,
  is_banned: false,
  is_flagged: false,
  is_pending: false,
  ...over,
});

const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

describe('Danbooru posts', () => {
  it('turns a general post into a credited list item, using the web-sized sample', () => {
    expect(readDanbooruPosts([post(42)])).toEqual([
      {
        key: 'https://cdn.donmai.us/sample/aa/bb/sample-42.jpg',
        src: 'https://cdn.donmai.us/sample/aa/bb/sample-42.jpg',
        name: 'danbooru-42.jpg',
        source: 'online',
        credit: {
          provider: 'Danbooru',
          artist: 'artist_one, artist_two',
          post_url: 'https://danbooru.donmai.us/posts/42',
          source_url: 'https://www.pixiv.net/artworks/42',
        },
      },
    ]);
  });

  it('keeps general-rated posts only, whatever the server sent', () => {
    const posts = ['g', 's', 'q', 'e', undefined, 'G'].map((rating, i) => post(i + 1, { rating }));
    expect(readDanbooruPosts(posts).map((i) => i.name)).toEqual(['danbooru-1.jpg']);
  });

  it('skips deleted, banned, flagged and pending posts, videos and posts without a file', () => {
    const posts = [
      post(1, { is_deleted: true }),
      post(2, { is_banned: true }),
      post(3, { is_flagged: true }),
      post(4, { is_pending: true }),
      post(5, { file_ext: 'mp4', large_file_url: 'https://cdn.donmai.us/sample/x.webm' }),
      post(6, { file_ext: 'zip' }),
      post(7, { large_file_url: null, file_url: null }),
      post(8, { large_file_url: 'http://insecure.example/8.jpg', file_url: null }),
      post(9, { large_file_url: null }), // falls back to the original file
    ];
    expect(readDanbooruPosts(posts).map((i) => i.src)).toEqual(['https://cdn.donmai.us/original/aa/bb/9.png']);
  });

  it('leaves out missing artist and non-link sources', () => {
    const [item] = readDanbooruPosts([post(5, { tag_string_artist: '', source: 'scanned from a magazine' })]);
    expect(item.credit).toEqual({ provider: 'Danbooru', post_url: 'https://danbooru.donmai.us/posts/5' });
  });

  it('never builds a request without rating:g', () => {
    for (const before of [undefined, 1234567]) {
      const url = new URL(danbooruUrl(before));
      expect(url.origin + url.pathname).toBe(DANBOORU.endpoint);
      expect(url.searchParams.get('tags')).toBe('rating:g');
      expect(url.searchParams.get('limit')).toBe(String(DANBOORU.batchSize));
    }
    expect(new URL(danbooruUrl(undefined)).searchParams.get('page')).toBe('1');
    expect(new URL(danbooruUrl(1234567)).searchParams.get('page')).toBe('b1234567');
  });
});

describe('Danbooru source', () => {
  it('asks once per batch and serves the rest from memory', async () => {
    const fetch = vi.fn(async (_url: unknown) => reply([post(3_000_003), post(3_000_002), post(3_000_001)]));
    const source = danbooruSource(() => 0.5);
    const names = [await source.next(fetch), await source.next(fetch), await source.next(fetch)].map((i) => i.name);
    expect(new Set(names).size).toBe(3);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(new URL(String(fetch.mock.calls[0][0])).searchParams.get('page')).toBe('1');
  });

  it('takes later batches from a random point in history, before the newest id it has seen', async () => {
    let id = 3_000_000;
    const fetch = vi.fn(async (_url: unknown) => reply([post(id--)]));
    const source = danbooruSource(() => 0.5);
    await source.next(fetch);
    await source.next(fetch);
    const page = new URL(String(fetch.mock.calls[1][0])).searchParams.get('page');
    // halfway between oldestPostId (1,000,000) and the newest id seen (3,000,000)
    expect(page).toBe('b2000000');
  });

  it('does not show the same picture twice in a session', async () => {
    const fetch = vi.fn(async () => reply([post(10)]));
    const source = danbooruSource(() => 0);
    await source.next(fetch);
    await expect(source.next(fetch)).rejects.toThrow(/no general-audience pictures/);
  });

  it('explains rate limits, errors, timeouts and network failures', async () => {
    await expect(danbooruSource().next(async () => reply({}, 429))).rejects.toThrow('limiting requests');
    await expect(danbooruSource().next(async () => reply({}, 503))).rejects.toThrow('(503)');
    await expect(danbooruSource().next(async () => new Response('<html>'))).rejects.toThrow('not JSON');
    await expect(
      danbooruSource().next(async () => {
        throw new DOMException('timed out', 'TimeoutError');
      }),
    ).rejects.toThrow('did not answer');
    const failure = danbooruSource().next(async () => {
      throw new TypeError('Failed to fetch');
    });
    await expect(failure).rejects.toBeInstanceOf(OnlineSourceError);
    await expect(failure).rejects.toThrow('Could not reach Danbooru');
  });

  it('sends a JSON Accept header and a timeout', async () => {
    const fetch = vi.fn(async (_url: unknown, _init?: RequestInit) => reply([post(1)]));
    await danbooruSource().next(fetch as typeof globalThis.fetch);
    const init = fetch.mock.calls[0][1]!;
    expect(new Headers(init.headers).get('Accept')).toBe('application/json');
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });
});

describe('nekos.best', () => {
  const nekos = {
    results: [{ artist_name: 'someone', artist_href: 'https://example.com/artist', source_url: 'https://example.com/post/1', url: 'https://nekos.best/api/v2/neko/abc.png' }],
  };

  it('reads the reply and keeps the credit', () => {
    expect(readNekosReply(nekos)).toEqual({
      key: 'https://nekos.best/api/v2/neko/abc.png',
      src: 'https://nekos.best/api/v2/neko/abc.png',
      name: 'abc.png',
      source: 'online',
      credit: { provider: 'nekos.best', artist: 'someone', source_url: 'https://example.com/post/1' },
    });
  });

  it('rejects replies without an https image', () => {
    expect(readNekosReply({ results: [{ url: 'http://x/y.png' }] })).toBeUndefined();
    expect(readNekosReply(null)).toBeUndefined();
  });

  it('calls its endpoint', async () => {
    const fetch = vi.fn(async () => reply(nekos));
    await expect(nekosSource().next(fetch)).resolves.toMatchObject({ source: 'online' });
    expect(fetch).toHaveBeenCalledWith(NEKOS_BEST.endpoint, expect.anything());
  });
});

describe('error messages', () => {
  it('are full sentences, so the app can append its own advice', async () => {
    const failures = [
      async () => reply({}, 429),
      async () => reply({}, 500),
      async () => new Response('<html>'),
      async () => {
        throw new TypeError('Failed to fetch');
      },
      async () => {
        throw new DOMException('timed out', 'TimeoutError');
      },
    ];
    for (const fail of failures) {
      const error = (await danbooruSource().next(fail).catch((e: Error) => e)) as Error;
      expect(error.message).toMatch(/[.!?]$/);
    }
    const nekos = (await nekosSource().next(async () => reply({ results: [] })).catch((e: Error) => e)) as Error;
    expect(nekos.message).toMatch(/[.!?]$/);
  });
});

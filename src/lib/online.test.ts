import { describe, expect, it, vi } from 'vitest';
import { DANBOORU, NEKOS_BEST } from '@/config';
import { createOnlineSources, danbooruSource, danbooruUrl, nekosSource, OnlineSourceError, readDanbooruPosts, readNekosReply } from './online';

/** A Danbooru post as `posts/random.json` returns it (only the fields the app reads). */
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

/** Runs `next()` and returns the error it throws. */
async function failure(promise: Promise<unknown>): Promise<OnlineSourceError> {
  const error = await promise.then(
    () => undefined,
    (e: unknown) => e,
  );
  expect(error).toBeInstanceOf(OnlineSourceError);
  return error as OnlineSourceError;
}

describe('Danbooru posts', () => {
  it('turns a general post into a credited list item, using the web-sized sample', () => {
    expect(readDanbooruPosts(post(42))).toEqual([
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
    const [item] = readDanbooruPosts(post(5, { tag_string_artist: '', source: 'scanned from a magazine' }));
    expect(item.credit).toEqual({ provider: 'Danbooru', post_url: 'https://danbooru.donmai.us/posts/5' });
  });

  it('asks for one random general-rated post, exactly like the request a browser succeeded with', () => {
    expect(danbooruUrl()).toBe('https://danbooru.donmai.us/posts/random.json?tags=rating%3Ag');
    expect(danbooruUrl().startsWith(DANBOORU.randomEndpoint)).toBe(true);
  });
});

describe('Danbooru source', () => {
  it('makes one plain request per picture: no custom headers, so no CORS preflight', async () => {
    const fetch = vi.fn(async (_url: unknown, _init?: RequestInit) => reply(post(7)));
    const item = await danbooruSource().next(fetch as typeof globalThis.fetch);
    expect(item.name).toBe('danbooru-7.jpg');
    expect(fetch).toHaveBeenCalledTimes(1);
    const init = fetch.mock.calls[0][1]!;
    expect(init.headers).toBeUndefined();
    expect(init.method).toBeUndefined();
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it('asks again when the random post is not usable, at most three times', async () => {
    const replies = [post(1, { rating: 'e' }), post(2, { file_ext: 'mp4' }), post(3)];
    const fetch = vi.fn(async () => reply(replies.shift()));
    await expect(danbooruSource().next(fetch)).resolves.toMatchObject({ name: 'danbooru-3.jpg' });
    expect(fetch).toHaveBeenCalledTimes(3);

    const never = vi.fn(async () => reply(post(9, { rating: 's' })));
    const error = await failure(danbooruSource().next(never));
    expect(error.code).toBe('danbooru/no-image');
    expect(never).toHaveBeenCalledTimes(DANBOORU.attempts);
  });

  it('gives every failure a short report code', async () => {
    const cases: [() => Promise<Response>, string][] = [
      [async () => reply({}, 429), 'danbooru/http-429'],
      [async () => new Response('<h1>Danbooru is down for maintenance.</h1>', { status: 503 }), 'danbooru/http-503'],
      [async () => new Response('<html>'), 'danbooru/not-json'],
      [
        async () => {
          throw new DOMException('timed out', 'TimeoutError');
        },
        'danbooru/timeout',
      ],
      [
        async () => {
          throw new TypeError('Failed to fetch');
        },
        'danbooru/network',
      ],
    ];
    for (const [fetch, code] of cases) {
      const error = await failure(danbooruSource().next(fetch));
      expect(error.code).toBe(code);
      expect(error.message).toMatch(/[.!?]$/); // the app adds the code and its own advice after it
    }
  });

  it('says so when the browser is offline', async () => {
    vi.stubGlobal('navigator', { onLine: false });
    try {
      const error = await failure(
        danbooruSource().next(async () => {
          throw new TypeError('Failed to fetch');
        }),
      );
      expect(error.code).toBe('danbooru/offline');
    } finally {
      vi.unstubAllGlobals();
    }
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

  it('calls its endpoint with a plain request', async () => {
    const fetch = vi.fn(async (_url: unknown, _init?: RequestInit) => reply(nekos));
    await expect(nekosSource().next(fetch as typeof globalThis.fetch)).resolves.toMatchObject({ source: 'online' });
    expect(fetch.mock.calls[0][0]).toBe(NEKOS_BEST.endpoint);
    expect(fetch.mock.calls[0][1]!.headers).toBeUndefined();
  });

  it('reports an empty reply with a code', async () => {
    const error = await failure(nekosSource().next(async () => reply({ results: [] })));
    expect(error.code).toBe('nekos/no-image');
  });
});

describe('source list', () => {
  it('puts the default (nekos.best) first and keeps Danbooru selectable', () => {
    expect(Object.keys(createOnlineSources())).toEqual(['nekos', 'danbooru']);
  });
});

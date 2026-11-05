import { DANBOORU, NEKOS_BEST, ONLINE_TIMEOUT_MS, type OnlineSourceId } from '@/config';
import { baseName, extensionOf } from '@/lib/paths';
import type { ImageCredit, ImageItem } from '@/types';

/** Online sources of random anime images. Each call is one picture and, normally, one request. */

export interface OnlineSource {
  id: OnlineSourceId;
  name: string;
  homepage: string;
  next(fetchImpl?: typeof fetch): Promise<ImageItem>;
}

/**
 * A failure worth showing as is. `code` is short and stable (`danbooru/http-503`)
 * so people can report it; `message` is a full sentence.
 */
export class OnlineSourceError extends Error {
  constructor(
    message: string,
    readonly code: string,
  ) {
    super(message);
  }
}

const httpsUrl = (v: unknown) => (typeof v === 'string' && /^https:\/\//i.test(v) ? v : undefined);
const linkUrl = (v: unknown) => (typeof v === 'string' && /^https?:\/\//i.test(v) ? v : undefined);
const isOffline = () => typeof navigator !== 'undefined' && navigator.onLine === false;

/**
 * One plain GET (no custom headers, so the browser never needs a CORS
 * preflight), with a timeout, turning every failure into a coded message.
 */
async function getJson(source: OnlineSourceId, name: string, url: string, fetchImpl: typeof fetch): Promise<unknown> {
  let response: Response;
  try {
    response = await fetchImpl(url, { signal: AbortSignal.timeout(ONLINE_TIMEOUT_MS) });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'TimeoutError') {
      throw new OnlineSourceError(`${name} did not answer within ${ONLINE_TIMEOUT_MS / 1000} seconds.`, `${source}/timeout`);
    }
    if (isOffline()) throw new OnlineSourceError('This browser is offline.', `${source}/offline`);
    // Browsers hide why a cross-origin request failed: a maintenance or bot-check page
    // without CORS headers looks the same as a blocked or unreachable server.
    throw new OnlineSourceError(
      `${name} gave no answer the browser may read. It may be down for maintenance, or something on the network is blocking it.`,
      `${source}/network`,
    );
  }
  if (response.status === 429) {
    throw new OnlineSourceError(`${name} is limiting requests right now. Wait a minute and try again.`, `${source}/http-429`);
  }
  if (!response.ok) throw new OnlineSourceError(`${name} answered with an error.`, `${source}/http-${response.status}`);
  try {
    return await response.json();
  } catch {
    throw new OnlineSourceError(`${name} sent something that is not JSON.`, `${source}/not-json`);
  }
}

/* ------------------------------------------------------------------------ */
/* Danbooru                                                                 */
/* ------------------------------------------------------------------------ */

const IMAGE_EXTENSIONS: readonly string[] = DANBOORU.imageExtensions;

/**
 * Usable posts from a Danbooru reply (one post or a list): general rating only
 * (checked here again, whatever the query said), not deleted, banned, flagged
 * or pending, and a still image the browser can show.
 */
export function readDanbooruPosts(json: unknown): ImageItem[] {
  const posts = Array.isArray(json) ? json : [json];
  return posts.flatMap((post): ImageItem[] => {
    if (typeof post !== 'object' || post === null || post.rating !== DANBOORU.rating) return [];
    if (post.is_deleted || post.is_banned || post.is_flagged || post.is_pending) return [];
    if (typeof post.id !== 'number' || !IMAGE_EXTENSIONS.includes(String(post.file_ext).toLowerCase())) return [];
    // The "large" file is Danbooru's web-sized sample: plenty for boxing, light on their bandwidth.
    const src = httpsUrl(post.large_file_url) ?? httpsUrl(post.file_url);
    const extension = src ? extensionOf(baseName(src)) : '';
    if (!src || !IMAGE_EXTENSIONS.includes(extension)) return [];
    const artist = typeof post.tag_string_artist === 'string' ? post.tag_string_artist.split(/\s+/).filter(Boolean).join(', ') : '';
    const source = linkUrl(post.source);
    const credit: ImageCredit = {
      provider: DANBOORU.name,
      ...(artist && { artist }),
      post_url: `${DANBOORU.postUrl}${post.id}`,
      ...(source && { source_url: source }),
    };
    return [{ key: src, src, name: `danbooru-${post.id}.${extension}`, source: 'online', credit }];
  });
}

/** The exact request a normal browser was seen to succeed with: one random general-rated post. */
export const danbooruUrl = () => `${DANBOORU.randomEndpoint}?${new URLSearchParams({ tags: DANBOORU.tags })}`;

export function danbooruSource(): OnlineSource {
  return {
    id: 'danbooru',
    name: DANBOORU.name,
    homepage: DANBOORU.homepage,
    async next(fetchImpl = fetch) {
      // A random post can be a video or a deleted post; try a couple more, then give up.
      for (let attempt = 0; attempt < DANBOORU.attempts; attempt++) {
        const [item] = readDanbooruPosts(await getJson('danbooru', DANBOORU.name, danbooruUrl(), fetchImpl));
        if (item) return item;
      }
      throw new OnlineSourceError(`${DANBOORU.name} kept picking posts that are not still images. Try again.`, 'danbooru/no-image');
    },
  };
}

/* ------------------------------------------------------------------------ */
/* nekos.best                                                               */
/* ------------------------------------------------------------------------ */

interface NekosReply {
  results?: { url?: unknown; artist_name?: unknown; artist_href?: unknown; source_url?: unknown }[];
}

/** Reads `{ results: [{ url, artist_name, artist_href, source_url }] }`. */
export function readNekosReply(json: unknown): ImageItem | undefined {
  const first = (json as NekosReply | null)?.results?.[0];
  const src = httpsUrl(first?.url);
  if (!first || !src) return undefined;
  const artist = typeof first.artist_name === 'string' ? first.artist_name : '';
  const source = linkUrl(first.source_url) ?? linkUrl(first.artist_href);
  const credit: ImageCredit = { provider: NEKOS_BEST.name, ...(artist && { artist }), ...(source && { source_url: source }) };
  return { key: src, src, name: baseName(src), source: 'online', credit };
}

export function nekosSource(): OnlineSource {
  return {
    id: 'nekos',
    name: NEKOS_BEST.name,
    homepage: NEKOS_BEST.homepage,
    async next(fetchImpl = fetch) {
      const item = readNekosReply(await getJson('nekos', NEKOS_BEST.name, NEKOS_BEST.endpoint, fetchImpl));
      if (!item) throw new OnlineSourceError(`${NEKOS_BEST.name} sent no image.`, 'nekos/no-image');
      return item;
    },
  };
}

/** One instance per page load, in menu order (the default first). */
export const createOnlineSources = (): Record<OnlineSourceId, OnlineSource> => ({
  nekos: nekosSource(),
  danbooru: danbooruSource(),
});

export const isOnlineSourceId = (v: unknown): v is OnlineSourceId => v === 'danbooru' || v === 'nekos';

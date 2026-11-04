import { DANBOORU, NEKOS_BEST, ONLINE_TIMEOUT_MS, type OnlineSourceId } from '@/config';
import { baseName, extensionOf } from '@/lib/paths';
import type { ImageCredit, ImageItem } from '@/types';

/**
 * Online sources of random anime images. Each source hands out one image per
 * call; Danbooru answers a batch per request and the rest wait in memory, so
 * most images cost no API call at all.
 */

export interface OnlineSource {
  id: OnlineSourceId;
  name: string;
  homepage: string;
  next(fetchImpl?: typeof fetch): Promise<ImageItem>;
}

/** A failure worth showing to the user as is. */
export class OnlineSourceError extends Error {}

const httpsUrl = (v: unknown) => (typeof v === 'string' && /^https:\/\//i.test(v) ? v : undefined);
const linkUrl = (v: unknown) => (typeof v === 'string' && /^https?:\/\//i.test(v) ? v : undefined);

/** One GET with a timeout, turning network and HTTP problems into plain messages. */
async function getJson(source: string, url: string, fetchImpl: typeof fetch): Promise<unknown> {
  let response: Response;
  try {
    response = await fetchImpl(url, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(ONLINE_TIMEOUT_MS) });
  } catch (error) {
    const timedOut = error instanceof DOMException && error.name === 'TimeoutError';
    throw new OnlineSourceError(timedOut ? `${source} did not answer within ${ONLINE_TIMEOUT_MS / 1000} seconds` : `Could not reach ${source}`);
  }
  if (response.status === 429) throw new OnlineSourceError(`${source} is limiting requests right now. Wait a minute and try again.`);
  if (!response.ok) throw new OnlineSourceError(`${source} answered with an error (${response.status})`);
  try {
    return await response.json();
  } catch {
    throw new OnlineSourceError(`${source} sent something that is not JSON`);
  }
}

function shuffle<T>(items: T[], random: () => number): T[] {
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
}

/* ------------------------------------------------------------------------ */
/* Danbooru                                                                 */
/* ------------------------------------------------------------------------ */

const IMAGE_EXTENSIONS: readonly string[] = DANBOORU.imageExtensions;

/**
 * Usable posts from a `posts.json` reply: general rating only (checked here
 * again, whatever the query said), not deleted, banned, flagged or pending,
 * and a still image the browser can show.
 */
export function readDanbooruPosts(json: unknown): ImageItem[] {
  if (!Array.isArray(json)) return [];
  return json.flatMap((post): ImageItem[] => {
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

/** Builds the `posts.json` URL for one batch. `before` is a post id, or undefined for the newest posts. */
export function danbooruUrl(before: number | undefined): string {
  const params = new URLSearchParams({ tags: DANBOORU.tags, limit: String(DANBOORU.batchSize), page: before ? `b${before}` : '1' });
  return `${DANBOORU.endpoint}?${params}`;
}

export function danbooruSource(random: () => number = Math.random): OnlineSource {
  const queue: ImageItem[] = [];
  const shown = new Set<string>();
  let newestId = 0;

  // The first batch is the newest posts, which also tells us the newest id. After that,
  // each batch starts before a random id: Danbooru stops anonymous paging at page 1000.
  const nextBefore = () =>
    newestId > DANBOORU.oldestPostId ? Math.floor(DANBOORU.oldestPostId + random() * (newestId - DANBOORU.oldestPostId)) : undefined;

  return {
    id: 'danbooru',
    name: DANBOORU.name,
    homepage: DANBOORU.homepage,
    async next(fetchImpl = fetch) {
      if (!queue.length) {
        const json = await getJson(DANBOORU.name, danbooruUrl(nextBefore()), fetchImpl);
        if (Array.isArray(json)) {
          for (const post of json) if (typeof post?.id === 'number') newestId = Math.max(newestId, post.id);
        }
        queue.push(...shuffle(readDanbooruPosts(json).filter((item) => !shown.has(item.key)), random));
      }
      const item = queue.shift();
      if (!item) throw new OnlineSourceError(`${DANBOORU.name} had no general-audience pictures in that batch. Try again.`);
      shown.add(item.key);
      return item;
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
      const item = readNekosReply(await getJson(NEKOS_BEST.name, NEKOS_BEST.endpoint, fetchImpl));
      if (!item) throw new OnlineSourceError(`${NEKOS_BEST.name} sent no image`);
      return item;
    },
  };
}

/** One instance per page load, so Danbooru's batch cache lasts the session. */
export const createOnlineSources = (): Record<OnlineSourceId, OnlineSource> => ({
  danbooru: danbooruSource(),
  nekos: nekosSource(),
});

export const isOnlineSourceId = (v: unknown): v is OnlineSourceId => v === 'danbooru' || v === 'nekos';

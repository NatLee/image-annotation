import { RANDOM_SOURCE } from '@/config';
import { baseName, isImageFile, isRemote } from '@/lib/paths';
import type { ImageItem } from '@/types';

/** Where images come from: the bundled samples, the random online source and local files. */

/** Every image in `src/assets/samples`, keyed `samples/<file>` so records survive rebuilds. */
const sampleUrls = import.meta.glob<string>('../assets/samples/*.{png,jpg,jpeg,webp}', {
  eager: true,
  query: '?url',
  import: 'default',
});

export const SAMPLE_IMAGES: readonly ImageItem[] = Object.entries(sampleUrls)
  .sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }))
  .map(([path, src]) => {
    const name = baseName(path);
    return { key: `samples/${name}`, src, name, source: 'sample' };
  });

/* ------------------------------------------------------------------------ */
/* Random online image                                                      */
/* ------------------------------------------------------------------------ */

interface RandomResponse {
  results?: { url?: unknown; artist_name?: unknown; artist_href?: unknown; source_url?: unknown }[];
}

/** Reads the source's reply (`{ results: [{ url, artist_name, … }] }`). */
export function parseRandomResponse(json: unknown): ImageItem | undefined {
  const first = (json as RandomResponse | null)?.results?.[0];
  if (typeof first?.url !== 'string' || !/^https:\/\//.test(first.url)) return undefined;
  const artist = typeof first.artist_name === 'string' ? first.artist_name : undefined;
  const href = [first.source_url, first.artist_href].find((h): h is string => typeof h === 'string' && /^https:\/\//.test(h));
  return {
    key: first.url,
    src: first.url,
    name: baseName(first.url),
    source: 'online',
    credit: artist ? { name: artist, href } : undefined,
  };
}

export async function fetchRandomImage(fetchImpl: typeof fetch = fetch): Promise<ImageItem> {
  const response = await fetchImpl(RANDOM_SOURCE.endpoint, { headers: { Accept: 'application/json' } });
  if (!response.ok) throw new Error(`${RANDOM_SOURCE.name} answered ${response.status}`);
  const item = parseRandomResponse(await response.json());
  if (!item) throw new Error(`${RANDOM_SOURCE.name} sent no image`);
  return item;
}

/* ------------------------------------------------------------------------ */
/* Local files                                                              */
/* ------------------------------------------------------------------------ */

export interface PickedFile {
  file: File;
  /** Path inside the picked or dropped folder, or just the file name. */
  path: string;
}

/** Image files become list items, sorted the way a file browser sorts them. */
export function localItems(files: readonly PickedFile[], makeUrl: (file: File) => string): ImageItem[] {
  return files
    .filter(({ file, path }) => isImageFile(path, file.type))
    .sort((a, b) => a.path.localeCompare(b.path, undefined, { numeric: true }))
    .map(({ file, path }) => ({ key: path, src: makeUrl(file), name: baseName(path), source: 'local' }));
}

/** List items for imported records that point at online images not in the list yet. */
export function onlineItems(keys: readonly string[], known: ReadonlySet<string>): ImageItem[] {
  return [...new Set(keys)]
    .filter((key) => isRemote(key) && !known.has(key))
    .map((key) => ({ key, src: key, name: baseName(key), source: 'online' }));
}

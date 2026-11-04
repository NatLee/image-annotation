import { baseName, isImageFile, isRemote } from '@/lib/paths';
import type { AnnotationSession, ImageItem } from '@/types';

/** Bundled samples, local files, and list items for imported online images. (Random online images: online.ts.) */

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

/** List items for imported records that point at online images not in the list yet, with their credit. */
export function onlineItems(records: readonly AnnotationSession[], known: ReadonlySet<string>): ImageItem[] {
  const items = new Map<string, ImageItem>();
  for (const { image_url: key, credit } of records) {
    if (!isRemote(key) || known.has(key) || items.has(key)) continue;
    items.set(key, { key, src: key, name: baseName(key), source: 'online', ...(credit && { credit }) });
  }
  return [...items.values()];
}

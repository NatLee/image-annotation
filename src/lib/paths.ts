/**
 * Helpers for the strings that identify images: remote URLs, app-relative
 * paths (`samples/…`) and local files' relative paths (`holiday/img_01.jpg`).
 */

const IMAGE_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'avif', 'svg']);

export const isRemote = (key: string) => /^(https?:)?\/\//i.test(key);

/** Forward slashes, no leading `./` or `/`, no query string on URLs. */
function cleanPath(key: string): string {
  if (isRemote(key)) {
    try {
      return decodeURIComponent(new URL(key, 'https://x.invalid').pathname);
    } catch {
      return key;
    }
  }
  return key.replace(/\\/g, '/').replace(/^(\.\/)+/, '').replace(/^\/+/, '');
}

export const baseName = (key: string) => cleanPath(key).split('/').filter(Boolean).at(-1) ?? key;

export const extensionOf = (name: string) => {
  const match = /\.([a-z0-9]+)$/i.exec(name);
  return match ? match[1].toLowerCase() : '';
};

export const stripExtension = (name: string) => name.replace(/\.[a-z0-9]+$/i, '');

export const dirName = (key: string) => cleanPath(key).split('/').slice(0, -1).join('/');

/** The name an image gets inside an export: URL → file name, path → relative path. */
export const exportFileName = (key: string) => (isRemote(key) ? baseName(key) : cleanPath(key));

export const isImageFile = (name: string, mime = '') =>
  mime.startsWith('image/') || IMAGE_EXTENSIONS.has(extensionOf(name));

/**
 * Per-image annotation file paths (YOLO `labels/x.txt`, VOC `Annotations/x.xml`).
 * Two images with the same name get `_2`, `_3`… so nothing is overwritten.
 */
export function annotationPaths(keys: readonly string[], folder: string, extension: string): Map<string, string> {
  const used = new Set<string>();
  const result = new Map<string, string>();
  for (const key of keys) {
    const stem = stripExtension(exportFileName(key));
    let path = `${folder}/${stem}.${extension}`;
    for (let n = 2; used.has(path); n++) path = `${folder}/${stem}_${n}.${extension}`;
    used.add(path);
    result.set(key, path);
  }
  return result;
}

/**
 * Find which known image an imported reference points at. Tries an exact match,
 * then a matching path tail (`C:\data\cats\a.jpg` → `cats/a.jpg`), then a
 * unique file name. With `ignoreExtension`, `labels/a.txt`-style stems match `a.jpg`.
 */
export function findImageKey(
  reference: string,
  keys: readonly string[],
  { ignoreExtension = false }: { ignoreExtension?: boolean } = {},
): string | undefined {
  const norm = (s: string) => {
    const path = exportFileName(s).toLowerCase();
    return ignoreExtension ? stripExtension(path) : path;
  };
  const ref = norm(reference);
  if (!ref) return undefined;
  const candidates = keys.map((key) => ({ key, path: norm(key) }));

  const exact = candidates.find((c) => c.path === ref);
  if (exact) return exact.key;

  const tail = candidates.filter((c) => c.path.endsWith(`/${ref}`) || ref.endsWith(`/${c.path}`));
  if (tail.length === 1) return tail[0].key;

  const name = ref.split('/').at(-1);
  const sameName = candidates.filter((c) => c.path.split('/').at(-1) === name);
  return sameName.length === 1 ? sameName[0].key : undefined;
}

import type { ExportFile } from '@/lib/formats';
import type { PickedFile } from '@/lib/sources';
import type { Size } from '@/types';

/** Thin wrappers around browser APIs, kept apart from the pure logic. */

export function downloadFile({ fileName, mime, bytes }: ExportFile) {
  const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: mime }));
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

export function loadImageSize(src: string): Promise<Size> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => reject(new Error(`Could not load ${src}`));
    img.src = src;
  });
}

export const readBytes = async (file: File) => new Uint8Array(await file.arrayBuffer());

/** Files from an `<input type="file">`, keeping folder paths when a folder was picked. */
export const pickedFromInput = (list: FileList | null): PickedFile[] =>
  [...(list ?? [])].map((file) => ({ file, path: file.webkitRelativePath || file.name }));

async function walk(entry: FileSystemEntry, out: PickedFile[]): Promise<void> {
  if (entry.isFile) {
    const file = await new Promise<File>((resolve, reject) => (entry as FileSystemFileEntry).file(resolve, reject));
    out.push({ file, path: entry.fullPath.replace(/^\/+/, '') });
  } else if (entry.isDirectory) {
    const reader = (entry as FileSystemDirectoryEntry).createReader();
    // readEntries hands out folders in batches; an empty batch means done.
    for (;;) {
      const batch = await new Promise<FileSystemEntry[]>((resolve, reject) => reader.readEntries(resolve, reject));
      if (!batch.length) break;
      for (const child of batch) await walk(child, out);
    }
  }
}

/** Files and whole folders dropped on the page. Call it synchronously inside the drop handler. */
export function pickedFromDrop(data: DataTransfer): Promise<PickedFile[]> {
  // The entries must be taken before the event handler returns.
  const entries = [...data.items].map((item) => item.webkitGetAsEntry?.()).filter((e): e is FileSystemEntry => !!e);
  if (!entries.length) return Promise.resolve(pickedFromInput(data.files));
  return (async () => {
    const out: PickedFile[] = [];
    for (const entry of entries) await walk(entry, out);
    return out;
  })();
}

export const isEditableTarget = (target: EventTarget | null) =>
  target instanceof HTMLElement && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName));

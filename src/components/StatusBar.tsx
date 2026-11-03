import { RANDOM_SOURCE } from '@/config';
import { displaySize } from '@/lib/geometry';
import type { ImageItem } from '@/types';
import type { ViewInfo } from './Stage';

/** v1's "Original | Display | Scale" line, plus the zoom and who drew the image. */
export function StatusBar({ item, view }: { item: ImageItem | undefined; view: ViewInfo | undefined }) {
  const size = item?.size;
  const shown = size && view ? displaySize(size, view.fitScale) : undefined;
  const cell = 'flex items-center gap-1.5 whitespace-nowrap';
  const value = 'font-mono text-ink-200';
  return (
    <footer className="flex h-8 shrink-0 items-center gap-5 overflow-x-auto border-t border-ink-800 bg-ink-900 px-4 text-[11px] text-ink-500" data-testid="status-bar">
      <span className="min-w-0 truncate text-ink-300" title={item?.key}>
        {item?.name ?? 'No image'}
      </span>
      {size && (
        <span className={cell}>
          Original <span className={value}>{size.width}×{size.height}</span>
        </span>
      )}
      {shown && view && (
        <>
          <span className={cell}>
            Display <span className={value}>{shown.width}×{shown.height}</span>
          </span>
          <span className={cell}>
            Scale <span className={value}>{(view.fitScale * 100).toFixed(2)}%</span>
          </span>
          <span className={cell}>
            Zoom <span className={value}>{Math.round(view.scale * 100)}%</span>
          </span>
        </>
      )}
      {item?.credit && (
        <span className={`${cell} ml-auto`}>
          Art by{' '}
          {item.credit.href ? (
            <a href={item.credit.href} target="_blank" rel="noreferrer" className="text-ink-300 underline decoration-ink-600 underline-offset-2 hover:text-ink-100">
              {item.credit.name}
            </a>
          ) : (
            <span className="text-ink-300">{item.credit.name}</span>
          )}{' '}
          via {RANDOM_SOURCE.name}
        </span>
      )}
    </footer>
  );
}

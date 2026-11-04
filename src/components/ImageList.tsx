import { CircleAlert, CircleCheck, FolderOpen, ImagePlus, Shuffle, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { OnlineSourceId } from '@/config';
import { hint } from '@/shortcuts';
import type { ImageItem, ImageSource } from '@/types';
import { IconButton } from './ui';
import { cx } from '@/lib/cx';

export type ImageStatus = 'done' | 'edited' | 'draft' | 'new' | 'failed';

interface ImageListProps {
  images: ImageItem[];
  currentKey: string | null;
  statusOf: (item: ImageItem) => ImageStatus;
  boxCountOf: (item: ImageItem) => number;
  busy: boolean;
  onlineSource: OnlineSourceId;
  onlineSources: { id: OnlineSourceId; name: string }[];
  onOnlineSource: (id: OnlineSourceId) => void;
  onOpen: (key: string) => void;
  onRemove: (key: string) => void;
  onOpenFiles: () => void;
  onOpenFolder: () => void;
  onRandom: () => void;
}

type Filter = 'all' | 'todo' | 'done';

const SOURCE_LABEL: Record<ImageSource, string> = { sample: 'Sample', online: 'Online', local: 'Local' };

const STATUS: Record<ImageStatus, { label: string; className: string }> = {
  done: { label: 'Submitted', className: 'text-accent' },
  edited: { label: 'Submitted, changed since', className: 'text-warn' },
  draft: { label: 'Not submitted yet', className: 'text-warn' },
  new: { label: 'Not started', className: 'text-ink-600' },
  failed: { label: 'Could not load', className: 'text-danger' },
};

function StatusIcon({ status }: { status: ImageStatus }) {
  const { label, className } = STATUS[status];
  if (status === 'done') return <CircleCheck size={16} className={className} aria-label={label} />;
  if (status === 'failed') return <CircleAlert size={16} className={className} aria-label={label} />;
  return (
    <span role="img" aria-label={label} className={cx('grid size-4 place-items-center', className)}>
      <span className={cx('size-2 rounded-full', status === 'new' ? 'border border-current' : 'bg-current')} />
    </span>
  );
}

export function ImageList(props: ImageListProps) {
  const { images, currentKey, statusOf, boxCountOf, busy, onlineSource, onlineSources, onOnlineSource, onOpen, onRemove, onOpenFiles, onOpenFolder, onRandom } = props;
  const sourceName = onlineSources.find((s) => s.id === onlineSource)?.name ?? onlineSource;
  const [filter, setFilter] = useState<Filter>('all');
  const listRef = useRef<HTMLOListElement>(null);

  const rows = useMemo(() => images.map((item) => ({ item, status: statusOf(item) })), [images, statusOf]);
  const done = rows.filter((r) => r.status === 'done' || r.status === 'edited').length;
  const visible = rows.filter((r) => filter === 'all' || (filter === 'done') === (r.status === 'done' || r.status === 'edited'));
  const percent = images.length ? Math.round((done / images.length) * 100) : 0;

  useEffect(() => {
    listRef.current?.querySelector('[aria-current="true"]')?.scrollIntoView({ block: 'nearest' });
  }, [currentKey]);

  return (
    <aside aria-label="Images" className="flex h-full min-h-0 flex-col border-r border-ink-800 bg-ink-900">
      <div className="space-y-3 border-b border-ink-800 px-4 pb-4 pt-3">
        <div className="flex items-center justify-between">
          <h2 className="panel-title">Images</h2>
          <div className="-mr-2 flex">
            <IconButton icon={ImagePlus} label="Open image files" hint={hint('openFiles')} onClick={onOpenFiles} />
            <IconButton icon={FolderOpen} label="Open a folder" onClick={onOpenFolder} />
            <IconButton icon={Shuffle} label={`Random picture from ${sourceName}`} hint={hint('random')} onClick={onRandom} disabled={busy} tipSide="left" />
          </div>
        </div>
        <div>
          <div className="mb-1.5 flex items-baseline justify-between text-xs">
            <span className="text-ink-300" data-testid="progress">
              <strong className="font-semibold text-ink-100">{done}</strong> of {images.length} submitted
            </span>
            <span className="font-mono text-ink-500">{percent}%</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-ink-800" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100} aria-label="Progress">
            <div className="h-full rounded-full bg-accent transition-[width] duration-500" style={{ width: `${percent}%` }} />
          </div>
        </div>
        <label className="flex items-center justify-between gap-2 text-xs text-ink-400">
          Random pictures from
          <select
            value={onlineSource}
            onChange={(e) => onOnlineSource(e.target.value as OnlineSourceId)}
            aria-label="Source of random pictures"
            className="rounded-md border border-ink-700 bg-ink-850 px-2 py-1 text-ink-100 focus:border-ink-500 focus:outline-none"
          >
            {onlineSources.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        <div className="grid grid-cols-3 rounded-lg bg-ink-850 p-0.5 text-xs" role="tablist" aria-label="Filter images">
          {(['all', 'todo', 'done'] as const).map((f) => (
            <button
              key={f}
              type="button"
              role="tab"
              aria-selected={filter === f}
              onClick={() => setFilter(f)}
              className={cx('rounded-md py-1.5 capitalize transition-colors', filter === f ? 'bg-ink-700 text-ink-100' : 'text-ink-400 hover:text-ink-200')}
            >
              {f === 'todo' ? 'To do' : f}
            </button>
          ))}
        </div>
      </div>

      <ol ref={listRef} className="min-h-0 flex-1 space-y-0.5 overflow-y-auto p-2" data-testid="image-list">
        {visible.map(({ item, status }) => {
          const current = item.key === currentKey;
          const count = boxCountOf(item);
          return (
            <li key={item.key} className="group relative">
              <button
                type="button"
                aria-current={current}
                onClick={() => onOpen(item.key)}
                className={cx(
                  'flex w-full items-center gap-3 rounded-lg p-1.5 pr-8 text-left transition-colors',
                  current ? 'bg-ink-750 ring-1 ring-ink-600' : 'hover:bg-ink-800',
                )}
              >
                <span className="relative h-10 w-14 shrink-0 overflow-hidden rounded-md bg-ink-800">
                  {!item.failed && <img src={item.src} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" draggable={false} />}
                  {current && <span className="absolute inset-y-0 left-0 w-0.5 bg-accent" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className={cx('block truncate text-[13px]', current ? 'text-ink-100' : 'text-ink-200')} title={item.key}>
                    {item.name}
                  </span>
                  <span className="block truncate text-[11px] text-ink-500">
                    {item.credit?.provider ?? SOURCE_LABEL[item.source]} · {count ? `${count} box${count > 1 ? 'es' : ''}` : 'no boxes'}
                  </span>
                </span>
                <StatusIcon status={status} />
              </button>
              <button
                type="button"
                aria-label={`Remove ${item.name} from the list`}
                onClick={() => onRemove(item.key)}
                className="absolute right-1.5 top-1/2 hidden -translate-y-1/2 rounded p-1 text-ink-500 hover:bg-ink-700 hover:text-ink-100 group-hover:block"
              >
                <X size={14} />
              </button>
            </li>
          );
        })}
        {!visible.length && <li className="px-3 py-8 text-center text-sm text-ink-500">{images.length ? 'Nothing here.' : 'No images yet.'}</li>}
      </ol>

      <p className="border-t border-ink-800 px-4 py-3 text-[11px] leading-relaxed text-ink-500">
        Drop images, a folder or annotation files anywhere on the page.
      </p>
    </aside>
  );
}

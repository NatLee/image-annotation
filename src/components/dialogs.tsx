import { Download, FileJson, FileArchive, Trophy } from 'lucide-react';
import { type FormEvent, useState } from 'react';
import { DANBOORU, NEKOS_BEST, REPO_URL } from '@/config';
import { type ExportFormat, FORMATS } from '@/lib/formats';
import type { LeaderboardRow } from '@/lib/stats';
import { GESTURES, SHORTCUTS, type ShortcutGroup, keycapsOf } from '@/shortcuts';
import { Modal } from './Modal';
import { Button, Keycaps } from './ui';
import { cx } from '@/lib/cx';

/* ------------------------------------------------------------------ help */

export function HelpDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const groups: ShortcutGroup[] = ['Boxes', 'Images', 'View'];
  return (
    <Modal open={open} onClose={onClose} title="Shortcuts and help" size="lg" description="Everything works from the keyboard. Press ? any time to see this again.">
      <div className="mb-6 rounded-xl border border-accent/30 bg-accent-soft px-4 py-3">
        <p className="text-base font-semibold text-accent">框頭，整顆頭！YEE！</p>
        <p className="mt-0.5 text-sm text-ink-300">The house rule: box the head, the whole head — hair included.</p>
      </div>
      <div className="grid gap-x-8 gap-y-6 md:grid-cols-2">
        {groups.map((group) => (
          <section key={group}>
            <h3 className="panel-title mb-2">{group}</h3>
            <dl className="divide-y divide-ink-800">
              {SHORTCUTS.filter((s) => s.group === group).map((s) => (
                <div key={s.id} className="flex items-center justify-between gap-4 py-2 text-sm">
                  <dt className="text-ink-300">{s.label}</dt>
                  <dd className="flex shrink-0 flex-wrap justify-end gap-1.5">
                    {s.keycaps ? (
                      <Keycaps keys={s.keycaps} />
                    ) : (
                      s.combos.map((combo) => <Keycaps key={combo} keys={keycapsOf(combo)} />)
                    )}
                  </dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
        <section>
          <h3 className="panel-title mb-2">Mouse</h3>
          <dl className="divide-y divide-ink-800">
            {GESTURES.map((g) => (
              <div key={g.label} className="flex items-center justify-between gap-4 py-2 text-sm">
                <dt className="text-ink-300">{g.label}</dt>
                <dd>
                  <Keycaps keys={g.keycaps} />
                </dd>
              </div>
            ))}
          </dl>
        </section>
      </div>
      <p className="mt-6 text-xs leading-relaxed text-ink-500">
        Your annotations stay in this browser (local storage) until you export them. Random pictures come from{' '}
        <a className="text-ink-300 underline underline-offset-2" href={NEKOS_BEST.homepage} target="_blank" rel="noreferrer">
          {NEKOS_BEST.name}
        </a>{' '}
        or, if you pick it above the image list,{' '}
        <a className="text-ink-300 underline underline-offset-2" href={DANBOORU.homepage} target="_blank" rel="noreferrer">
          {DANBOORU.name}
        </a>{' '}
        (general-audience posts only). They load straight from those servers and are credited on the canvas. The built-in pictures work offline. Source code:{' '}
        <a className="text-ink-300 underline underline-offset-2" href={REPO_URL} target="_blank" rel="noreferrer">
          {REPO_URL.replace('https://', '')}
        </a>
        .
      </p>
    </Modal>
  );
}

/* ----------------------------------------------------------- leaderboard */

export function LeaderboardDialog({ open, onClose, rows, me }: { open: boolean; onClose: () => void; rows: LeaderboardRow[]; me: string }) {
  const top = rows[0]?.images ?? 1;
  return (
    <Modal open={open} onClose={onClose} title="Leaderboard" description="Images submitted per annotator in this browser." size="sm">
      {rows.length ? (
        <ol className="space-y-2" data-testid="leaderboard">
          {rows.map((row, i) => (
            <li key={row.name} className={cx('rounded-xl border px-4 py-3', row.name === me ? 'border-accent/40 bg-accent-soft' : 'border-ink-800 bg-ink-850')}>
              <div className="flex items-center gap-3">
                <span className={cx('grid size-7 place-items-center rounded-full font-mono text-xs font-semibold', i === 0 ? 'bg-amber-400 text-ink-950' : 'bg-ink-700 text-ink-200')}>
                  {i === 0 ? <Trophy size={14} /> : i + 1}
                </span>
                <span className="min-w-0 flex-1 truncate font-medium text-ink-100">{row.name}</span>
                <span className="text-right text-sm">
                  <span className="font-mono font-semibold text-ink-100">{row.images}</span>
                  <span className="text-ink-500"> img · </span>
                  <span className="font-mono text-ink-300">{row.boxes}</span>
                  <span className="text-ink-500"> boxes</span>
                </span>
              </div>
              <div className="ml-10 mt-2 h-1 overflow-hidden rounded-full bg-ink-800">
                <div className="h-full rounded-full bg-accent" style={{ width: `${(row.images / top) * 100}%` }} />
              </div>
            </li>
          ))}
        </ol>
      ) : (
        <p className="py-6 text-center text-sm text-ink-400">Nobody has submitted anything yet. Be the first!</p>
      )}
    </Modal>
  );
}

/* ---------------------------------------------------------------- export */

export function ExportDialog({
  open,
  onClose,
  totals,
  onExport,
}: {
  open: boolean;
  onClose: () => void;
  totals: { images: number; boxes: number };
  onExport: (format: ExportFormat) => void;
}) {
  const [format, setFormat] = useState<ExportFormat>('json');
  const empty = totals.images === 0;
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Export annotations"
      description={empty ? 'Nothing to export yet — submit an image first.' : `${totals.images} images and ${totals.boxes} boxes, from this browser.`}
      footer={
        <>
          <Button tone="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button tone="primary" icon={Download} disabled={empty} onClick={() => onExport(format)} data-autofocus data-testid="export-confirm">
            Download {FORMATS.find((f) => f.id === format)!.label}
          </Button>
        </>
      }
    >
      <fieldset className="grid gap-2 sm:grid-cols-2">
        <legend className="sr-only">Format</legend>
        {FORMATS.map((f) => {
          const Icon = f.id === 'yolo' || f.id === 'voc' ? FileArchive : FileJson;
          const checked = f.id === format;
          return (
            <label
              key={f.id}
              className={cx(
                'flex cursor-pointer gap-3 rounded-xl border p-4 transition-colors',
                checked ? 'border-accent/60 bg-accent-soft' : 'border-ink-700 bg-ink-850 hover:border-ink-600',
              )}
            >
              <input type="radio" name="format" value={f.id} checked={checked} onChange={() => setFormat(f.id)} className="sr-only" />
              <Icon size={20} className={checked ? 'text-accent' : 'text-ink-400'} aria-hidden />
              <span>
                <span className="block font-medium text-ink-100">{f.label}</span>
                <span className="mt-0.5 block text-xs leading-relaxed text-ink-400">{f.description}</span>
              </span>
            </label>
          );
        })}
      </fieldset>
      <p className="mt-4 text-xs text-ink-500">Import any of these back with the upload button, or drop the file on the page.</p>
    </Modal>
  );
}

/* --------------------------------------------------------------- confirm */

export interface ConfirmRequest {
  title: string;
  message: string;
  confirmLabel: string;
  danger?: boolean;
  resolve: (ok: boolean) => void;
}

export function ConfirmDialog({ request, onDone }: { request: ConfirmRequest | null; onDone: () => void }) {
  const answer = (ok: boolean) => {
    request?.resolve(ok);
    onDone();
  };
  return (
    <Modal
      open={!!request}
      onClose={() => answer(false)}
      title={request?.title ?? ''}
      description={request?.message}
      size="sm"
      footer={
        <>
          <Button tone="ghost" onClick={() => answer(false)}>
            Cancel
          </Button>
          <Button tone={request?.danger ? 'danger' : 'primary'} onClick={() => answer(true)} data-autofocus data-testid="confirm">
            {request?.confirmLabel}
          </Button>
        </>
      }
    />
  );
}

/* ------------------------------------------------------------------ name */

export function NameDialog({ open, onSave }: { open: boolean; onSave: (name: string) => void }) {
  const [name, setName] = useState('');
  const submit = (e: FormEvent) => {
    e.preventDefault();
    onSave(name.trim());
  };
  return (
    <Modal open={open} onClose={() => onSave('')} title="請輸入你的名字！" description="Who is annotating? Your name goes into every record you submit and onto the leaderboard." size="sm">
      <form onSubmit={submit} className="space-y-4">
        <input
          data-autofocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Your name"
          aria-label="Your name"
          className="h-11 w-full rounded-lg border border-ink-700 bg-ink-850 px-3 text-ink-100 placeholder:text-ink-500 focus:border-accent focus:outline-none"
        />
        <div className="flex justify-end gap-2">
          <Button tone="ghost" onClick={() => onSave('')}>
            Stay anonymous
          </Button>
          <Button tone="primary" type="submit" disabled={!name.trim()}>
            Start annotating
          </Button>
        </div>
      </form>
    </Modal>
  );
}

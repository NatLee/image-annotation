import { ArrowRight, Plus, SkipForward, Trash2, X } from 'lucide-react';
import { type FormEvent, useState } from 'react';
import { hint } from '@/shortcuts';
import { colorFor } from '@/lib/classes';
import type { BoundingBox, LabelClass } from '@/types';
import type { ImageStatus } from './ImageList';
import { Button, IconButton, Section } from './ui';
import { cx } from '@/lib/cx';

interface InspectorProps {
  classes: LabelClass[];
  activeClass: string;
  boxes: BoundingBox[];
  selectedId: string | null;
  status: ImageStatus | undefined;
  canSubmit: boolean;
  onActivateClass: (name: string) => void;
  onAddClass: (name: string) => void;
  onRemoveClass: (name: string) => void;
  onRecolorClass: (name: string, color: string) => void;
  onSelectBox: (id: string) => void;
  onRelabelBox: (id: string, label: string) => void;
  onDeleteBox: (id: string) => void;
  onSubmit: () => void;
  onSkip: () => void;
}

const STATUS_PILL: Record<ImageStatus, [string, string]> = {
  done: ['Submitted', 'bg-accent-soft text-accent'],
  edited: ['Changed since submit', 'bg-warn/15 text-warn'],
  draft: ['Not submitted', 'bg-warn/15 text-warn'],
  new: ['New', 'bg-ink-800 text-ink-400'],
  failed: ['Failed to load', 'bg-danger/15 text-danger'],
};

export function Inspector(props: InspectorProps) {
  const { classes, activeClass, boxes, selectedId, status } = props;
  const [newClass, setNewClass] = useState('');

  const counts = new Map<string, number>();
  for (const b of boxes) counts.set(b.label, (counts.get(b.label) ?? 0) + 1);

  const addClass = (e: FormEvent) => {
    e.preventDefault();
    if (!newClass.trim()) return;
    props.onAddClass(newClass);
    setNewClass('');
  };

  return (
    <aside aria-label="Classes and boxes" className="flex h-full min-h-0 flex-col border-l border-ink-800 bg-ink-900">
      <Section title="Classes" aside={<span className="text-[11px] text-ink-500">press 1–9</span>} className="shrink-0">
        <ul className="space-y-0.5 px-2" data-testid="class-list">
          {classes.map((c, i) => {
            const active = c.name === activeClass;
            return (
              <li key={c.name} className="group flex items-center gap-1">
                <label
                  className="relative grid size-8 shrink-0 cursor-pointer place-items-center rounded-md hover:bg-ink-800"
                  data-tip="Change colour"
                >
                  <span className="size-3.5 rounded-full ring-2 ring-black/30" style={{ background: c.color }} />
                  <input
                    type="color"
                    value={c.color}
                    onChange={(e) => props.onRecolorClass(c.name, e.target.value)}
                    className="absolute inset-0 cursor-pointer opacity-0"
                    aria-label={`Colour of ${c.name}`}
                  />
                </label>
                <button
                  type="button"
                  onClick={() => props.onActivateClass(c.name)}
                  aria-pressed={active}
                  className={cx(
                    'flex h-8 min-w-0 flex-1 items-center gap-2 rounded-md px-2 text-left text-sm transition-colors',
                    active ? 'bg-ink-750 text-ink-100 ring-1 ring-ink-600' : 'text-ink-300 hover:bg-ink-800',
                  )}
                >
                  <span className="min-w-0 flex-1 truncate">{c.name}</span>
                  {!!counts.get(c.name) && <span className="font-mono text-[11px] text-ink-400">{counts.get(c.name)}</span>}
                  {i < 9 && <kbd className="kbd">{i + 1}</kbd>}
                </button>
                <button
                  type="button"
                  aria-label={`Remove class ${c.name}`}
                  disabled={classes.length <= 1}
                  onClick={() => props.onRemoveClass(c.name)}
                  className="invisible rounded p-1.5 text-ink-500 hover:bg-ink-800 hover:text-ink-100 group-hover:visible disabled:hidden"
                >
                  <X size={14} />
                </button>
              </li>
            );
          })}
        </ul>
        <form onSubmit={addClass} className="flex gap-2 px-4 pb-4 pt-2">
          <input
            value={newClass}
            onChange={(e) => setNewClass(e.target.value)}
            placeholder="New class name"
            aria-label="New class name"
            className="h-8 min-w-0 flex-1 rounded-md border border-ink-700 bg-ink-850 px-2.5 text-sm text-ink-100 placeholder:text-ink-500 focus:border-ink-500 focus:outline-none"
          />
          <Button type="submit" icon={Plus} className="h-8 px-2.5" aria-label="Add class" disabled={!newClass.trim()} />
        </form>
      </Section>

      <div className="border-t border-ink-800" />

      <Section
        title={`Boxes · ${boxes.length}`}
        aside={status && <span className={cx('rounded-full px-2 py-0.5 text-[11px] font-medium', STATUS_PILL[status][1])}>{STATUS_PILL[status][0]}</span>}
        className="min-h-0 flex-1"
      >
        <ul className="min-h-0 flex-1 space-y-1 overflow-y-auto px-2 pb-2" data-testid="box-list">
          {boxes.map((box, i) => {
            const selected = box.id === selectedId;
            return (
              <li
                key={box.id}
                className={cx(
                  'group flex items-center gap-2 rounded-lg border px-2 py-1.5 transition-colors',
                  selected ? 'border-ink-600 bg-ink-750' : 'border-transparent hover:bg-ink-800',
                )}
                onClick={() => props.onSelectBox(box.id)}
              >
                <span className="h-8 w-1 shrink-0 rounded-full" style={{ background: colorFor(classes, box.label) }} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[11px] text-ink-500">#{i + 1}</span>
                    <select
                      value={box.label}
                      onChange={(e) => props.onRelabelBox(box.id, e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                      aria-label={`Class of box ${i + 1}`}
                      className="min-w-0 flex-1 truncate rounded bg-transparent text-sm text-ink-100 hover:bg-ink-700 focus:outline-none"
                    >
                      {[...new Set([...classes.map((c) => c.name), box.label])].map((name) => (
                        <option key={name} value={name} className="bg-ink-850">
                          {name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <p className="font-mono text-[11px] text-ink-400">
                    {Math.round(box.width)}×{Math.round(box.height)} at {Math.round(box.x)}, {Math.round(box.y)}
                  </p>
                </div>
                <IconButton
                  icon={Trash2}
                  label="Delete box"
                  tipSide="left"
                  className="invisible size-7 group-hover:visible"
                  onClick={(e) => {
                    e.stopPropagation();
                    props.onDeleteBox(box.id);
                  }}
                />
              </li>
            );
          })}
          {!boxes.length && (
            <li className="rounded-lg border border-dashed border-ink-700 px-4 py-6 text-center text-sm text-ink-400">
              Drag on the image to draw a box,
              <br />
              or press <kbd className="kbd">N</kbd>
            </li>
          )}
        </ul>
      </Section>

      <div className="space-y-2 border-t border-ink-800 p-4">
        <Button tone="primary" icon={ArrowRight} keys={hint('submit')} className="h-10 w-full" onClick={props.onSubmit} disabled={!props.canSubmit} data-testid="submit">
          Submit &amp; next
        </Button>
        <Button tone="ghost" icon={SkipForward} keys={hint('next')} className="w-full" onClick={props.onSkip}>
          Skip for now
        </Button>
      </div>
    </aside>
  );
}

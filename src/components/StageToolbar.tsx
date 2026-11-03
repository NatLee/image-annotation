import { Grid3x3, Maximize, Minus, Plus, Redo2, SquarePlus, Trash2, Undo2 } from 'lucide-react';
import { hint } from '@/shortcuts';
import { IconButton } from './ui';

interface StageToolbarProps {
  zoom: number | undefined;
  canUndo: boolean;
  canRedo: boolean;
  hasBoxes: boolean;
  ready: boolean;
  grid: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onAddBox: () => void;
  onDeleteBox: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFit: () => void;
  onGrid: () => void;
}

const Divider = () => <span className="mx-1 h-5 w-px bg-ink-700" aria-hidden />;

/** The floating tool strip at the bottom of the canvas. */
export function StageToolbar(p: StageToolbarProps) {
  return (
    <div
      role="toolbar"
      aria-label="Canvas tools"
      onPointerDown={(e) => e.stopPropagation()}
      className="absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-0.5 rounded-xl border border-ink-700 bg-ink-900/90 p-1 shadow-xl shadow-black/40 backdrop-blur"
    >
      <IconButton icon={Undo2} label="Undo" hint={hint('undo')} tipSide="top" disabled={!p.canUndo} onClick={p.onUndo} />
      <IconButton icon={Redo2} label="Redo" hint={hint('redo')} tipSide="top" disabled={!p.canRedo} onClick={p.onRedo} />
      <Divider />
      <IconButton icon={SquarePlus} label="Add box" hint={hint('addBox')} tipSide="top" disabled={!p.ready} onClick={p.onAddBox} />
      <IconButton icon={Trash2} label="Delete box" hint={hint('deleteBox')} tipSide="top" disabled={!p.hasBoxes} onClick={p.onDeleteBox} />
      <Divider />
      <IconButton icon={Minus} label="Zoom out" hint={hint('zoomOut')} tipSide="top" disabled={!p.ready} onClick={p.onZoomOut} className="max-sm:hidden" />
      <button
        type="button"
        onClick={p.onFit}
        disabled={!p.ready}
        data-tip={`Fit to screen · ${hint('fit')}`}
        data-tip-side="top"
        className="h-9 w-14 rounded-lg font-mono text-xs text-ink-300 hover:bg-ink-800 hover:text-ink-100 disabled:opacity-35"
        data-testid="zoom"
      >
        {p.zoom ? `${Math.round(p.zoom * 100)}%` : '—'}
      </button>
      <IconButton icon={Plus} label="Zoom in" hint={hint('zoomIn')} tipSide="top" disabled={!p.ready} onClick={p.onZoomIn} className="max-sm:hidden" />
      <IconButton icon={Maximize} label="Fit to screen" hint={hint('fit')} tipSide="top" disabled={!p.ready} onClick={p.onFit} className="max-sm:hidden" />
      <Divider />
      <IconButton icon={Grid3x3} label="Grid" hint={hint('grid')} tipSide="top" active={p.grid} onClick={p.onGrid} />
    </div>
  );
}

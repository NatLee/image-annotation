import { Download, Keyboard, PanelLeft, PanelRight, Trash2, Trophy, Upload, UserRound } from 'lucide-react';
import { hint } from '@/shortcuts';
import { IconButton } from './ui';

interface TopBarProps {
  userName: string;
  totals: { images: number; boxes: number };
  onUserName: (name: string) => void;
  onImport: () => void;
  onExport: () => void;
  onLeaderboard: () => void;
  onHelp: () => void;
  onClear: () => void;
  onTogglePanel: (panel: 'images' | 'inspector') => void;
}

/** A box with corner handles: what the app is about, in 20 px. */
export function LogoMark({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      <rect x="2.5" y="2.5" width="19" height="19" rx="4" fill="#22c55e" fillOpacity="0.16" />
      <rect x="6" y="6" width="12" height="12" rx="1.5" fill="none" stroke="#22c55e" strokeWidth="2" />
      {[
        [6, 6],
        [18, 6],
        [6, 18],
        [18, 18],
      ].map(([x, y]) => (
        <rect key={`${x}${y}`} x={x - 2} y={y - 2} width="4" height="4" rx="1" fill="#eceff4" />
      ))}
    </svg>
  );
}

export function TopBar({ userName, totals, onUserName, onImport, onExport, onLeaderboard, onHelp, onClear, onTogglePanel }: TopBarProps) {
  return (
    <header className="flex h-14 items-center gap-2 border-b border-ink-800 bg-ink-900 px-3 sm:px-4">
      <IconButton icon={PanelLeft} label="Images" className="lg:hidden" onClick={() => onTogglePanel('images')} />
      <div className="flex items-center gap-2.5 max-sm:hidden">
        <LogoMark />
        <h1 className="hidden text-[15px] font-semibold tracking-tight text-ink-100 sm:block">Image Annotation</h1>
      </div>

      <label className="ml-1 flex h-9 min-w-0 max-w-56 flex-1 items-center gap-2 rounded-lg border border-ink-700 bg-ink-850 px-2.5 focus-within:border-ink-500 sm:ml-4">
        <UserRound size={15} className="shrink-0 text-ink-400" aria-hidden />
        <input
          id="userName"
          value={userName}
          onChange={(e) => onUserName(e.target.value)}
          placeholder="Your name"
          aria-label="Annotator name"
          autoComplete="nickname"
          className="min-w-0 flex-1 bg-transparent text-sm text-ink-100 placeholder:text-ink-500 focus:outline-none"
        />
      </label>

      <div className="ml-auto flex items-center sm:gap-1 [&>button]:max-sm:size-8">
        <p className="mr-3 hidden text-xs text-ink-400 md:block" data-testid="totals">
          <strong className="font-mono text-sm font-semibold text-ink-100">{totals.images}</strong> images ·{' '}
          <strong className="font-mono text-sm font-semibold text-ink-100">{totals.boxes}</strong> boxes saved
        </p>
        <IconButton icon={Upload} label="Import annotations" onClick={onImport} />
        <IconButton icon={Download} label="Export annotations" onClick={onExport} />
        <IconButton icon={Trophy} label="Leaderboard" onClick={onLeaderboard} />
        <IconButton icon={Keyboard} label="Shortcuts and help" hint={hint('help')} onClick={onHelp} />
        <IconButton icon={Trash2} label="Clear all saved annotations" onClick={onClear} tipSide="left" className="hover:text-danger" />
        <IconButton icon={PanelRight} label="Classes and boxes" className="lg:hidden" tipSide="left" onClick={() => onTogglePanel('inspector')} />
      </div>
    </header>
  );
}

import { Download, Keyboard, PanelLeft, PanelRight, Trash2, Trophy, Upload, UserRound } from 'lucide-react';
import { REPO_URL } from '@/config';
import { hint } from '@/shortcuts';
import { IconButton, IconLink } from './ui';

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

/** GitHub's mark (Octicons "mark-github", MIT). lucide no longer ships brand icons. */
function GitHubMark() {
  return (
    <svg width={18} height={18} viewBox="0 0 16 16" fill="currentColor" aria-hidden>
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
    </svg>
  );
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
        <IconLink href={REPO_URL} label="Source code on GitHub" tipSide="left" data-testid="repo-link">
          <GitHubMark />
        </IconLink>
        <IconButton icon={PanelRight} label="Classes and boxes" className="lg:hidden" tipSide="left" onClick={() => onTogglePanel('inspector')} />
      </div>
    </header>
  );
}

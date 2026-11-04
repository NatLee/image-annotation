import { FolderOpen, ImagePlus, LoaderCircle, Shuffle, Upload } from 'lucide-react';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { DEFAULT_ANNOTATOR, type OnlineSourceId } from '@/config';
import { ConfirmDialog, type ConfirmRequest, ExportDialog, HelpDialog, LeaderboardDialog, NameDialog } from '@/components/dialogs';
import { ImageList, type ImageStatus } from '@/components/ImageList';
import { Inspector } from '@/components/Inspector';
import { Stage, type StageHandle, type ViewInfo } from '@/components/Stage';
import { StageToolbar } from '@/components/StageToolbar';
import { StatusBar } from '@/components/StatusBar';
import { Toasts } from '@/components/Toasts';
import { TopBar } from '@/components/TopBar';
import { Button } from '@/components/ui';
import { cx } from '@/lib/cx';
import { useToasts } from '@/hooks/useToasts';
import { useWorkspace } from '@/hooks/useWorkspace';
import { downloadFile, isEditableTarget, loadImageSize, pickedFromDrop, pickedFromInput, readBytes } from '@/lib/browser';
import { buildExport, type ExportFormat, importFiles } from '@/lib/formats';
import { displaySize } from '@/lib/geometry';
import { newBoxId, newSessionId } from '@/lib/ids';
import { isImageFile } from '@/lib/paths';
import { findRecord, upsertRecords } from '@/lib/records';
import { createOnlineSources, OnlineSourceError } from '@/lib/online';
import { localItems, onlineItems, type PickedFile } from '@/lib/sources';
import { leaderboard } from '@/lib/stats';
import { loadOnlineSource, loadUserName, saveOnlineSource, saveUserName } from '@/lib/storage';
import {
  buildRecord,
  canRedoCurrent,
  canUndoCurrent,
  currentBoxes,
  currentItem,
  hasUnsavedWork,
  nextPendingKey,
} from '@/lib/workspace';
import { type Commands, comboOf, findShortcut } from '@/shortcuts';
import type { ImageItem, Size } from '@/types';

const ANNOTATION_FILE = /\.(json|xml|txt|ya?ml|names|zip)$/i;
const IMPORT_ACCEPT = '.json,.xml,.txt,.yaml,.yml,.names,.zip';
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : word.endsWith('x') ? 'es' : 's'}`;

type DialogName = 'help' | 'export' | 'leaderboard';
type Drawer = 'images' | 'inspector';

export default function App() {
  const { toasts, notify, dismiss } = useToasts();
  const onSaveError = useCallback(
    () => notify('error', 'Could not save in this browser', 'Storage may be full or blocked. Export your work to keep it.'),
    [notify],
  );
  const { state, dispatch, store } = useWorkspace(onSaveError);

  const [userName, setUserName] = useState(() => loadUserName(store));
  const [askName, setAskName] = useState(() => !loadUserName(store)); // v1 asked on every visit without a name
  const [dialog, setDialog] = useState<DialogName | null>(null);
  const [confirmRequest, setConfirmRequest] = useState<ConfirmRequest | null>(null);
  const [showGrid, setShowGrid] = useState(false);
  const [view, setView] = useState<ViewInfo>();
  const [busy, setBusy] = useState(false);
  const [drawer, setDrawer] = useState<Drawer | null>(null);
  const [dropping, setDropping] = useState(false);
  const [onlineSource, setOnlineSource] = useState<OnlineSourceId>(() => loadOnlineSource(store));
  // One set per page load: Danbooru keeps its batch of posts here for the session.
  const [sources] = useState(createOnlineSources);

  const stageRef = useRef<StageHandle>(null);
  const filesInput = useRef<HTMLInputElement>(null);
  const folderInput = useRef<HTMLInputElement>(null);
  const importInput = useRef<HTMLInputElement>(null);

  const item = currentItem(state);
  const boxes = currentBoxes(state);

  // Async handlers and window listeners read the newest values from here.
  const latest = useRef({ state, view, userName, onlineSource, busy: false });
  useLayoutEffect(() => {
    latest.current = { ...latest.current, state, view, userName, onlineSource };
  });

  const onViewChange = useCallback((info: ViewInfo) => setView(info), []);

  const confirm = (request: Omit<ConfirmRequest, 'resolve'>) =>
    new Promise<boolean>((resolve) => setConfirmRequest({ ...request, resolve }));

  /* ------------------------------------------------------- image loading */

  const pendingKey = item && !item.size && !item.failed ? item.key : undefined;
  const pendingSrc = pendingKey ? item?.src : undefined;
  const pendingName = pendingKey ? item?.name : undefined;
  useEffect(() => {
    if (!pendingKey || !pendingSrc) return;
    let cancelled = false;
    loadImageSize(pendingSrc).then(
      (size) => !cancelled && dispatch({ type: 'image/loaded', key: pendingKey, size, boxId: newBoxId() }),
      () => {
        if (cancelled) return;
        dispatch({ type: 'image/failed', key: pendingKey });
        notify('error', 'This image could not be loaded', pendingName);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [pendingKey, pendingSrc, pendingName, dispatch, notify]);

  /* -------------------------------------------------------- image sources */

  /**
   * One online image from the chosen source. When that fails, say why; with
   * `fallback`, open the bundled illustrations instead (they work offline).
   */
  const random = useCallback(
    async ({ fallback = false } = {}) => {
      if (latest.current.busy) return;
      latest.current.busy = true;
      setBusy(true);
      const source = sources[latest.current.onlineSource];
      try {
        const image = await source.next();
        dispatch({ type: 'images/add', items: [image], open: true });
      } catch (error) {
        const reason = error instanceof OnlineSourceError ? error.message : `Could not reach ${source.name}.`;
        notify('error', `No picture from ${source.name}`, `${reason} The built-in illustrations work offline.`);
        const { state: s } = latest.current;
        const sample = nextPendingKey(s) ?? s.images[0]?.key;
        if (fallback && !s.currentKey && sample) dispatch({ type: 'image/open', key: sample });
      } finally {
        latest.current.busy = false;
        setBusy(false);
      }
    },
    [dispatch, notify, sources],
  );

  // Like v1, start with a random online image; the samples are the offline fallback.
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void random({ fallback: true });
  }, [random]);

  /** Online images continue with another online image (as in v1); files and samples go down the list. */
  const goNext = () => {
    const { state: s } = latest.current;
    const key = currentItem(s)?.source === 'online' ? undefined : nextPendingKey(s);
    if (key) dispatch({ type: 'image/open', key });
    else void random();
  };

  const changeOnlineSource = (id: OnlineSourceId) => {
    setOnlineSource(id);
    saveOnlineSource(store, id);
  };

  const importAnnotations = async (files: PickedFile[], addedImages: ImageItem[]) => {
    const inputs = await Promise.all(files.map(async (f) => ({ path: f.path, bytes: await readBytes(f.file) })));
    const { state: s } = latest.current;
    const known = new Set(s.images.map((i) => i.key));
    const images = [...s.images, ...addedImages.filter((i) => !known.has(i.key))];

    // YOLO stores fractions of the image size, so make sure every size is known.
    const sizes = new Map<string, Size>(images.flatMap((i) => (i.size ? [[i.key, i.size] as const] : [])));
    if (inputs.some((f) => /\.(txt|zip)$/i.test(f.path))) {
      await Promise.all(
        images.filter((i) => !i.size && !i.failed).map((i) => loadImageSize(i.src).then((size) => sizes.set(i.key, size), () => undefined)),
      );
    }

    const now = new Date();
    const result = importFiles(inputs, {
      images: images.map((i) => ({ key: i.key, size: sizes.get(i.key) })),
      classNames: s.classes.map((c) => c.name),
      now,
    });
    const notes = [
      result.unmatched.length && `${plural(result.unmatched.length, 'label')} had no matching image — add the images first`,
      result.skipped && `${plural(result.skipped, 'image')} without boxes skipped`,
      result.ignored.length && `${plural(result.ignored.length, 'file')} not recognised`,
    ].filter(Boolean);

    if (!result.records.length) {
      notify('error', 'No annotations found', notes.join(' · ') || 'Use JSON, COCO, YOLO or Pascal VOC files.');
      return;
    }
    dispatch({ type: 'records/import', records: result.records, now: now.toISOString() });
    const online = onlineItems(result.records, new Set(images.map((i) => i.key)));
    if (online.length) dispatch({ type: 'images/add', items: online });
    const boxCount = result.records.reduce((n, r) => n + r.bounding_boxes.length, 0);
    notify('success', `Imported ${plural(result.records.length, 'image')} · ${plural(boxCount, 'box')}`, [result.formats.join(', '), ...notes].join(' · '));
  };

  /** Everything that arrives as files: picked, dropped or imported. */
  const handleFiles = async (files: PickedFile[]) => {
    const known = new Set(latest.current.state.images.map((i) => i.key));
    const imageFiles = files.filter((f) => isImageFile(f.path, f.file.type));
    const annotationFiles = files.filter((f) => !isImageFile(f.path, f.file.type) && ANNOTATION_FILE.test(f.path));

    const added = localItems(imageFiles.filter((f) => !known.has(f.path)), (file) => URL.createObjectURL(file));
    if (imageFiles.length) {
      dispatch({ type: 'images/add', items: added, open: true });
      if (!added.length) dispatch({ type: 'image/open', key: imageFiles[0].path });
      notify('success', added.length ? `Added ${plural(added.length, 'image')}` : 'Those images are already in the list');
    }
    if (annotationFiles.length) await importAnnotations(annotationFiles, added);
    if (!imageFiles.length && !annotationFiles.length) {
      notify('error', 'Nothing to open here', 'Drop images, a folder, or JSON / XML / TXT / ZIP annotation files.');
    }
  };

  const latestHandleFiles = useRef(handleFiles);
  useLayoutEffect(() => {
    latestHandleFiles.current = handleFiles;
  });

  // Drop files or folders anywhere on the page.
  useEffect(() => {
    let depth = 0;
    const hasFiles = (e: DragEvent) => !!e.dataTransfer && [...e.dataTransfer.types].includes('Files');
    const enter = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      depth += 1;
      setDropping(true);
    };
    const over = (e: DragEvent) => hasFiles(e) && e.preventDefault();
    const leave = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      depth = Math.max(0, depth - 1);
      if (!depth) setDropping(false);
    };
    const drop = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      depth = 0;
      setDropping(false);
      void pickedFromDrop(e.dataTransfer!).then((files) => latestHandleFiles.current(files));
    };
    window.addEventListener('dragenter', enter);
    window.addEventListener('dragover', over);
    window.addEventListener('dragleave', leave);
    window.addEventListener('drop', drop);
    return () => {
      window.removeEventListener('dragenter', enter);
      window.removeEventListener('dragover', over);
      window.removeEventListener('dragleave', leave);
      window.removeEventListener('drop', drop);
    };
  }, []);

  const removeImage = (key: string) => {
    const target = latest.current.state.images.find((i) => i.key === key);
    if (target?.source === 'local') URL.revokeObjectURL(target.src);
    dispatch({ type: 'images/remove', key });
  };

  /* --------------------------------------------------------------- submit */

  const submit = async () => {
    const { state: s, view: v, userName: name } = latest.current;
    const current = currentItem(s);
    if (!current?.size) return;
    if (!currentBoxes(s).length) {
      notify('error', 'Draw at least one box before submitting');
      return;
    }
    if (findRecord(s.records, current.key)) {
      const ok = await confirm({
        title: 'Overwrite the saved annotation?',
        message: 'This image has already been annotated. Do you want to overwrite the previous annotation?',
        confirmLabel: 'Overwrite',
      });
      if (!ok) return;
    }
    const now = new Date();
    const fitScale = v?.fitScale ?? 1;
    const record = buildRecord(latest.current.state, {
      sessionId: newSessionId(now),
      annotator: name.trim() || DEFAULT_ANNOTATOR,
      now: now.toISOString(),
      displaySize: displaySize(current.size, fitScale),
      scaleFactor: fitScale,
    });
    if (!record) return;
    dispatch({ type: 'submit', record, now: now.toISOString() });
    const totals = upsertRecords(s.records, [record], now.toISOString());
    notify('success', 'Annotation submitted', `${plural(totals.total_images, 'image')} · ${plural(totals.total_annotations, 'box')} saved in total`);
    goNext();
  };

  /* ------------------------------------------------------ data commands */

  const exportAs = (format: ExportFormat) => {
    const { records, classes } = latest.current.state;
    downloadFile(buildExport(format, records, classes, new Date()));
    setDialog(null);
    notify('success', `Exported ${plural(records.total_images, 'image')} with ${plural(records.total_annotations, 'annotation')}`);
  };

  const clearAll = async () => {
    const ok = await confirm({
      title: 'Delete all saved annotations?',
      message: 'Are you sure you want to delete all annotation data? This cannot be undone. Export first if you want a copy.',
      confirmLabel: 'Delete everything',
      danger: true,
    });
    if (!ok) return;
    dispatch({ type: 'records/clear', now: new Date().toISOString() });
    notify('success', 'All annotation data cleared');
  };

  const changeName = (name: string) => {
    setUserName(name);
    saveUserName(store, name);
  };

  /* ------------------------------------------------------------ keyboard */

  const commands: Commands = {
    addBox: () => dispatch({ type: 'box/add', id: newBoxId() }),
    deleteBox: () => dispatch({ type: 'box/delete' }),
    cycleBox: (delta) => dispatch({ type: 'box/cycle', delta }),
    deselect: () => dispatch({ type: 'box/select', id: null }),
    nudge: (dx, dy) => dispatch({ type: 'box/nudge', dx, dy }),
    pickClass: (index) => {
      const target = latest.current.state.classes[index];
      if (target) dispatch({ type: 'class/activate', name: target.name });
    },
    undo: () => dispatch({ type: 'history/undo' }),
    redo: () => dispatch({ type: 'history/redo' }),
    submit: () => void submit(),
    step: (delta) => dispatch({ type: 'image/step', delta }),
    random: () => void random(),
    openFiles: () => filesInput.current?.click(),
    zoomIn: () => stageRef.current?.zoomIn(),
    zoomOut: () => stageRef.current?.zoomOut(),
    fit: () => stageRef.current?.fit(),
    toggleGrid: () => setShowGrid((on) => !on),
    help: () => setDialog('help'),
  };
  const latestCommands = useRef(commands);
  useLayoutEffect(() => {
    latestCommands.current = commands;
  });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.isComposing || document.querySelector('dialog[open]')) return;
      const target = e.target instanceof HTMLElement ? e.target : document.body;
      if (isEditableTarget(target)) return;
      const combo = comboOf(e);
      // Let focused controls keep their own Enter/Space and Tab behaviour.
      if ((combo === 'enter' || combo === 'space') && target.closest('button, a, [role="tab"]')) return;
      if (combo.endsWith('tab') && target !== document.body && !target.closest('[data-testid="stage"]')) return;
      const shortcut = findShortcut(combo);
      if (!shortcut) return;
      e.preventDefault();
      shortcut.run(latestCommands.current, combo);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (hasUnsavedWork(latest.current.state)) e.preventDefault();
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, []);

  /* --------------------------------------------------------- derived data */

  const statusOf = useCallback(
    (image: ImageItem): ImageStatus => {
      if (image.failed) return 'failed';
      const done = !!findRecord(state.records, image.key);
      const dirty = !!state.drafts[image.key]?.dirty;
      return done ? (dirty ? 'edited' : 'done') : dirty ? 'draft' : 'new';
    },
    [state.records, state.drafts],
  );
  const boxCountOf = useCallback(
    (image: ImageItem) => state.drafts[image.key]?.history.present.length ?? findRecord(state.records, image.key)?.bounding_boxes.length ?? 0,
    [state.records, state.drafts],
  );
  const rows = useMemo(() => leaderboard(state.records.annotation_records), [state.records]);
  const totals = { images: state.records.total_images, boxes: state.records.total_annotations };
  const ready = !!item?.size;

  const drawerClass = (which: Drawer, side: 'left' | 'right') =>
    cx(
      'fixed bottom-0 top-14 z-30 w-[19rem] max-w-[85vw] transition-transform duration-200 lg:static lg:z-auto lg:w-auto lg:max-w-none lg:translate-x-0',
      side === 'left' ? 'left-0' : 'right-0',
      drawer === which ? 'translate-x-0' : side === 'left' ? '-translate-x-full' : 'translate-x-full',
    );

  return (
    <div
      className="flex h-dvh flex-col"
      // Mouse clicks should not park focus on buttons: Enter and Space belong to the editor.
      onMouseDown={(e) => (e.target as Element).closest('button') && e.preventDefault()}
    >
      <TopBar
        userName={userName}
        totals={totals}
        onUserName={changeName}
        onImport={() => importInput.current?.click()}
        onExport={() => setDialog('export')}
        onLeaderboard={() => setDialog('leaderboard')}
        onHelp={() => setDialog('help')}
        onClear={() => void clearAll()}
        onTogglePanel={(which) => setDrawer((open) => (open === which ? null : which))}
      />

      <div className="relative grid min-h-0 flex-1 lg:grid-cols-[17.5rem_minmax(0,1fr)_19rem]">
        <div className={drawerClass('images', 'left')}>
          <ImageList
            images={state.images}
            currentKey={state.currentKey}
            statusOf={statusOf}
            boxCountOf={boxCountOf}
            busy={busy}
            onlineSource={onlineSource}
            onlineSources={Object.values(sources).map(({ id, name }) => ({ id, name }))}
            onOnlineSource={changeOnlineSource}
            onOpen={(key) => {
              dispatch({ type: 'image/open', key });
              setDrawer(null);
            }}
            onRemove={removeImage}
            onOpenFiles={() => filesInput.current?.click()}
            onOpenFolder={() => folderInput.current?.click()}
            onRandom={() => void random()}
          />
        </div>

        <main className="flex min-h-0 min-w-0 flex-col">
          <div className="relative min-h-0 flex-1">
            {item ? (
              <Stage
                ref={stageRef}
                item={item}
                boxes={boxes}
                selectedId={state.selectedId}
                classes={state.classes}
                showGrid={showGrid}
                onSelect={(id) => dispatch({ type: 'box/select', id })}
                onDraw={(rect) => dispatch({ type: 'box/add', id: newBoxId(), rect })}
                onChange={(id, rect) => dispatch({ type: 'box/change', id, rect })}
                onViewChange={onViewChange}
              >
                <StageToolbar
                  zoom={ready ? view?.scale : undefined}
                  ready={ready}
                  canUndo={canUndoCurrent(state)}
                  canRedo={canRedoCurrent(state)}
                  hasBoxes={boxes.length > 0}
                  grid={showGrid}
                  onUndo={commands.undo}
                  onRedo={commands.redo}
                  onAddBox={commands.addBox}
                  onDeleteBox={commands.deleteBox}
                  onZoomIn={commands.zoomIn}
                  onZoomOut={commands.zoomOut}
                  onFit={commands.fit}
                  onGrid={commands.toggleGrid}
                />
              </Stage>
            ) : (
              <EmptyStage busy={busy} sourceName={sources[onlineSource].name} onFiles={() => filesInput.current?.click()} onFolder={() => folderInput.current?.click()} onRandom={() => void random()} onImport={() => importInput.current?.click()} />
            )}
          </div>
          <StatusBar item={item} view={ready ? view : undefined} />
        </main>

        <div className={drawerClass('inspector', 'right')}>
          <Inspector
            classes={state.classes}
            activeClass={state.activeClass}
            boxes={boxes}
            selectedId={state.selectedId}
            status={item ? statusOf(item) : undefined}
            canSubmit={ready && boxes.length > 0}
            onActivateClass={(name) => dispatch({ type: 'class/activate', name })}
            onAddClass={(name) => dispatch({ type: 'class/add', name })}
            onRemoveClass={(name) => dispatch({ type: 'class/remove', name })}
            onRecolorClass={(name, color) => dispatch({ type: 'class/color', name, color })}
            onSelectBox={(id) => dispatch({ type: 'box/select', id })}
            onRelabelBox={(id, label) => dispatch({ type: 'box/label', id, label })}
            onDeleteBox={(id) => dispatch({ type: 'box/delete', id })}
            onSubmit={() => void submit()}
            onSkip={() => dispatch({ type: 'image/step', delta: 1 })}
          />
        </div>

        {drawer && <div className="fixed inset-0 top-14 z-20 bg-black/50 lg:hidden" onClick={() => setDrawer(null)} aria-hidden />}
      </div>

      <input ref={filesInput} type="file" accept="image/*" multiple hidden onChange={(e) => onPicked(e.currentTarget)} data-testid="file-input" />
      <input ref={folderInput} type="file" multiple hidden {...{ webkitdirectory: '' }} onChange={(e) => onPicked(e.currentTarget)} />
      <input ref={importInput} type="file" accept={IMPORT_ACCEPT} multiple hidden onChange={(e) => onPicked(e.currentTarget)} data-testid="import-input" />

      <HelpDialog open={dialog === 'help'} onClose={() => setDialog(null)} />
      <LeaderboardDialog open={dialog === 'leaderboard'} onClose={() => setDialog(null)} rows={rows} me={userName.trim() || DEFAULT_ANNOTATOR} />
      <ExportDialog open={dialog === 'export'} onClose={() => setDialog(null)} totals={totals} onExport={exportAs} />
      <ConfirmDialog request={confirmRequest} onDone={() => setConfirmRequest(null)} />
      <NameDialog
        open={askName && !dialog && !confirmRequest}
        onSave={(name) => {
          if (name) changeName(name);
          setAskName(false);
        }}
      />

      <Toasts toasts={toasts} onDismiss={dismiss} />

      {dropping && (
        <div className="pointer-events-none fixed inset-0 z-50 grid place-items-center bg-ink-950/80 p-8 backdrop-blur-sm">
          <div className="grid w-full max-w-lg place-items-center gap-3 rounded-3xl border-2 border-dashed border-ink-500 px-8 py-14 text-center [animation:drop-pulse_1.2s_ease-in-out_infinite]">
            <Upload size={36} className="text-accent" aria-hidden />
            <p className="text-lg font-semibold text-ink-100">Drop to add images or import annotations</p>
            <p className="text-sm text-ink-400">Folders work too. Annotations: JSON, COCO, YOLO (.txt / .zip), Pascal VOC (.xml / .zip)</p>
          </div>
        </div>
      )}
    </div>
  );

  function onPicked(input: HTMLInputElement) {
    const files = pickedFromInput(input.files);
    input.value = ''; // picking the same files again should fire again
    if (files.length) void handleFiles(files);
  }
}

function EmptyStage({
  busy,
  sourceName,
  onFiles,
  onFolder,
  onRandom,
  onImport,
}: {
  busy: boolean;
  sourceName: string;
  onFiles: () => void;
  onFolder: () => void;
  onRandom: () => void;
  onImport: () => void;
}) {
  if (busy) {
    return (
      <div className="stage-bg grid h-full place-items-center p-6 text-sm text-ink-400" data-testid="fetching">
        <div className="flex items-center gap-3">
          <LoaderCircle className="animate-spin" size={20} aria-hidden /> Fetching a picture from {sourceName}…
        </div>
      </div>
    );
  }
  return (
    <div className="stage-bg grid h-full place-items-center p-6">
      <div className="max-w-md rounded-2xl border border-ink-800 bg-ink-900/90 p-8 text-center shadow-2xl shadow-black/40">
        <p className="text-lg font-semibold text-ink-100">No image open</p>
        <p className="mt-1 text-sm text-ink-400">Drop images or a whole folder on the page, or pick them here.</p>
        <div className="mt-6 grid gap-2 sm:grid-cols-2">
          <Button icon={ImagePlus} onClick={onFiles}>
            Open images
          </Button>
          <Button icon={FolderOpen} onClick={onFolder}>
            Open folder
          </Button>
          <Button icon={Shuffle} onClick={onRandom}>
            From {sourceName}
          </Button>
          <Button icon={Upload} onClick={onImport}>
            Import annotations
          </Button>
        </div>
      </div>
    </div>
  );
}

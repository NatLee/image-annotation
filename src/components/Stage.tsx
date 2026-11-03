import { ImageOff, LoaderCircle } from 'lucide-react';
import { type ReactNode, type Ref, useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { BOX, GRID_DIVISIONS, ZOOM } from '@/config';
import { colorFor } from '@/lib/classes';
import { type View, fitView, moveBox, rectFromPoints, resizeBox, toImagePoint, toScreenRect, zoomAt } from '@/lib/geometry';
import { isEditableTarget } from '@/lib/browser';
import type { BoundingBox, ImageItem, LabelClass, Point, Rect, ResizeHandle, Size } from '@/types';

export interface StageHandle {
  zoomIn(): void;
  zoomOut(): void;
  fit(): void;
}

export interface ViewInfo {
  /** Scale at which the whole image fits (v1's "display" scale). */
  fitScale: number;
  /** Current zoom. */
  scale: number;
}

interface StageProps {
  ref?: Ref<StageHandle>;
  item: ImageItem | undefined;
  boxes: BoundingBox[];
  selectedId: string | null;
  classes: LabelClass[];
  showGrid: boolean;
  onSelect: (id: string | null) => void;
  onDraw: (rect: Rect) => void;
  onChange: (id: string, rect: Rect) => void;
  onViewChange: (info: ViewInfo) => void;
  /** Floating controls drawn over the canvas. */
  children?: ReactNode;
}

type Gesture =
  | { kind: 'pan'; start: Point; view: View }
  | { kind: 'draw'; start: Point; origin: Point }
  | { kind: 'move'; start: Point; box: BoundingBox }
  | { kind: 'resize'; start: Point; box: BoundingBox; handle: ResizeHandle };

type Preview = { kind: 'draw'; rect: Rect } | { kind: 'edit'; id: string; rect: Rect };

const HANDLES: { handle: ResizeHandle; fx: number; fy: number; cursor: string; edge: boolean }[] = [
  { handle: 'nw', fx: 0, fy: 0, cursor: 'nwse-resize', edge: false },
  { handle: 'n', fx: 0.5, fy: 0, cursor: 'ns-resize', edge: true },
  { handle: 'ne', fx: 1, fy: 0, cursor: 'nesw-resize', edge: false },
  { handle: 'e', fx: 1, fy: 0.5, cursor: 'ew-resize', edge: true },
  { handle: 'se', fx: 1, fy: 1, cursor: 'nwse-resize', edge: false },
  { handle: 's', fx: 0.5, fy: 1, cursor: 'ns-resize', edge: true },
  { handle: 'sw', fx: 0, fy: 1, cursor: 'nesw-resize', edge: false },
  { handle: 'w', fx: 0, fy: 0.5, cursor: 'ew-resize', edge: true },
];
const HANDLE_PX = 9;
const CHIP_FONT = '600 11px ui-monospace, "Cascadia Mono", Menlo, Consolas, monospace';

let measureCtx: CanvasRenderingContext2D | null | undefined;
function textWidth(text: string): number {
  if (measureCtx === undefined) measureCtx = document.createElement('canvas').getContext('2d');
  if (!measureCtx) return text.length * 6.6;
  measureCtx.font = CHIP_FONT;
  return measureCtx.measureText(text).width;
}

export function Stage({ ref, item, boxes, selectedId, classes, showGrid, onSelect, onDraw, onChange, onViewChange, children }: StageProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [viewport, setViewport] = useState<Size>({ width: 0, height: 0 });
  // The view follows "fit to screen" until the user zooms or pans.
  const [manualView, setManualView] = useState<View | null>(null);
  const [shownKey, setShownKey] = useState(item?.key);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [cursor, setCursor] = useState<{ point: Point; image: Point | null; overBox: boolean } | null>(null);
  const [spaceHeld, setSpaceHeld] = useState(false);
  /** Kind of the drag in progress, mirrored from `gesture` for rendering. */
  const [active, setActive] = useState<Gesture['kind'] | null>(null);
  const gesture = useRef<Gesture | null>(null);

  // A new image starts fitted again (state reset during render, no effect needed).
  if (shownKey !== item?.key) {
    setShownKey(item?.key);
    setManualView(null);
    setPreview(null);
  }

  const size = item?.size;
  const fit = useMemo(() => (size && viewport.width > 0 ? fitView(size, viewport) : null), [size, viewport]);
  const view = manualView ?? fit;

  // Handlers registered outside React read the latest values from here.
  const latest = useRef({ view, fit });
  useLayoutEffect(() => {
    latest.current = { view, fit };
  });

  // Report zoom changes only (panning does not change them).
  const fitScale = fit?.scale;
  const scale = view?.scale;
  useEffect(() => {
    if (fitScale && scale) onViewChange({ fitScale, scale });
  }, [fitScale, scale, onViewChange]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setViewport({ width, height });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const zoomBy = (factor: number, anchor?: Point) => {
    const current = latest.current.view;
    if (!current) return;
    setManualView(zoomAt(current, factor, anchor ?? { x: viewport.width / 2, y: viewport.height / 2 }));
  };

  useImperativeHandle(ref, () => ({
    zoomIn: () => zoomBy(ZOOM.step),
    zoomOut: () => zoomBy(1 / ZOOM.step),
    fit: () => setManualView(null),
  }));

  // Wheel zoom needs a non-passive listener to stop the page from scrolling.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      const current = latest.current.view;
      if (!current) return;
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const lines = e.deltaMode === WheelEvent.DOM_DELTA_LINE ? 33 : 1;
      const factor = Math.exp(-e.deltaY * lines * ZOOM.wheelSensitivity);
      setManualView(zoomAt(current, factor, { x: e.clientX - rect.left, y: e.clientY - rect.top }));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  // Space held = pan mode; Esc cancels a drag in progress.
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === ' ' && !isEditableTarget(e.target) && !document.querySelector('dialog[open]')) {
        e.preventDefault();
        setSpaceHeld(true);
      }
      if (e.key === 'Escape' && gesture.current) {
        gesture.current = null;
        setPreview(null);
        setActive(null);
      }
    };
    const up = (e: KeyboardEvent) => e.key === ' ' && setSpaceHeld(false);
    const blur = () => setSpaceHeld(false);
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', blur);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', blur);
    };
  }, []);

  const local = (e: React.PointerEvent): Point => {
    const rect = containerRef.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!view || !size) return;
    const point = local(e);
    const target = e.target as Element;
    containerRef.current?.focus({ preventScroll: true });

    if (e.button === 1 || (e.button === 0 && spaceHeld)) {
      e.preventDefault();
      gesture.current = { kind: 'pan', start: point, view };
    } else if (e.button === 0) {
      const handleEl = target.closest<SVGElement>('[data-handle]');
      const boxEl = target.closest<SVGElement>('[data-box-id]');
      const box = boxes.find((b) => b.id === (handleEl ?? boxEl)?.dataset.boxId);
      if (handleEl && box) {
        gesture.current = { kind: 'resize', start: point, box, handle: handleEl.dataset.handle as ResizeHandle };
        onSelect(box.id);
      } else if (box) {
        gesture.current = { kind: 'move', start: point, box };
        onSelect(box.id);
      } else {
        gesture.current = { kind: 'draw', start: point, origin: toImagePoint(view, point) };
        onSelect(null);
      }
    } else {
      return;
    }
    setActive(gesture.current.kind);
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!view || !size) return;
    const point = local(e);
    const image = toImagePoint(view, point);
    const inside = image.x >= 0 && image.y >= 0 && image.x <= size.width && image.y <= size.height;
    setCursor({ point, image: inside ? { x: Math.floor(image.x), y: Math.floor(image.y) } : null, overBox: !!(e.target as Element).closest('[data-box-id]') });

    const g = gesture.current;
    if (!g) return;
    const dx = (point.x - g.start.x) / view.scale;
    const dy = (point.y - g.start.y) / view.scale;
    if (g.kind === 'pan') {
      setManualView({ ...g.view, x: g.view.x + point.x - g.start.x, y: g.view.y + point.y - g.start.y });
    } else if (g.kind === 'draw') {
      setPreview({ kind: 'draw', rect: rectFromPoints(g.origin, image, size) });
    } else if (g.kind === 'move') {
      setPreview({ kind: 'edit', id: g.box.id, rect: moveBox(g.box, dx, dy, size) });
    } else {
      setPreview({ kind: 'edit', id: g.box.id, rect: resizeBox(g.box, g.handle, dx, dy, size) });
    }
  };

  const finish = (e: React.PointerEvent<HTMLDivElement>, commit: boolean) => {
    const g = gesture.current;
    gesture.current = null;
    setActive(null);
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
    if (commit && g && preview) {
      const point = local(e);
      const dragged = Math.hypot(point.x - g.start.x, point.y - g.start.y) >= BOX.minDragScreenPx;
      if (preview.kind === 'draw' && g.kind === 'draw' && dragged && preview.rect.width > 0 && preview.rect.height > 0) onDraw(preview.rect);
      if (preview.kind === 'edit') onChange(preview.id, preview.rect);
    }
    setPreview(null);
  };

  /* ------------------------------------------------------------- render */

  const cursorStyle = active === 'pan' ? 'grabbing' : spaceHeld ? 'grab' : 'crosshair';
  const shown = boxes.map((b) => (preview?.kind === 'edit' && preview.id === b.id ? { ...b, ...preview.rect } : b));
  // Big boxes underneath so small ones stay clickable; the selected one on top.
  const ordered = [...shown].sort((a, b) => (a.id === selectedId ? 1 : b.id === selectedId ? -1 : b.width * b.height - a.width * a.height));
  const imageRect = view && size ? toScreenRect(view, { x: 0, y: 0, ...size }) : null;
  const drawing = preview?.kind === 'draw' ? preview.rect : null;

  return (
    <div
      ref={containerRef}
      tabIndex={0}
      aria-label="Image canvas"
      data-testid="stage"
      className="stage-bg relative h-full w-full touch-none select-none overflow-hidden outline-none"
      style={{ cursor: view ? cursorStyle : 'default' }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={(e) => finish(e, true)}
      onPointerCancel={(e) => finish(e, false)}
      onPointerLeave={() => setCursor(null)}
    >
      {item && size && view && imageRect && (
        <svg className="absolute inset-0 h-full w-full" role="presentation">
          <rect x={imageRect.x - 1} y={imageRect.y - 1} width={imageRect.width + 2} height={imageRect.height + 2} fill="none" stroke="rgb(255 255 255 / 0.08)" />
          <image
            href={item.src}
            x={imageRect.x}
            y={imageRect.y}
            width={imageRect.width}
            height={imageRect.height}
            preserveAspectRatio="none"
            style={{ imageRendering: view.scale > ZOOM.pixelatedAbove ? 'pixelated' : 'auto' }}
          />

          {showGrid && <Grid rect={imageRect} />}

          {cursor && !cursor.overBox && !spaceHeld && (active === null || active === 'draw') && (
            <Crosshair point={cursor.point} rect={imageRect} />
          )}

          {ordered.map((box) => (
            <BoxShape key={box.id} box={box} view={view} color={colorFor(classes, box.label)} selected={box.id === selectedId} />
          ))}

          {drawing && (
            <rect
              {...toScreenRect(view, drawing)}
              fill="rgb(255 255 255 / 0.06)"
              stroke="white"
              strokeWidth={1.5}
              strokeDasharray="6 4"
              data-testid="draw-preview"
            />
          )}
        </svg>
      )}

      {item && !size && !item.failed && (
        <div className="absolute inset-0 grid place-items-center text-ink-400">
          <div className="flex items-center gap-3 text-sm">
            <LoaderCircle className="animate-spin" size={20} aria-hidden /> Loading image…
          </div>
        </div>
      )}

      {item?.failed && (
        <div className="absolute inset-0 grid place-items-center p-6 text-center">
          <div className="max-w-sm">
            <ImageOff className="mx-auto mb-3 text-ink-500" size={36} aria-hidden />
            <p className="font-medium text-ink-200">This image could not be loaded</p>
            <p className="mt-1 break-all text-sm text-ink-500">{item.key}</p>
          </div>
        </div>
      )}

      {cursor?.image && (
        <div className="pointer-events-none absolute left-3 top-3 rounded-md bg-ink-950/75 px-2 py-1 font-mono text-[11px] text-ink-300 backdrop-blur" data-testid="cursor">
          x {cursor.image.x} · y {cursor.image.y}
        </div>
      )}

      {children}
    </div>
  );
}

function Grid({ rect }: { rect: Rect }) {
  const lines = [];
  for (let i = 1; i < GRID_DIVISIONS; i++) {
    const x = rect.x + (rect.width * i) / GRID_DIVISIONS;
    const y = rect.y + (rect.height * i) / GRID_DIVISIONS;
    lines.push(<line key={`v${i}`} x1={x} x2={x} y1={rect.y} y2={rect.y + rect.height} />);
    lines.push(<line key={`h${i}`} y1={y} y2={y} x1={rect.x} x2={rect.x + rect.width} />);
  }
  return (
    <g stroke="rgb(244 63 94 / 0.6)" strokeWidth={1} pointerEvents="none" data-testid="grid">
      {lines}
    </g>
  );
}

function Crosshair({ point, rect }: { point: Point; rect: Rect }) {
  if (point.x < rect.x || point.y < rect.y || point.x > rect.x + rect.width || point.y > rect.y + rect.height) return null;
  return (
    <g stroke="rgb(255 255 255 / 0.45)" strokeWidth={1} strokeDasharray="4 4" pointerEvents="none">
      <line x1={rect.x} x2={rect.x + rect.width} y1={point.y} y2={point.y} />
      <line y1={rect.y} y2={rect.y + rect.height} x1={point.x} x2={point.x} />
    </g>
  );
}

function Chip({ x, y, text, color, dark }: { x: number; y: number; text: string; color: string; dark?: boolean }) {
  const width = textWidth(text) + 12;
  return (
    <g transform={`translate(${x} ${y})`} pointerEvents="none">
      <rect width={width} height={18} rx={4} fill={dark ? 'rgb(8 9 12 / 0.82)' : color} />
      <text x={6} y={12.5} fill={dark ? '#eceff4' : '#08090c'} style={{ font: CHIP_FONT }}>
        {text}
      </text>
    </g>
  );
}

function BoxShape({ box, view, color, selected }: { box: BoundingBox; view: View; color: string; selected: boolean }) {
  const r = toScreenRect(view, box);
  const label = `${box.label}  ${Math.round(box.width)}×${Math.round(box.height)}`;
  // Put the label above the box, or inside it when the box touches the top.
  const labelY = r.y >= 20 ? r.y - 20 : r.y + 2;
  const small = r.width < 44 || r.height < 44;
  return (
    <g data-box-id={box.id} data-testid="box" data-selected={selected || undefined} style={{ cursor: 'move' }}>
      <rect x={r.x} y={r.y} width={r.width} height={r.height} fill={color} fillOpacity={selected ? 0.14 : 0.08} stroke={color} strokeWidth={selected ? 2.5 : 1.75} />
      {selected && <rect x={r.x - 3} y={r.y - 3} width={r.width + 6} height={r.height + 6} fill="none" stroke={color} strokeOpacity={0.35} strokeWidth={1} />}
      <Chip x={Math.max(0, r.x - 1)} y={labelY} text={label} color={color} />
      {selected && <Chip x={r.x} y={r.y + r.height + 4} text={`x ${Math.round(box.x)}  y ${Math.round(box.y)}`} color={color} dark />}
      {selected &&
        HANDLES.filter((h) => !(h.edge && small)).map((h) => (
          <rect
            key={h.handle}
            data-box-id={box.id}
            data-handle={h.handle}
            x={r.x + r.width * h.fx - HANDLE_PX / 2}
            y={r.y + r.height * h.fy - HANDLE_PX / 2}
            width={HANDLE_PX}
            height={HANDLE_PX}
            rx={2}
            fill="#fff"
            stroke={color}
            strokeWidth={2}
            style={{ cursor: h.cursor }}
          />
        ))}
    </g>
  );
}

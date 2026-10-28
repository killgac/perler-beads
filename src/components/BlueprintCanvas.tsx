// 图纸渲染：Canvas 画色块 + 网格线 + 色号标记 + PNG/PDF 导出；滑动条缩放查看（初次自适应整图）
// 拖涂：按住左键拖过格子连续上色/擦除；用量选中色红色描边高亮全部同色格；一键清空需确认
import { useEffect, useRef, useState } from 'react';
import { jsPDF } from 'jspdf';
import type { BeadColor, Grid } from '../types';

interface Props {
  grid: Grid;
  palette: BeadColor[];
  selectedColor: number | null;
  eraser: boolean;
  highlightColor: number | null;
  canUndo: boolean;
  canRedo: boolean;
  onStrokeStart: () => void;
  onStrokeEnd: (changed: boolean) => void;
  onPickCell: (x: number, y: number) => boolean;
  onClear: () => void;
  onUndo: () => void;
  onRedo: () => void;
  highlight: { x: number; y: number } | null;
  onHoverCell: (pos: { x: number; y: number } | null) => void;
  onCanvasReady: (canvas: HTMLCanvasElement | null) => void;
  // P1 脏格回写：画布改格后立即单格重画，不等 React 整图重绘
  onCellPainted: (x: number, y: number, value: number) => void;
}

const CELL = 28; // 每颗豆边长（px），保证色号字可读
const MIN_ZOOM = 0.1;
const MAX_ZOOM = 3;
const MAX_BACKING = 2048; // 显示画布 backing 长边上限：超限自动缩小格宽，防移动端 GPU 分配失败白屏

/** 显示用格宽：整图 backing 长边不超过 MAX_BACKING（移动端防白屏），导出不受影响 */
export function displayCell(w: number, h: number): number {
  const longest = Math.max(w, h, 1);
  if (longest * CELL <= MAX_BACKING) return CELL;
  return Math.max(10, Math.floor(MAX_BACKING / longest));
}

/** 图纸绘制共用函数：导出 PNG 与屏幕显示用同一套绘制；highlight 仅屏幕显示用 */
export function drawBlueprint(
  canvas: HTMLCanvasElement,
  grid: Grid,
  palette: BeadColor[],
  highlight?: { x: number; y: number } | null,
  highlightColor?: number | null,
  cellSize: number = CELL,
  // 导出色号开关：显示画布与脏格回写沿用 true；导出按开关走
  withCodes: boolean = true,
): void {
  const h = grid.length;
  const w = grid[0]?.length ?? 0;
  canvas.width = w * cellSize;
  canvas.height = h * cellSize;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      drawBlueprintCellRich(ctx, grid, palette, x, y, highlightColor, highlight, cellSize, withCodes);
    }
  }

  // 同色全部格红色描边（用量统计选中色；屏幕显示用，导出不传即无框）
  if (highlightColor !== null && highlightColor !== undefined) {
    ctx.strokeStyle = '#ff0000';
    ctx.lineWidth = 2;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (grid[y][x] === highlightColor) {
          ctx.strokeRect(x * cellSize + 1, y * cellSize + 1, cellSize - 2, cellSize - 2);
        }
      }
    }
  }

  // 悬停格高亮框（屏幕显示用，导出时不传 highlight 即无框）
  if (highlight) {
    ctx.strokeStyle = '#ff0000';
    ctx.lineWidth = 3;
    ctx.strokeRect(highlight.x * cellSize + 1.5, highlight.y * cellSize + 1.5, cellSize - 3, cellSize - 3);
  }
}

/** 单格绘制内核：整图绘制与 P1 脏格重画共用；cellSize 供 E2 导出自适应 */
function drawBlueprintCellRich(
  ctx: CanvasRenderingContext2D,
  grid: Grid,
  palette: BeadColor[],
  x: number,
  y: number,
  highlightColor?: number | null,
  highlight?: { x: number; y: number } | null,
  cellSize: number = CELL,
  // 导出色号开关：false 时只画纯色块不写字
  withCodes: boolean = true,
): void {
  const bead = palette[grid[y]?.[x] ?? -1];
  const px = x * cellSize;
  const py = y * cellSize;
  ctx.fillStyle = bead ? bead.hex : '#ffffff';
  ctx.fillRect(px, py, cellSize, cellSize);
  ctx.strokeStyle = '#999999';
  ctx.lineWidth = 1;
  ctx.strokeRect(px + 0.5, py + 0.5, cellSize - 1, cellSize - 1);
  if (bead && withCodes && cellSize >= 12) {
    const [r, g, b] = bead.rgb;
    const light = (r * 299 + g * 587 + b * 114) / 1000 > 140;
    ctx.fillStyle = light ? '#000000' : '#ffffff';
    ctx.font = `${Math.max(9, Math.round(cellSize * 0.32))}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(bead.code, px + cellSize / 2, py + cellSize / 2);
  }
  if (highlightColor !== null && highlightColor !== undefined && grid[y]?.[x] === highlightColor) {
    ctx.strokeStyle = '#ff0000';
    ctx.lineWidth = 2;
    ctx.strokeRect(px + 1, py + 1, cellSize - 2, cellSize - 2);
  }
  if (highlight && highlight.x === x && highlight.y === y) {
    ctx.strokeStyle = '#ff0000';
    ctx.lineWidth = 3;
    ctx.strokeRect(px + 1.5, py + 1.5, cellSize - 3, cellSize - 3);
  }
}

/** 单格绘制：P1 拖涂脏格重画只画改动格（先清 hover 框再画格再补回框） */
export function drawBlueprintCell(
  canvas: HTMLCanvasElement,
  grid: Grid,
  palette: BeadColor[],
  x: number,
  y: number,
  highlightColor?: number | null,
  highlight?: { x: number; y: number } | null,
  cellSize: number = CELL,
): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  drawBlueprintCellRich(ctx, grid, palette, x, y, highlightColor, highlight, cellSize);
}

export function downloadPNG(canvas: HTMLCanvasElement): void {
  const a = document.createElement('a');
  a.href = canvas.toDataURL('image/png');
  a.download = 'perler-blueprint.png';
  a.click();
}

/** E2 导出显示分离：按边限 3000px 缩小格宽重绘离屏图再导出（原 256 宽 ×28px 单边超 7000px 易失败） */
export function exportCellSize(grid: Grid): number {
  const longest = Math.max(grid[0]?.length ?? 0, grid.length, 1);
  if (longest <= 0) return CELL;
  return Math.max(8, Math.min(CELL, Math.floor(3000 / longest)));
}

/** 导出前置校验：空图或畸形行直接抛错，由按钮 title/禁用配合，不产空文件 */
function assertExportable(grid: Grid): void {
  const h = grid.length;
  const w = grid[0]?.length ?? 0;
  if (h <= 0 || w <= 0) throw new Error('图纸为空，无法导出');
  if (!grid.every((row) => Array.isArray(row) && row.length === w)) {
    throw new Error('图纸数据异常，请重新生成后再导出');
  }
}

/** E2 用自适应格宽重绘离屏 canvas 再导出（显示 canvas 不动） */
export function downloadPNGAdaptive(grid: Grid, palette: BeadColor[], withCodes: boolean = true): void {
  assertExportable(grid);
  const off = document.createElement('canvas');
  drawBlueprint(off, grid, palette, null, null, exportCellSize(grid), withCodes);
  const a = document.createElement('a');
  a.href = off.toDataURL('image/png');
  a.download = withCodes ? 'perler-blueprint.png' : 'perler-preview.png';
  a.click();
}

/** PDF：一页图纸图 + 一页用色表（E2 图纸页同 PNG 用自适应离屏图，不过大 canvas） */
export function downloadPDF(grid: Grid, palette: BeadColor[], withCodes: boolean = true): void {
  assertExportable(grid);
  const pdf = new jsPDF({ unit: 'mm', format: 'a4' });
  const pageW = 210;
  const margin = 10;
  const maxW = pageW - margin * 2;

  // 第1页：图纸（离屏自适应图，不读显示 canvas）
  const off = document.createElement('canvas');
  drawBlueprint(off, grid, palette, null, null, exportCellSize(grid), withCodes);
  const imgData = off.toDataURL('image/png');
  const ratio = off.height / off.width;
  let imgW = maxW;
  let imgH = imgW * ratio;
  const maxH = 277;
  if (imgH > maxH) {
    imgH = maxH;
    imgW = imgH / ratio;
  }
  // jsPDF 内置字体无中文：标题与表头用英文，避免中文乱码
  pdf.setFontSize(14);
  pdf.text('Perler Blueprint', margin, margin);
  pdf.addImage(imgData, 'PNG', margin, margin + 5, imgW, imgH);

  // 第2页：用色表（色号 × 颗数）
  const counts = new Map<number, number>();
  for (const row of grid) for (const idx of row) counts.set(idx, (counts.get(idx) ?? 0) + 1);
  pdf.addPage();
  pdf.setFontSize(14);
  pdf.text('Color Usage', margin, margin);
  pdf.setFontSize(10);
  let y = margin + 10;
  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  for (const [idx, n] of sorted) {
    const bead = palette[idx];
    if (!bead) continue;
    // 色盘颜色名本身是英文：只写 code + name + 数量，不拼中文
    pdf.text(`${bead.code}  ${bead.name}  x ${n}`, margin, y);
    y += 6;
    if (y > 285) {
      pdf.addPage();
      y = margin + 10;
    }
  }
  pdf.save(withCodes ? 'perler-blueprint.pdf' : 'perler-preview.pdf');
}

export default function BlueprintCanvas({ grid, palette, selectedColor, eraser, highlightColor, canUndo, canRedo, onStrokeStart, onStrokeEnd, onPickCell, onClear, onUndo, onRedo, highlight, onHoverCell, onCanvasReady, onCellPainted }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  // 本笔是否真正改过格：落笔无变化时抬笔丢弃快照，不占撤销额度
  const strokeChanged = useRef(false);
  // 初次自适应整图：按容器宽度算 fit 缩放；之后用户用滑动条调不再自动变
  const [zoom, setZoom] = useState<number | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);

  // 拖涂每格只画该格：hover 变化不经过 grid 引用，整图重绘 effect 拆开
  // hover/highlight 只做框的重画（清掉旧框画新框），grid/palette 变化才整图重绘
  const gridRef = useRef(grid);
  gridRef.current = grid;
  const paletteRef = useRef(palette);
  paletteRef.current = palette;
  const highlightColorRef = useRef(highlightColor);
  highlightColorRef.current = highlightColor;
  const prevHighlight = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    if (ref.current) {
      drawBlueprint(ref.current, gridRef.current, paletteRef.current, null, highlightColorRef.current, displayCell(gridRef.current[0]?.length ?? 0, gridRef.current.length));
      // 整图重绘后按当前 hover 补框
      if (highlight && ref.current) {
        const c = ref.current.getContext('2d');
        if (c) {
          const cs = displayCell(gridRef.current[0]?.length ?? 0, gridRef.current.length);
          c.strokeStyle = '#ff0000';
          c.lineWidth = 3;
          c.strokeRect(highlight.x * cs + 1.5, highlight.y * cs + 1.5, cs - 3, cs - 3);
        }
      }
      prevHighlight.current = highlight;
      onCanvasReady(ref.current);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [grid, palette, highlightColor]);

  // hover 单独处理：只擦旧框画新框，不整图重绘（P1 补全：拖涂连续 hover 不再全量重绘）
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const g = gridRef.current;
    const p = paletteRef.current;
    const hc = highlightColorRef.current;
    const cs = displayCell(g[0]?.length ?? 0, g.length);
    const prev = prevHighlight.current;
    // 擦掉旧 hover 框：重画该格（含同色红框还原）
    if (prev && (!highlight || prev.x !== highlight.x || prev.y !== highlight.y)) {
      drawBlueprintCell(canvas, g, p, prev.x, prev.y, hc, null, cs);
    }
    // 画新 hover 框：重画该格再补框
    if (highlight && (!prev || prev.x !== highlight.x || prev.y !== highlight.y)) {
      drawBlueprintCell(canvas, g, p, highlight.x, highlight.y, hc, highlight, cs);
    }
    prevHighlight.current = highlight;
  }, [highlight]);

  // grid 尺寸变化（新图/新画布）时回到自适应；仅 hover 变化不触发
  // 自适应含义：初始缩放让整图宽度正好占满容器；移动端容器窄时算出的缩放很小，
  // 需放行到 MIN_ZOOM（0.1），否则卡在 0.2 下限会被放大裁切
  const gridKey = `${grid.length}x${grid[0]?.length ?? 0}`;
  useEffect(() => {
    setZoom(fitZoom(grid[0]?.length ?? 0));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gridKey]);

  // gridKey 变化且容器尚无宽度（如移动端单列刚切布局）时补算一次，避免 zoom 永久为 null
  useEffect(() => {
    if (zoom !== null) return;
    const w = grid[0]?.length ?? 0;
    if (w <= 0) return;
    const t = window.setTimeout(() => setZoom(fitZoom(w)), 60);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zoom, gridKey]);

  const z = zoom ?? 1;
  // 显示格宽：容器超窄时缩小 backing，避免 canvas 实际像素过大在移动端 GPU 分配失败
  // 导出走 E2 自适应离屏图，不受影响
  const cell = displayCell(grid[0]?.length ?? 0, grid.length);

  function fitZoom(w: number): number {
    const boxW = boxRef.current?.clientWidth ?? 0;
    if (w > 0 && boxW > 0) {
      return Math.min(1.5, Math.max(MIN_ZOOM, boxW / (w * CELL)));
    }
    return 1;
  }

  function resetView() {
    setZoom(fitZoom(grid[0]?.length ?? 0));
    onHoverCell(null);
  }

  function cellFromEvent(e: React.MouseEvent<HTMLCanvasElement> | React.PointerEvent<HTMLCanvasElement>): { x: number; y: number } | null {
    const canvas = ref.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = Math.floor(((e.clientX - rect.left) * scaleX) / cell);
    const y = Math.floor(((e.clientY - rect.top) * scaleY) / cell);
    if (x < 0 || y < 0 || y >= grid.length || x >= (grid[0]?.length ?? 0)) return null;
    return { x, y };
  }

  // q4 窗口级抬起兜底：拖出画布/窗口松开也能结束本笔，不残留 dragging
  // q3 触屏：指针事件统一鼠标/触控；触摸拖涂需禁默认滚动（touch-action: none）
  const endStrokeRef = useRef(() => {});
  useEffect(() => {
    function onUp() {
      endStrokeRef.current();
    }
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    return () => {
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function paintAt(pos: { x: number; y: number } | null) {
    if (pos && onPickCell(pos.x, pos.y)) {
      strokeChanged.current = true;
      onCellPainted(pos.x, pos.y, eraser ? -1 : (selectedColor ?? -1));
    }
  }

  function moveHoverAndPaint(e: React.PointerEvent<HTMLCanvasElement>) {
    const pos = cellFromEvent(e);
    onHoverCell(pos);
    if (dragging.current && pos) paintAt(pos);
  }

  function endStroke() {
    if (dragging.current) onStrokeEnd(strokeChanged.current);
    dragging.current = false;
    strokeChanged.current = false;
  }
  endStrokeRef.current = endStroke;

  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
      <div style={{ padding: '16px 16px 0' }}>
        <div className="card-title"><span className="step">4</span>图纸</div>
        <p className="card-desc">
          {selectedColor === null && !eraser
            ? '先在左侧色盘或右侧用量统计中点选一种颜色再点图纸换色'
            : eraser
              ? '当前为橡皮：点击图纸格子擦为空白'
              : `当前换色：${selectedColor !== null ? palette[selectedColor]?.code ?? '' : ''} ${selectedColor !== null ? palette[selectedColor]?.name ?? '' : ''}（点击图纸格子换色）`}
        </p>
      </div>
      <div
        ref={boxRef}
        className="canvas-wrap"
        style={{ border: 0, borderTop: '1px solid var(--border)', borderRadius: 0 }}
      >
        <canvas
          ref={ref}
          style={{
            cursor: selectedColor === null && !eraser ? 'default' : 'pointer',
            // CSS 缩放显示：canvas 实际像素不变，导出不受影响；点击坐标换算已考虑缩放
            width: (grid[0]?.length ?? 0) * cell * z,
            height: grid.length * cell * z,
            maxWidth: '100%',
            touchAction: 'none',
          }}
          onPointerDown={(e) => {
            // q3 触屏左键/触控落笔：只处理主按钮与触控点
            if (e.pointerType === 'mouse' && e.button !== 0) return;
            dragging.current = true;
            strokeChanged.current = false;
            onStrokeStart();
            paintAt(cellFromEvent(e));
            // q4 指针捕获期间窗外抬起也能收到；捕获失败不影响窗口级兜底
            try {
              (e.target as HTMLCanvasElement).setPointerCapture(e.pointerId);
            } catch {
              // 忽略
            }
          }}
          onPointerMove={(e) => {
            moveHoverAndPaint(e);
          }}
          onPointerUp={() => {
            endStroke();
          }}
          onPointerCancel={() => {
            endStroke();
          }}
          onPointerLeave={(e) => {
            // 捕获拖涂中离开不结束（窗外松开由 pointerup 收尾）；非拖涂离开清 hover
            if (!dragging.current) onHoverCell(null);
            else {
              const pos = cellFromEvent(e);
              if (pos) moveHoverAndPaint(e);
            }
          }}
        />
      </div>
      <div className="toolbar" style={{ padding: '0 16px 16px', borderTop: 0 }}>
        <label className="zoom">
          缩放
          <input
            type="range"
            min={MIN_ZOOM}
            max={MAX_ZOOM}
            step={0.05}
            value={z}
            onChange={(e) => setZoom(Number(e.target.value))}
          />
          <span>{Math.round(z * 100)}%</span>
        </label>
        <button type="button" className="btn" onClick={resetView}>
          自适应整图
        </button>
        {confirmClear ? (
          <>
            <span className="hint">确定清空整张图纸？</span>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                onClear();
                setConfirmClear(false);
              }}
            >
              确认清空
            </button>
            <button type="button" className="btn" onClick={() => setConfirmClear(false)}>
              取消
            </button>
          </>
        ) : (
          <button type="button" className="btn" onClick={() => setConfirmClear(true)}>
            一键清空
          </button>
        )}
        <button type="button" className="btn" disabled={!canUndo} onClick={onUndo}>
          撤销
        </button>
        <button type="button" className="btn" disabled={!canRedo} onClick={onRedo}>
          恢复
        </button>
      </div>
    </div>
  );
}

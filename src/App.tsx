// 主状态：上传/空白 → 像素化 → 匹配 → 预览 → 图纸 → 导出（Perler / Artkal / Hama 三品牌）
// UI 为三栏工作台：左栏取色 / 中间图纸 / 右栏设置与用量（仅布局，不改交互流程）
import { useEffect, useRef, useState } from 'react';
import type { BeadColor, Grid, Palette, RGB } from './types';
import perlerData from './data/palettes/perler.json';
import artkalData from './data/palettes/artkal.json';
import hamaData from './data/palettes/hama.json';
import { loadImageFile, pixelate } from './lib/image';
import { matchGrid } from './lib/colorMatch';
import { loadWork, saveWork, sanitizeGrid } from './lib/storage';
import Uploader from './components/Uploader';
import SizePanel from './components/SizePanel';
import PaletteSelector from './components/PaletteSelector';
import PreviewCompare from './components/PreviewCompare';
import BlueprintCanvas, { displayCell, drawBlueprintCell } from './components/BlueprintCanvas';
import ColorStats from './components/ColorStats';
import ExportPanel from './components/ExportPanel';
import BlankEditor from './components/BlankEditor';
import PalettePanel, { newBlankGrid } from './components/PalettePanel';
import PreviewModal from './components/PreviewModal';

type RawPalette = {
  id: string;
  brand: string;
  product: string;
  source: string;
  count: number;
  colors: { code: string; name: string; hex: string; rgb: [number, number, number] }[];
};

function toPalette(raw: RawPalette): Palette {
  return {
    id: raw.id,
    brand: raw.brand,
    product: raw.product,
    source: raw.source,
    count: raw.colors.length,
    colors: raw.colors.map((c) => ({ code: c.code, name: c.name, hex: c.hex, rgb: c.rgb })),
  };
}

const palettes: Palette[] = [
  toPalette(perlerData as RawPalette),
  toPalette(artkalData as RawPalette),
  toPalette(hamaData as RawPalette),
];

type Mode = 'upload' | 'blank';

export default function App() {
  const [mode, setMode] = useState<Mode>('upload');
  const [targetWidth, setTargetWidth] = useState(48);
  const [blankSize, setBlankSize] = useState(32);
  const [eraser, setEraser] = useState(false);
  const [brandId, setBrandId] = useState('perler');
  const [pixels, setPixels] = useState<RGB[][] | null>(null); // 像素化中间结果，切品牌时重匹配用
  const [sourceUrl, setSourceUrl] = useState<string | null>(null);
  const [grid, setGrid] = useState<Grid | null>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [error, setError] = useState<string | null>(null);
  const [working, setWorking] = useState(false);
  const [selectedColor, setSelectedColor] = useState<number | null>(null);
  const [hoverCell, setHoverCell] = useState<{ x: number; y: number } | null>(null);
  const [blueprintCanvas, setBlueprintCanvas] = useState<HTMLCanvasElement | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  // P3 差异快照：只存本笔改过的格（x,y,旧值），内存与复制开销随改格数走
  // 新动作格式：patch 存散格差异（undo 回旧值，redo 写新值），不再存整图；
  // rows 存整行动差异（一键清空/整图换色/切品牌重算用），全图一色替换 256×256 只存 256 行引用
  type CellPatch = { x: number; y: number; prev: number };
  type HistoryStep =
    | { kind: 'patch'; undo: CellPatch[]; redo: CellPatch[] }
    | { kind: 'rows'; y0: number; prevRows: number[][]; nextRows: number[][] };
  // 撤销/恢复：只记点画拖涂与一键清空，一笔算一次，最多保留 10 步
  const [undoStack, setUndoStack] = useState<HistoryStep[]>([]);
  const [redoStack, setRedoStack] = useState<HistoryStep[]>([]);
  // 本笔待定快照：落笔时暂存，抬笔无变化则丢弃
  // P3 改为收集本笔改格记录：key=`y:x`，值为落笔前旧值
  const pendingHistory = useRef<Map<string, CellPatch> | null>(null);
  // 快捷键回调引用：避免 keydown 监听闭包拿到旧栈
  const handleUndoRef = useRef(() => {});
  const handleRedoRef = useRef(() => {});

  const palette: BeadColor[] = palettes.find((p) => p.id === brandId)?.colors ?? [];

  // 启动时恢复上次作品仅图纸数据原图不恢复品牌 id 非法时回退 perler
  useEffect(() => {
    const saved = loadWork();
    if (saved && palettes.some((p) => p.id === saved.brandId)) {
      // q11 越界兜底：旧存档下标超当前品牌色盘时钳为 -1，不静默丢格
      const brand = palettes.find((p) => p.id === saved.brandId);
      const colorCount = brand?.colors.length ?? 0;
      setBrandId(saved.brandId);
      setGrid(sanitizeGrid(saved.grid, colorCount));
      setSize({ width: saved.width, height: saved.height });
      setMode('upload');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // grid品牌尺寸变化时自动存档：写满/隐私模式失败时提示一次，不静默丢稿
  const saveFailedRef = useRef(false);
  useEffect(() => {
    if (grid) {
      const ok = saveWork({ brandId, width: size.width, height: size.height, grid });
      if (!ok && !saveFailedRef.current) {
        saveFailedRef.current = true;
        setError('本地存档空间不足，本次改动未保存（导出 PNG/PDF 不受影响）');
      } else if (ok) {
        saveFailedRef.current = false;
      }
    }
  }, [grid, brandId, size]);

  // E1 撤销快捷键：Ctrl+Z 撤销，Ctrl+Shift+Z / Ctrl+Y 恢复；输入框内不拦截
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (!e.ctrlKey && !e.metaKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return;
      const key = e.key.toLowerCase();
      if (key === 'z' && !e.shiftKey) {
        e.preventDefault();
        handleUndoRef.current();
      } else if ((key === 'z' && e.shiftKey) || key === 'y') {
        e.preventDefault();
        handleRedoRef.current();
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
    // 依赖里放栈长度即可，避免 grid 大引用抖动重复绑监听
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [undoStack.length, redoStack.length]);

  // 上传竞态防护：快速连选两张图时，只采用最后一次的结果，旧请求回来了直接丢弃
  const fileSeq = useRef(0);

  async function handleFile(file: File) {
    const seq = ++fileSeq.current;
    setError(null);
    setWorking(true);
    // 释放上一张图的 objectURL避免内存泄漏
    if (sourceUrl) URL.revokeObjectURL(sourceUrl);
    try {
      const { img, url } = await loadImageFile(file);
      // 期间用户又选了新图：释放本次 URL 并丢弃结果
      if (seq !== fileSeq.current) {
        URL.revokeObjectURL(url);
        return;
      }
      const { width, height, pixels: px } = pixelate(img, targetWidth);
      const active = palettes.find((p) => p.id === brandId)?.colors ?? [];
      setPixels(px);
      setGrid(matchGrid(px, active));
      setSize({ width, height });
      setSourceUrl(url);
      setSelectedColor(null);
      setHoverCell(null);
      setUndoStack([]);
      setRedoStack([]);
    } catch (e) {
      // 竞态丢弃的旧请求不报错、不清空当前图
      if (seq !== fileSeq.current) return;
      setError(e instanceof Error ? e.message : '处理失败');
      setGrid(null);
      setSourceUrl(null);
    } finally {
      if (seq === fileSeq.current) setWorking(false);
    }
  }

  // 巨型快照封顶：整图多格变化按行压缩记（每行记旧行引用+改后行），
  // 全图一色替换 256×256 只存 256 行引用，不再存 6 万个 patch 对象
  // 新动作统一记 {undo,redo} 双向 patch：undo 回旧值，redo 写新值，两边都是差异
  function recordStep(step: HistoryStep) {
    if (step.kind === 'patch' && step.undo.length === 0) return;
    setUndoStack((stack) => [...stack.slice(-9), step]);
    setRedoStack([]);
  }

  // 散格变化记 patch（点画拖涂）；整图行变化记 rows（一键清空/换色/切品牌）
  function recordPatch(undo: CellPatch[], redo: CellPatch[]) {
    recordStep({ kind: 'patch', undo, redo });
  }

  // 行级快照：给整图新旧两份 grid，只收发生变化的行
  function recordRowDiff(prev: Grid, next: Grid) {
    const prevRows: number[][] = [];
    const nextRows: number[][] = [];
    let y0 = -1;
    for (let y = 0; y < prev.length; y++) {
      const a = prev[y];
      const b = next[y];
      let same = a.length === b.length;
      if (same) {
        for (let x = 0; x < a.length; x++) {
          if (a[x] !== b[x]) {
            same = false;
            break;
          }
        }
      }
      if (!same) {
        if (y0 < 0) y0 = y;
        prevRows.push(a);
        nextRows.push(b);
      }
    }
    if (y0 >= 0) recordStep({ kind: 'rows', y0, prevRows, nextRows });
  }

  function pushHistory(prev: Grid) {
    // 一键清空：新图全 -1，与原图做行差异（只存变化行）
    recordRowDiff(
      prev,
      prev.map((row) => row.map(() => -1)),
    );
  }

  // 历史应用：patch 逐格写，rows 整行换（行级复制，只碰被改行）
  function applyStep(prev: Grid, step: HistoryStep, dir: 'undo' | 'redo'): Grid {
    if (step.kind === 'patch') {
      return applyPatch(prev, step[dir]);
    }
    const rows = dir === 'undo' ? step.prevRows : step.nextRows;
    const next = prev.slice();
    for (let i = 0; i < rows.length; i++) {
      const y = step.y0 + i;
      if (next[y]) next[y] = [...rows[i]];
    }
    return next;
  }

  // 差异快照应用：把 patch 旧值写回（行级复制，只碰被改行）
  // patch 通用：undo 侧 prev=旧值，redo 侧 prev=新值，同一函数双向可用
  function applyPatch(prev: Grid, patch: CellPatch[]): Grid {
    const next = prev.slice();
    const touched = new Set<number>();
    for (const { y } of patch) {
      if (!touched.has(y) && next[y]) {
        next[y] = prev[y].slice();
        touched.add(y);
      }
    }
    for (const { x, y, prev: v } of patch) {
      if (next[y] && x >= 0 && x < next[y].length) next[y][x] = v;
    }
    return next;
  }

  // 切换品牌图片模式用保留的像素数据重跑匹配手动改过的格子会被重算覆盖空白模式格子保持不动
  // q5 切品牌丢手改且不可撤销：重算前把当前 grid 记一笔差异快照，可撤销回来
  // 切品牌闪错色修复：先算出新图再一次性切品牌+换图，中间无新色盘配旧图的一帧
  function handleBrandChange(id: string) {
    if (id === brandId) return;
    if (mode === 'upload' && pixels && grid) {
      const active = palettes.find((p) => p.id === id)?.colors ?? [];
      const next = matchGrid(pixels, active);
      recordRowDiff(grid, next);
      // 无变化也切品牌（仅换色盘展示），有变化才换图
      setBrandId(id);
      setGrid(next);
      setSelectedColor(null);
    } else {
      setBrandId(id);
      setSelectedColor(null);
    }
  }

  // 图纸点格橡皮模式擦除为空白-1否则写入选中色未选色时不动作（拖涂共用同一入口）
  // 一笔只记一次：落笔开收集器记录旧值（strokeStart），抬笔无变化则丢弃（strokeEnd）
  function handleStrokeStart() {
    pendingHistory.current = new Map();
  }

  function handleStrokeEnd(changed: boolean) {
    // P3 本笔 redo 由“旧值→新值”推导：旧值在收集器，新值读当前 grid
    if (changed && pendingHistory.current && pendingHistory.current.size > 0 && grid) {
      const undo = [...pendingHistory.current.values()];
      const redo: CellPatch[] = [];
      for (const { x, y } of undo) {
        if (grid[y] && x < grid[y].length) redo.push({ x, y, prev: grid[y][x] });
      }
      recordPatch(undo, redo);
    }
    pendingHistory.current = null;
  }

  // 返回是否真正改格，供画布标记本笔是否有效
  // P1 节流合并：同值格直接跳过不 setGrid，连续拖涂不再每格全量重算重绘
  // P2 行级复制：只拷贝被改行，其余行复用引用（原 map 全行回调改为 slice + 单行拷贝）
  // 点格越界防护：调用方已验格，此处再验一次，以后别的入口复用不踩坑
  function handlePickCell(x: number, y: number): boolean {
    if (!grid) return false;
    if (!Number.isInteger(x) || !Number.isInteger(y)) return false;
    if (y < 0 || y >= grid.length) return false;
    if (!grid[y] || x < 0 || x >= grid[y].length) return false;
    const value = eraser ? -1 : selectedColor;
    if (value === null) return false;
    if (grid[y][x] === value) return false;
    // 落笔前旧值记入本笔收集器（同格重复经过只记第一次旧值）
    if (pendingHistory.current) {
      const key = `${y}:${x}`;
      if (!pendingHistory.current.has(key)) {
        pendingHistory.current.set(key, { x, y, prev: grid[y][x] });
      }
    }
    setGrid((prev) => {
      if (!prev) return prev;
      if (prev[y][x] === value) return prev;
      const next = prev.slice();
      const newRow = prev[y].slice();
      newRow[x] = value;
      next[y] = newRow;
      return next;
    });
    return true;
  }

  // P1 脏格回写：单格改完立即只画该格（canvas 引用由图纸回传）
  // 需用“改后值”画格：grid 状态异步，用值直接拼一行画，不读旧 grid
  // hover 框残留防护：脏格回写后若该格正是 hover 格，补画 hover 框
  function handleCellPainted(x: number, y: number, value: number) {
    if (!blueprintCanvas || !grid) return;
    if (!grid[y] || x < 0 || x >= grid[y].length) return;
    const painted: Grid = grid.slice();
    const newRow = grid[y].slice();
    newRow[x] = value;
    painted[y] = newRow;
    const isHover = hoverCell !== null && hoverCell.x === x && hoverCell.y === y;
    const cs = displayCell(grid[0]?.length ?? 0, grid.length);
    drawBlueprintCell(blueprintCanvas, painted, palette, x, y, eraser ? null : selectedColor, isHover ? hoverCell : null, cs);
  }

  // 一键清空：整张图纸全部置为空白-1（记一次撤销）
  function handleClearGrid() {
    if (!grid) return;
    pushHistory(grid);
    setGrid(grid.map((row) => row.map(() => -1)));
  }

  // 用色统计整体换色：把全图 from 一键换成 to（行差异快照记一笔，可撤销；返回替换颗数）
  function handleReplaceColor(from: number, to: number): number {
    if (!grid || from === to) return 0;
    let count = 0;
    const next = grid.slice();
    for (let y = 0; y < grid.length; y++) {
      const row = grid[y];
      let newRow: number[] | null = null;
      for (let x = 0; x < row.length; x++) {
        if (row[x] === from) {
          if (!newRow) {
            newRow = row.slice();
            next[y] = newRow;
          }
          newRow[x] = to;
          count++;
        }
      }
    }
    if (count === 0) return 0;
    recordRowDiff(grid, next);
    setGrid(next);
    return count;
  }

  // 撤销：退回上一步（patch 写旧值 / rows 换旧行，本步进恢复栈）
  function handleUndo() {
    if (!grid || undoStack.length === 0) return;
    const step = undoStack[undoStack.length - 1];
    setUndoStack((stack) => stack.slice(0, -1));
    setRedoStack((stack) => [...stack.slice(-9), step]);
    if (step.kind === 'patch') {
      setGrid(applyPatch(grid, step.undo.map((c) => ({ ...c }))));
    } else {
      setGrid(applyStep(grid, step, 'undo'));
    }
  }

  // 恢复撤销：重做一步（patch 写新值 / rows 换新行，本步回撤销栈）
  function handleRedo() {
    if (!grid || redoStack.length === 0) return;
    const step = redoStack[redoStack.length - 1];
    setRedoStack((stack) => stack.slice(0, -1));
    setUndoStack((stack) => [...stack.slice(-9), step]);
    if (step.kind === 'patch') {
      setGrid(applyPatch(grid, step.redo.map((c) => ({ ...c }))));
    } else {
      setGrid(applyStep(grid, step, 'redo'));
    }
  }

  handleUndoRef.current = handleUndo;
  handleRedoRef.current = handleRedo;

  function handleNewBlank() {
    if (sourceUrl) URL.revokeObjectURL(sourceUrl);
    setSourceUrl(null);
    setPixels(null);
    setGrid(newBlankGrid(blankSize));
    setSize({ width: blankSize, height: blankSize });
    setSelectedColor(null);
    setHoverCell(null);
    setError(null);
    setUndoStack([]);
    setRedoStack([]);
  }

  function handleModeChange(m: Mode) {
    // q6 模式切换清旧图纸：上传切空白不再残留旧图，避免误涂旧稿
    if (m !== mode) {
      if (m === 'blank') {
        if (sourceUrl) URL.revokeObjectURL(sourceUrl);
        setSourceUrl(null);
        setPixels(null);
      }
      setGrid(null);
      setSize({ width: 0, height: 0 });
      setUndoStack([]);
      setRedoStack([]);
      pendingHistory.current = null;
    }
    setMode(m);
    setSelectedColor(null);
    setHoverCell(null);
    setEraser(false);
    setError(null);
  }

  return (
    <>
      <header className="topbar">
        <div className="brand">
          拼豆图纸工具<small>Perler / Artkal / Hama</small>
        </div>
        <nav className="mode-tabs">
          <button
            type="button"
            className={mode === 'upload' ? 'active' : ''}
            onClick={() => handleModeChange('upload')}
          >
            上传图片
          </button>
          <button
            type="button"
            className={mode === 'blank' ? 'active' : ''}
            onClick={() => handleModeChange('blank')}
          >
            空白创作
          </button>
        </nav>
        <div className="top-summary">
          {grid ? `${size.width} × ${size.height} 颗` : '未建图纸'}
        </div>
      </header>

      <div className="workbench">
        <aside>
          <PalettePanel
            palette={palette}
            selectedColor={selectedColor}
            onSelectColor={setSelectedColor}
            eraser={eraser}
            onEraserChange={setEraser}
          />
          {grid && (
            <ColorStats
              grid={grid}
              palette={palette}
              selected={selectedColor}
              onSelect={setSelectedColor}
              onReplaceColor={handleReplaceColor}
            />
          )}
        </aside>

        <main>
          {grid ? (
            <>
              <BlueprintCanvas
                grid={grid}
                palette={palette}
                selectedColor={eraser ? null : selectedColor}
                eraser={eraser}
                highlightColor={eraser ? null : selectedColor}
                canUndo={undoStack.length > 0}
                canRedo={redoStack.length > 0}
                onStrokeStart={handleStrokeStart}
                onStrokeEnd={handleStrokeEnd}
                onPickCell={handlePickCell}
                onCellPainted={handleCellPainted}
                onClear={handleClearGrid}
                onUndo={handleUndo}
                onRedo={handleRedo}
                highlight={hoverCell}
                onHoverCell={setHoverCell}
                onCanvasReady={setBlueprintCanvas}
              />
              <div className="statusbar">
                <SizePanel width={size.width} height={size.height} />
                {hoverCell && (
                  <span>悬停 <b>{hoverCell.x}, {hoverCell.y}</b></span>
                )}
                {error && <span className="error">{error}</span>}
                {working && <span>处理中…</span>}
              </div>
            </>
          ) : (
            <div className="empty">
              <h2 style={{ marginBottom: 8 }}>{mode === 'blank' ? '还没有空白画布' : '还没有图纸'}</h2>
              <p>
                {mode === 'blank'
                  ? '在右侧选好尺寸后点新建空白画布，再到左侧取色点画。'
                  : '在右侧上传一张图自动生成拼豆图纸再到左侧取色改色。'}
              </p>
              {error && <p className="error">{error}</p>}
              {working && <p>处理中…</p>}
            </div>
          )}
        </main>

        <aside>
          {mode === 'upload' ? (
            <Uploader
              width={targetWidth}
              onWidthChange={setTargetWidth}
              onFile={handleFile}
              disabled={working}
            />
          ) : (
            <BlankEditor
              size={blankSize}
              onSizeChange={setBlankSize}
              onNew={handleNewBlank}
              eraser={eraser}
              onEraserChange={setEraser}
            />
          )}
          <PaletteSelector
            brandId={brandId}
            brands={palettes.map((p) => ({ id: p.id, brand: p.brand, count: p.count }))}
            onChange={handleBrandChange}
          />
          {mode === 'upload' && grid && (
            <PreviewCompare
              sourceUrl={sourceUrl}
              grid={grid}
              palette={palette}
              width={size.width}
              height={size.height}
            />
          )}
          {grid && (
            <ExportPanel grid={grid} palette={palette} canvas={blueprintCanvas} />
          )}
          {grid && (
            <div className="card">
              <div className="card-title"><span className="step">预览</span>拼豆预览</div>
              <p className="card-desc">只看不下载，弹窗查看拼豆模拟图。</p>
              <button type="button" className="btn" onClick={() => setShowPreview(true)}>
                查看预览图
              </button>
            </div>
          )}
        </aside>
      </div>
      {showPreview && grid && (
        <PreviewModal
          grid={grid}
          palette={palette}
          title={mode === 'blank' ? '空白创作拼豆预览' : '拼豆预览'}
          onClose={() => setShowPreview(false)}
        />
      )}
    </>
  );
}

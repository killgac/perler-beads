// 效果预览：原图 vs 拼豆模拟图左右对照
import { useMemo } from 'react';
import type { BeadColor, Grid } from '../types';

interface Props {
  sourceUrl: string | null;
  grid: Grid | null;
  palette: BeadColor[];
  width: number;
  height: number;
}

/** 把 Grid 画成小色块图（每颗 8px，仅预览用，不做导出） */
function renderPreview(grid: Grid, palette: BeadColor[]): string {
  const h = grid.length;
  const w = grid[0]?.length ?? 0;
  if (h === 0 || w === 0) return '';
  const cell = 8;
  const canvas = document.createElement('canvas');
  canvas.width = w * cell;
  canvas.height = h * cell;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const bead = palette[grid[y][x]];
      ctx.fillStyle = bead ? bead.hex : '#ffffff';
      ctx.fillRect(x * cell, y * cell, cell, cell);
    }
  }
  return canvas.toDataURL('image/png');
}

export default function PreviewCompare({ sourceUrl, grid, palette, width, height }: Props) {
  // P4 预览图缓存：grid/palette 不变时不重算（原每次渲染都重画重编码）
  const previewUrl = useMemo(() => {
    if (!grid) return '';
    return renderPreview(grid, palette);
  }, [grid, palette]);
  if (!sourceUrl || !grid) return null;
  return (
    <div className="card">
      <div className="card-title"><span className="step">3</span>效果预览</div>
      <p className="card-desc">{width} × {height} 颗</p>
      <div className="preview-grid">
        <figure>
          <figcaption>原图</figcaption>
          <img src={sourceUrl} alt="原图" />
        </figure>
        <figure>
          <figcaption>拼豆模拟</figcaption>
          {previewUrl && <img src={previewUrl} alt="拼豆模拟图" />}
        </figure>
      </div>
    </div>
  );
}

// 预览弹窗：拼豆模拟图查看（只看不下载，上传/空白模式共用）；大图占满视口
import { useMemo } from 'react';
import type { BeadColor, Grid } from '../types';

interface Props {
  grid: Grid;
  palette: BeadColor[];
  title: string;
  onClose: () => void;
}

export default function PreviewModal({ grid, palette, title, onClose }: Props) {
  const previewUrl = useMemo(() => {
    const h = grid.length;
    const w = grid[0]?.length ?? 0;
    if (h === 0 || w === 0) return '';
    // P5 按显示尺寸生成：最长边 ≤960px（原固定16px/颗，大图 toDataURL 开销大）
    const cell = Math.max(1, Math.floor(960 / Math.max(w, h)));
    const canvas = document.createElement('canvas');
    canvas.width = w * cell;
    canvas.height = h * cell;
    const ctx = canvas.getContext('2d');
    if (!ctx) return '';
    // 关闭平滑保持硬色块观感
    ctx.imageSmoothingEnabled = false;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const bead = palette[grid[y][x]];
        ctx.fillStyle = bead ? bead.hex : '#ffffff';
        ctx.fillRect(x * cell, y * cell, cell, cell);
      }
    }
    return canvas.toDataURL('image/png');
    // P4 预览图缓存：grid/palette 不变时不重算重编码（useMemo 原已有，保留）
  }, [grid, palette]);

  return (
    <div
      className="modal-mask"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.5)',
        display: 'grid',
        placeItems: 'center',
        zIndex: 50,
        padding: 16,
      }}
    >
      <div
        className="card"
        onClick={(e) => e.stopPropagation()}
        // q10 极端比例兜底：超宽图按宽度收，超高图按高度收，图片区滚动但标题/关闭常驻
        style={{ width: 'min(96vw, calc((100vh - 200px) * 2))', maxHeight: 'calc(100vh - 32px)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
      >
        <div className="card-title"><span className="step">预览</span>{title}</div>
        <div style={{ overflow: 'auto', display: 'grid', placeItems: 'center', background: '#f4f5f8', borderRadius: 8, minHeight: 0 }}>
          {previewUrl && (
            <img
              src={previewUrl}
              alt="拼豆预览图"
              style={{ maxWidth: '100%', maxHeight: 'calc(100vh - 200px)', objectFit: 'contain', imageRendering: 'pixelated', display: 'block' }}
            />
          )}
        </div>
        <div className="row" style={{ marginTop: 12, justifyContent: 'flex-end' }}>
          <button type="button" className="btn btn-primary" onClick={onClose}>
            关闭
          </button>
        </div>
      </div>
    </div>
  );
}

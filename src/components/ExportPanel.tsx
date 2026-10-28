// 导出卡：PNG / PDF 导出（右栏）。canvas 由图纸组件回传，不改绘制逻辑。
// E2 导出走自适应离屏图：大图不过大 canvas，显示缩放不影响导出清晰度
import { useState } from 'react';
import { downloadPDF, downloadPNGAdaptive } from './BlueprintCanvas';
import type { BeadColor, Grid } from '../types';

interface Props {
  grid: Grid;
  palette: BeadColor[];
  canvas: HTMLCanvasElement | null;
}

export default function ExportPanel({ grid, palette, canvas }: Props) {
  const ready = !!canvas;
  // 导出色号开关：默认带色号图纸；关掉则导出纯色块预览图
  const [withCodes, setWithCodes] = useState(true);
  return (
    <div className="card">
      <div className="card-title"><span className="step">导出</span>图纸导出</div>
      <p className="card-desc">PNG 为图纸图，PDF 含图纸 + 用色表两页。</p>
      <label className="row" style={{ marginBottom: 10 }}>
        <input
          type="checkbox"
          checked={withCodes}
          onChange={(e) => setWithCodes(e.target.checked)}
        />
        图纸带色号（关掉导出纯色块预览图）
      </label>
      <div className="row">
        <button
          type="button"
          className="btn btn-primary"
          disabled={!ready}
          title={ready ? '导出 PNG 图纸' : '图纸渲染中，稍候再点'}
          onClick={() => downloadPNGAdaptive(grid, palette, withCodes)}
        >
          导出 PNG
        </button>
        <button
          type="button"
          className="btn"
          disabled={!ready}
          title={ready ? '导出 PDF 图纸' : '图纸渲染中，稍候再点'}
          onClick={() => downloadPDF(grid, palette, withCodes)}
        >
          导出 PDF
        </button>
      </div>
    </div>
  );
}

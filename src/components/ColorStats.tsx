// 用量统计表：色号 × 颗数，按颗数倒序；行可点击选中（单颗改色/画笔共用）
// 选中行 + 底部色板选目标色 → 一键整体换色（空白/上传共用，走 App 差异撤销）
import { useMemo, useState } from 'react';
import type { BeadColor, Grid } from '../types';

interface Props {
  grid: Grid;
  palette: BeadColor[];
  selected: number | null;
  onSelect: (idx: number) => void;
  onReplaceColor: (from: number, to: number) => number;
}

export default function ColorStats({ grid, palette, selected, onSelect, onReplaceColor }: Props) {
  const rows = useMemo(() => {
    const counts = new Map<number, number>();
    for (const row of grid) for (const idx of row) counts.set(idx, (counts.get(idx) ?? 0) + 1);
    return [...counts.entries()]
      .filter(([idx]) => palette[idx])
      .sort((a, b) => b[1] - a[1]);
  }, [grid, palette]);

  const total = grid.length * (grid[0]?.length ?? 0);
  // 整体换色目标色：默认跟随选中行，点色块可改；替换成功后清掉
  const [target, setTarget] = useState<number | null>(null);
  const [replaced, setReplaced] = useState<number>(0);
  const selectedBead = selected !== null && palette[selected] ? palette[selected] : null;
  const activeTarget = target !== null && palette[target] ? target : selected !== null && palette[selected] ? selected : null;

  function handleReplace() {
    if (selected === null || activeTarget === null || activeTarget === selected) return;
    const n = onReplaceColor(selected, activeTarget);
    setReplaced(n);
    setTarget(null);
  }

  return (
    <div className="card">
      <div className="card-title"><span className="step">用量</span>用色统计</div>
      <p className="stat-summary">共 {total} 颗 · 用 {rows.length} 种色（点行取色改色）</p>
      <ul className="stat-list">
        {rows.map(([idx, n]) => {
          const bead = palette[idx];
          return (
            <li key={idx}>
              <button
                type="button"
                onClick={() => {
                  onSelect(idx);
                  setTarget(null);
                  setReplaced(0);
                }}
                className={`stat-row${selected === idx ? ' active' : ''}`}
              >
                <span className="stat-dot" style={{ background: bead.hex }} />
                <span className="stat-code">{bead.code}</span>
                <span>{bead.name}</span>
                <span className="stat-count">× {n}</span>
              </button>
            </li>
          );
        })}
      </ul>
      {selected !== null && selectedBead && (
        <div style={{ marginTop: 10, borderTop: '1px solid var(--border)', paddingTop: 10 }}>
          <p className="card-desc" style={{ margin: '0 0 8px' }}>
            把 <b>{selectedBead.code}</b> 一键换成：
          </p>
          <ul className="palette-list" style={{ maxHeight: 160 }}>
            {palette.map((bead, idx) => (
              <li key={`${bead.code}-${idx}`}>
                <button
                  type="button"
                  title={`${bead.code} ${bead.name}`}
                  onClick={() => setTarget(idx)}
                  className={`palette-row${activeTarget === idx ? ' active' : ''}`}
                  disabled={idx === selected}
                >
                  <span className="palette-dot" style={{ background: bead.hex }} />
                  <span className="palette-name">{bead.name}</span>
                  <span className="palette-code">{bead.code}</span>
                </button>
              </li>
            ))}
          </ul>
          <div className="row" style={{ marginTop: 8 }}>
            <button
              type="button"
              className="btn btn-primary"
              disabled={activeTarget === null || activeTarget === selected}
              onClick={handleReplace}
            >
              确认替换
            </button>
          </div>
          {replaced > 0 && (
            <p className="card-desc" style={{ margin: '8px 0 0' }}>
              已替换 {replaced} 颗，可按撤销恢复。
            </p>
          )}
        </div>
      )}
    </div>
  );
}

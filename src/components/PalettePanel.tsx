// 左栏色盘：全色盘色块网格取色（空白/上传模式共用）；-1 空白格不进统计
import { useMemo, useState } from 'react';
import type { BeadColor } from '../types';

interface Props {
  palette: BeadColor[];
  selectedColor: number | null;
  onSelectColor: (idx: number) => void;
  eraser: boolean;
  onEraserChange: (v: boolean) => void;
}

export function newBlankGrid(n: number): number[][] {
  return Array.from({ length: n }, () => Array<number>(n).fill(-1));
}

export default function PalettePanel({ palette, selectedColor, onSelectColor, eraser, onEraserChange }: Props) {
  const current = selectedColor === null ? null : palette[selectedColor];
  // E3 取色搜索：按色号/颜色名过滤，忽略大小写与首尾空格
  const [keyword, setKeyword] = useState('');
  const filtered = useMemo(() => {
    const q = keyword.trim().toLowerCase();
    if (!q) return palette.map((bead, idx) => ({ bead, idx }));
    return palette
      .map((bead, idx) => ({ bead, idx }))
      .filter(
        ({ bead }) =>
          bead.code.toLowerCase().includes(q) || bead.name.toLowerCase().includes(q),
      );
  }, [palette, keyword]);
  return (
    <div className="card">
      <div className="card-title"><span className="step">色盘</span>取色</div>
      <p className="card-desc">当前品牌全部 {palette.length} 色，点选即为画笔。</p>
      <button
        type="button"
        className={`btn${eraser ? ' active' : ''}`}
        onClick={() => onEraserChange(!eraser)}
        style={{ marginBottom: 10 }}
      >
        {eraser ? '橡皮擦：开' : '橡皮擦：关'}
      </button>
      <input
        type="search"
        placeholder="搜索色号 / 颜色名"
        value={keyword}
        onChange={(e) => setKeyword(e.target.value)}
        style={{ width: '100%', marginBottom: 10 }}
      />
      <ul className="palette-list">
        {filtered.length === 0 && <li className="hint">无匹配颜色，换个关键词试试。</li>}
        {filtered.map(({ bead, idx }) => (
          <li key={`${bead.code}-${idx}`}>
            <button
              type="button"
              title={`${bead.code} ${bead.name}`}
              onClick={() => onSelectColor(idx)}
              className={`palette-row${selectedColor === idx ? ' active' : ''}`}
            >
              <span className="palette-dot" style={{ background: bead.hex }} />
              <span className="palette-name">{bead.name}</span>
              <span className="palette-code">{bead.code}</span>
            </button>
          </li>
        ))}
      </ul>
      <div className="palette-current">
        {current ? (
          <>当前画笔：<b>{current.code}</b> {current.name}</>
        ) : (
          eraser ? '当前为橡皮：点击图纸格子擦为空白' : '先点选一色作为画笔，再点图纸格子'
        )}
      </div>
    </div>
  );
}

// 品牌色盘切换：Perler / Artkal / Hama 三选一
interface Props {
  brandId: string;
  brands: { id: string; brand: string; count: number }[];
  onChange: (id: string) => void;
}

export default function PaletteSelector({ brandId, brands, onChange }: Props) {
  return (
    <div className="card">
      <div className="card-title"><span className="step">2</span>品牌色盘</div>
      <p className="card-desc">切换品牌后图片模式重跑匹配，空白模式格子不动。</p>
      <div className="seg">
        {brands.map((b) => (
          <button
            key={b.id}
            type="button"
            className={`btn${brandId === b.id ? ' active' : ''}`}
            onClick={() => onChange(b.id)}
          >
            <span>{b.brand}</span>
            <span className="hint">{b.count} 色</span>
          </button>
        ))}
      </div>
    </div>
  );
}

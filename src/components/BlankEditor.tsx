// 空白创作设置卡（尺寸 + 新建 + 橡皮），只负责输入
interface Props {
  size: number;
  onSizeChange: (n: number) => void;
  onNew: () => void;
  eraser: boolean;
  onEraserChange: (v: boolean) => void;
}

const SIZES = [24, 32, 48, 64];

export default function BlankEditor({ size, onSizeChange, onNew, eraser, onEraserChange }: Props) {
  return (
    <div className="card">
      <div className="card-title"><span className="step">1</span>空白画布</div>
      <p className="card-desc">选尺寸后新建，空白格以 -1 记为空白。</p>
      <div className="field">
        <span>画布尺寸</span>
        <select value={size} onChange={(e) => onSizeChange(Number(e.target.value))}>
          {SIZES.map((n) => (
            <option key={n} value={n}>
              {n} × {n}
            </option>
          ))}
        </select>
      </div>
      <div className="row">
        <button type="button" className="btn btn-primary" onClick={onNew}>
          新建空白画布
        </button>
        <button
          type="button"
          className={`btn${eraser ? ' active' : ''}`}
          onClick={() => onEraserChange(!eraser)}
        >
          {eraser ? '橡皮擦：开' : '橡皮擦：关'}
        </button>
      </div>
    </div>
  );
}

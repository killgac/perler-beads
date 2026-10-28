// 上传组件：选图 + 目标宽度（豆数），只负责输入，不做像素化
interface Props {
  width: number;
  onWidthChange: (w: number) => void;
  onFile: (f: File) => void;
  disabled?: boolean;
}

export default function Uploader({ width, onWidthChange, onFile, disabled }: Props) {
  return (
    <div className="card">
      <div className="card-title"><span className="step">1</span>上传图片</div>
      <p className="card-desc">高度按原图比例自动计算（四舍五入），建议宽度 24～96。</p>
      <div className="field">
        <span>选择图片</span>
        <label className="btn btn-primary" style={{ display: 'inline-block', textAlign: 'center' }}>
          选择图片文件
          <input
            type="file"
            accept="image/*"
            disabled={disabled}
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onFile(f);
              e.target.value = ''; // 允许重复选同一张图
            }}
          />
        </label>
      </div>
      <div className="field">
        <span>目标宽度（颗）</span>
        <input
          type="number"
          min={8}
          max={256}
          value={width}
          disabled={disabled}
          onChange={(e) => {
            // q1 非法输入钳制：清空/负数/小数/超范围统一收敛到 8～256 整数
            const raw = e.target.value;
            if (raw.trim() === '') return; // 输入中途清空不跳变，沿用旧值
            const n = Math.round(Number(raw));
            if (!Number.isFinite(n)) return;
            onWidthChange(Math.max(8, Math.min(256, n)));
          }}
          onBlur={(e) => {
            // 失焦兜底：仍非法则回填当前钳制值
            const n = Math.round(Number(e.target.value));
            if (!Number.isFinite(n) || n < 8 || n > 256) {
              e.target.value = String(width);
            }
          }}
        />
      </div>
    </div>
  );
}

// 上传组件：选图 + 目标宽度（豆数），只负责输入，不做像素化
import { useEffect, useState } from 'react';

interface Props {
  width: number;
  onWidthChange: (w: number) => void;
  onFile: (f: File) => void;
  disabled?: boolean;
}

export default function Uploader({ width, onWidthChange, onFile, disabled }: Props) {
  // 本地文本态：输入过程只改文本不回写，失焦/回车才提交，避免输一半被钳制拽回
  const [text, setText] = useState(String(width));
  const [focused, setFocused] = useState(false);
  // 外部宽度变化时同步；聚焦输入中不同步，不打断打字
  useEffect(() => {
    if (!focused) setText(String(width));
  }, [width, focused]);
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
          value={text}
          disabled={disabled}
          onFocus={() => setFocused(true)}
          onChange={(e) => {
            // 输入过程只改本地文本：允许清空与输一半，不回写受控值
            setText(e.target.value);
          }}
          onKeyDown={(e) => {
            // 回车即提交，免去先点别处失焦
            if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
          }}
          onBlur={(e) => {
            setFocused(false);
            // 失焦兜底：非法则回填当前钳制值，合法则规范为整数文本
            const raw = e.target.value;
            if (raw.trim() === '') {
              setText(String(width));
              return;
            }
            const n = Math.round(Number(raw));
            if (!Number.isFinite(n)) {
              setText(String(width));
              return;
            }
            const clamped = Math.max(8, Math.min(256, n));
            onWidthChange(clamped);
            setText(String(clamped));
          }}
        />
      </div>
    </div>
  );
}

// 尺寸面板：展示当前图纸尺寸（豆数），只读（最小闭环：宽度在 Uploader 里输）
interface Props {
  width: number;
  height: number;
}

export default function SizePanel({ width, height }: Props) {
  return (
    <p className="hint">
      图纸尺寸：<b style={{ fontFamily: 'var(--mono)' }}>{width} × {height}</b> 颗，共 {width * height} 颗豆
    </p>
  );
}

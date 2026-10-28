// localStorage 存取当前作品：只存图纸数据（品牌、尺寸、grid），原图不存。
// 恢复后预览区原图为空，仅恢复图纸/统计/导出；这是与用户确认过的范围。
// q11 存档越界校验：色盘升级后旧下标可能越界，加载时钳制到合法范围（-1 或色盘内）
import type { Grid } from '../types';

const KEY = 'perler-beads-work-v1';

// 色盘长度随品牌变化：调用方传入当前品牌色数，越界格钳为 -1（空白）
export function sanitizeGrid(grid: Grid, colorCount: number): Grid {
  return grid.map((row) =>
    row.map((v) => (typeof v !== 'number' || v < -1 || v >= colorCount ? -1 : v)),
  );
}

export interface SavedWork {
  brandId: string;
  width: number;
  height: number;
  grid: Grid;
}

export function saveWork(work: SavedWork): boolean {
  try {
    localStorage.setItem(KEY, JSON.stringify(work));
    return true;
  } catch {
    // 配额不足或隐私模式：返回失败，由调用方提示，不再静默丢存档
    return false;
  }
}

export function loadWork(): SavedWork | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<SavedWork>;
    if (
      typeof parsed.brandId !== 'string' ||
      typeof parsed.width !== 'number' ||
      typeof parsed.height !== 'number' ||
      !Array.isArray(parsed.grid)
    ) {
      return null;
    }
    // 校验 grid 形状与尺寸一致
    if (parsed.grid.length !== parsed.height) return null;
    if (!parsed.grid.every((row) => Array.isArray(row) && row.length === parsed.width)) return null;
    return { brandId: parsed.brandId, width: parsed.width, height: parsed.height, grid: parsed.grid };
  } catch {
    return null;
  }
}

export function clearWork(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // 忽略
  }
}

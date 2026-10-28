// 全局类型定义：豆色 / 色盘 / 图纸网格

/** 一颗实体豆色 */
export interface BeadColor {
  code: string; // 色号，如 "P05"
  name: string; // 颜色名，如 "Red"
  hex: string; // 展示用，如 "#B0353C"
  rgb: [number, number, number]; // 匹配用
}

/** 一个品牌色盘 */
export interface Palette {
  id: string; // 如 "perler"
  brand: string; // 如 "Perler"
  product: string;
  source: string; // 数据来源说明
  count: number;
  colors: BeadColor[];
}

/** 单个像素的 RGB */
export type RGB = [number, number, number];

/** 图纸数据：二维色号数组，grid[y][x] = 色盘下标（-1 表示未匹配，正常流程不应出现） */
export type Grid = number[][];

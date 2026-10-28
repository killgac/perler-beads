// RGB 欧氏距离最近邻：像素色 → 色盘下标
import type { BeadColor, Grid, RGB } from '../types';

function distanceSq(a: RGB, b: readonly [number, number, number]): number {
  const dr = a[0] - b[0];
  const dg = a[1] - b[1];
  const db = a[2] - b[2];
  return dr * dr + dg * dg + db * db;
}

/** 单个像素匹配到最近的豆色下标（色盘为空时返回 -1） */
export function matchOne(pixel: RGB, colors: BeadColor[]): number {
  let best = -1;
  let bestDist = Infinity;
  for (let i = 0; i < colors.length; i++) {
    const d = distanceSq(pixel, colors[i].rgb);
    if (d < bestDist) {
      bestDist = d;
      best = i;
    }
  }
  return best;
}

/** 整图匹配：二维 RGB → 二维色号下标（Grid） */
export function matchGrid(pixels: RGB[][], colors: BeadColor[]): Grid {
  return pixels.map((row) => row.map((p) => matchOne(p, colors)));
}

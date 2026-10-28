// 图像读入与像素化：图片 → 目标宽度 → 二维 RGB 数组（高度按原图比例自动算）
import type { RGB } from '../types';

/** 允许的图片类型：SVG 可内嵌脚本，原图直达 <img> 渲染，默认拦截 */
const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/bmp'];
/** 总颗数上限：256 宽极端竖图也收敛，防止旧机器匹配渲染卡死 */
export const MAX_BEADS = 256 * 256;

/** 从 File 读出可用于 Canvas 的 Image 对象，同时返回 objectURL（调用方负责 revoke） */
export function loadImageFile(file: File): Promise<{ img: HTMLImageElement; url: string }> {
  // 文件头兜底：type 为空时按扩展名放行常见位图，svg 一律拦截
  const name = file.name.toLowerCase();
  if (name.endsWith('.svg')) {
    return Promise.reject(new Error('不支持 SVG 图片（可能内嵌脚本），请转成 PNG/JPG 后上传'));
  }
  if (file.type && !ALLOWED_TYPES.includes(file.type) && !file.type.startsWith('image/')) {
    return Promise.reject(new Error('不支持的图片格式，请上传 PNG/JPG/WebP/GIF/BMP'));
  }
  const url = URL.createObjectURL(file);
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ img, url });
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('图片读取失败，请换一张图片重试'));
    };
    img.src = url;
  });
}

export interface Pixelated {
  width: number; // 豆数（列数）
  height: number; // 豆数（行数）
  pixels: RGB[][]; // pixels[y][x]
}

/**
 * 下采样像素化：把图片画到 width×height 的离屏 canvas，再逐像素取色。
 * 高度按原图比例四舍五入，至少为 1。
 */
export function pixelate(img: HTMLImageElement, targetWidth: number): Pixelated {
  const naturalW = img.naturalWidth || 1;
  const naturalH = img.naturalHeight || 1;
  // 非法原图兜底：0 宽高直接报错，不产空白图
  if (!Number.isFinite(naturalW) || !Number.isFinite(naturalH) || naturalW <= 0 || naturalH <= 0) {
    throw new Error('图片尺寸异常，请换一张图片重试');
  }
  let safeWidth = Math.max(1, Math.min(256, Math.round(targetWidth)));
  const ratio = naturalH / naturalW;
  let height = Math.max(1, Math.round(safeWidth * ratio));
  // 总颗数上限：极端竖图按比例缩宽，保证匹配渲染不卡死
  if (safeWidth * height > MAX_BEADS) {
    height = Math.max(1, Math.floor(MAX_BEADS / safeWidth));
    safeWidth = Math.max(1, Math.min(256, Math.floor(MAX_BEADS / height)));
  }

  const canvas = document.createElement('canvas');
  canvas.width = safeWidth;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('当前浏览器不支持 Canvas 2D');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, safeWidth, height);

  const data = ctx.getImageData(0, 0, safeWidth, height).data;
  const pixels: RGB[][] = [];
  for (let y = 0; y < height; y++) {
    const row: RGB[] = [];
    for (let x = 0; x < safeWidth; x++) {
      const i = (y * safeWidth + x) * 4;
      row.push([data[i], data[i + 1], data[i + 2]]);
    }
    pixels.push(row);
  }
  return { width: safeWidth, height, pixels };
}

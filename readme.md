# 拼豆（Perler Beads）网页生产工具

> 技术方案：方案 A —— Vite + React 单页应用（纯前端，无后端）

## 1. 核心功能

1. 图片转拼豆图纸：用户上传一张图片，系统按目标尺寸像素化，逐像素匹配到实体豆色号，生成图纸数据。
2. 色盘匹配：内置市场上实际存在的拼豆套系最少基础色（Perler / Artkal / Hama，先做 1 个品牌跑通，再补其余），将图片像素颜色映射到最接近的实体豆色号（RGB 欧氏距离起步）。
3. 图纸生成与下载：Canvas 渲染色块 + 网格线 + 色号标记，支持放大查看，支持导出 PNG 与 PDF（含用色表）。

## 2. 其他功能（已选定）

1. 单颗手动修改 + 用量统计：点击任意格子换成指定豆色；侧边自动统计每种色号各需多少颗（材料清单）。
2. 空白创作（参考 https://app.hpdou.com）：不上传图片，直接新建指定尺寸（如 24×24 / 48×48）的空白画布，选色后点画 / 擦除，成品同样进入图纸流程，可下载、可统计用量。

## 3. 技术选型

- 构建：Vite + React + TypeScript
- 图像处理：浏览器原生 Canvas API（上传读图、下采样像素化、图纸渲染）
- 色盘数据：本地 JSON（`src/data/palettes/*.json`，字段：色号 + 名称 + RGB/HEX）
- 颜色匹配：RGB 欧氏距离最近邻（后续可升级 Lab + Delta-E，不改架构）
- 导出：`canvas.toDataURL` 导出 PNG；`jspdf` 导出 PDF
- 本地存档：`localStorage`（存当前图纸：原图、尺寸、品牌、格子数据）
- 部署：纯静态，`npm run build` 后部署 GitHub Pages / Vercel / Netlify

## 4. 项目详细架构

数据流只有一条线，无后端调用：

`上传图片 / 新建空白画布 → 缩放到目标豆数 → 逐像素取色 → 匹配最近豆色 → 图纸数据（二维色号数组） → 预览 + 手改 + 统计 → Canvas 渲染图纸 → 导出 PNG/PDF`

分层说明：

- `data/`：色盘数据层，只放 JSON，不写逻辑
- `lib/`：纯函数引擎层（像素化、颜色匹配、图纸渲染/导出），不依赖 React，可单测
- `components/`：UI 层（上传、选尺寸、选色盘、预览、图纸画布、用量表、空白编辑器）
- `App.tsx`：唯一状态持有者，保存 `grid`（二维色号数组）、`palette`、`size`，各面板只做展示与回调
- 图片流程与空白流程共用同一份 `grid` 数据结构，空白创作即 `新建全空 grid + 手工填充`

## 5. 文件清单（Vite 初始化后目标结构）

```text
PerlerBeads/
├── readme.md                    # 本文件（需求 + 架构说明）
├── index.html                   # 入口 HTML
├── package.json                 # 依赖与脚本（react, vite, jspdf）
├── vite.config.ts               # Vite 配置
├── tsconfig.json                # TS 配置
└── src/
    ├── main.tsx                 # React 入口
    ├── App.tsx                  # 主状态 + 页面布局（上传/空白二选一 → 预览 → 图纸）
    ├── types.ts                 # BeadColor, Grid, Palette 类型定义
    ├── data/
    │   └── palettes/
    │       ├── perler.json      # Perler 最少基础色：code + name + rgb
    │       ├── artkal.json      # Artkal 最少基础色（第二步补）
    │       └── hama.json        # Hama 最少基础色（第二步补）
    ├── lib/
    │   ├── image.ts             # 读图、下采样像素化 → 二维 RGB 数组
    │   ├── colorMatch.ts        # RGB 最近邻匹配：像素色 → 豆色
    │   ├── blueprint.ts         # 图纸 Canvas 渲染（色块+网格+色号）+ PNG/PDF 导出
    │   └── storage.ts           # localStorage 存取当前作品
    └── components/
        ├── Uploader.tsx         # 图片上传
        ├── SizePanel.tsx        # 目标宽高（豆数）、颜色数限制
        ├── PaletteSelector.tsx  # 品牌色盘切换
        ├── PreviewCompare.tsx   # 原图 vs 拼豆模拟图对照
        ├── BlueprintCanvas.tsx  # 图纸大图（网格+色号，点击单颗换色）
        ├── ColorStats.tsx       # 用量统计表（色号 × 颗数）
        └── BlankEditor.tsx      # 空白创作：新建空画布 + 选色点画/擦除
```

## 6. 环境配置

- Node.js：当前已验证 `v24.18.0`，需 >= 18
- npm：当前已验证 `11.16.0`
- 初始化命令（空目录执行一次）：
  ```bash
  npm create vite@latest . -- --template react-ts
  npm install
  npm install jspdf
  ```

## 7. 功能启动方式

```bash
npm install     # 安装依赖（首次 / package.json 变更后）
npm run dev     # 本地开发，浏览器打开提示的 http://localhost:5173
npm run build   # 生产构建，产物在 dist/
npm run preview # 本地预览构建产物
```

功能走通顺序：上传图片 → 选尺寸与品牌 → 看预览 → 进图纸页单颗修改 → 查用量表 → 导出 PNG/PDF；空白创作：点“新建空白”→ 选尺寸 → 点画 → 同样进图纸流程。

## 8. 测试方式（暂不写自动化，先手动）

1. 上传一张小像素图（如 32×32），目标尺寸设相同值，检查预览色块与原图一致。
2. 切换品牌色盘，确认图纸重算且用量表同步变化。
3. 图纸页点击单颗换色，确认用量表颗数同步增减。
4. 空白新建 24×24，点画 10 颗再擦除 2 颗，确认用量表为 8 颗。
5. 导出 PNG（能打开、网格色号清晰）、导出 PDF（图纸页 + 用色表页）。
6. 刷新页面，确认 localStorage 恢复上次作品。

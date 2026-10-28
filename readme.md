# 拼豆图纸工具 🧩

**👉 在线使用：https://killgac.github.io/perler-beads/**

把喜欢的图片变成拼豆图纸：上传照片，自动配好实体豆色，照着图纸拼就行。也可以直接在空白画布上画自己的设计。

## 能做什么

- **照片变图纸**：上传一张图片，自动转成拼豆图纸，每个格子标好色号
- **三个豆子品牌**：Perler / Artkal / Hama，一键切换，图纸跟着变
- **随手改**：点一下或拖着画就能改色，画错了撤销就行，跟画图一样
- **材料清单**：每种颜色各要多少颗自动算好，照单买豆子不浪费
- **空白创作**：不想传图就直接新建画布自己画
- **导出图纸**：存成 PNG 图片或 PDF（含材料清单页），打印出来照着拼

## 怎么玩

1. 打开上方在线地址
2. 上传一张图片（或者点空白创作自己画）
3. 选想要的尺寸和豆子品牌
4. 在图纸上微调颜色
5. 导出 PNG 或 PDF，照着拼

作品会自动保存在浏览器里，刷新页面不会丢。

---

<details>
<summary>开发者信息（本地运行）</summary>

```bash
git clone https://github.com/killgac/perler-beads.git
cd perler-beads
npm install
npm run dev
```

Vite + React + TypeScript，纯前端无后端，`npm run build` 产物在 `dist/`。

</details>

# 队长拼豆 · 图纸生成器 (Captain Bead Pattern Studio)

> 把任意图片一键转换成带色号、可打印的拼豆图纸。100% 在浏览器本地处理, 不上传任何图片。

## ✨ 功能

- 🖼️ 上传图片自动识别色卡, 生成 MARD / COCO / ManMan 等多套色板的拼豆底稿
- 🎨 5 种导出格式: PNG 图纸 / PNG 纯图案 / CSV 色号 / Excel 色号 / JSON 备份
- 📐 可调参数: 方格尺寸 / 颜色上限 / 合并阈值 / 适配模式 / 风格滤镜
- 💾 历史记录 (本地存储, 最多 50 条)
- 🔧 画笔工具: 替换色号 / 删除颜色 / 边缘清理 / 肤色保护 / 水平镜像
- 📱 移动端 + 桌面端适配

## 🚀 快速开始

```bash
# 安装依赖
npm install

# 启动开发服务器 (默认 http://localhost:5181)
npm run dev

# 生产构建
npm run build

# 本地预览生产产物
npm run preview
```

构建产物输出到 `dist/`, 可直接部署到任何静态托管 (Nginx / Cloudflare Pages / Vercel)。

## 🌐 部署到 Cloudflare Pages

1. 把本仓库 push 到 GitHub
2. 在 Cloudflare Dashboard 创建 Pages 项目, 关联此仓库
3. 构建设置:
   - **Build command**: `npm run build`
   - **Build output directory**: `dist`
   - **Root directory**: `/`
4. (可选) 绑定自定义域名

部署完成后, 访问路径前缀为 `/strawberry/` (由 `vite.config.js` 的 `base` 字段决定)。

### 部署到 Nginx 子路径

把 `dist/` 内容上传到 `/www/wwwroot/<your-domain>/strawberry/`, 配置:

```nginx
location /strawberry/ {
    alias /www/wwwroot/<your-domain>/strawberry/;
    index index.html;
    try_files $uri $uri/ /strawberry/index.html;
}

location /strawberry/assets/ {
    alias /www/wwwroot/<your-domain>/strawberry/assets/;
    expires 1y;
    add_header Cache-Control "public, immutable";
}

location = /strawberry/index.html {
    add_header Cache-Control "no-cache";
}
```

## 🏗️ 技术栈

- **React 18** + **Vite 8**
- **Tailwind CSS 3** + **PostCSS**
- **xlsx 0.18.5** (Excel 导出)
- 纯前端, **零后端依赖**

## 📂 项目结构

```
.
├── index.html              # HTML 模板
├── vite.config.js          # base='/strawberry/' + outDir='dist'
├── tailwind.config.js
├── postcss.config.js
├── public/
│   └── palettes.json       # 调色板 JSON
└── src/
    ├── main.jsx            # React 入口
    ├── App.jsx             # 主组件 + 状态管理
    ├── index.css           # 全局样式
    ├── components/
    │   ├── Sidebar.jsx     # 左侧设置面板
    │   ├── CanvasStage.jsx # 画布 + 上传
    │   ├── EditToolbar.jsx # 画布下方工具栏 (画笔 / 调色板 / 导出)
    │   ├── ExportPanel.jsx # 多格式导出面板
    │   ├── SettingsSheet.jsx # 移动端 Sheet
    │   ├── HistoryPanel.jsx # 历史记录
    │   ├── MobileActionBar.jsx
    │   ├── ColorList.jsx
    │   ├── Toast.jsx
    │   └── icons.jsx
    └── lib/
        ├── patternEngine.js # 核心算法 (K-means / 频次+Lab / 调色板映射)
        ├── palette.js       # 调色板加载
        ├── history.js       # localStorage 历史
        └── downloadFile.js  # 文件下载工具
```

## 🔒 隐私

- 所有图片处理在浏览器 canvas 内完成, **不上传任何数据**
- 历史记录仅存 localStorage (`captain-history` key, 上限 50 条)
- 无任何后端服务, 无任何 API key

## 📜 许可

MIT
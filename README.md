# Game Asset Finder Static

一个可部署到 GitHub Pages 的纯静态网页工具，用于游戏媒体配图检索、网络素材发现、本地管理、裁切和导出。

## 功能

- 本地浏览器素材库：拖拽或多选上传图片，元数据和图片 Blob 保存到 IndexedDB。
- 网络素材发现：搜索可跨域访问的公开图片源，并提供 Google Images、Bing Images、Pinterest、Steam、PlayStation Blog、Xbox Wire、Nintendo News 等外部搜索入口。
- URL 导入：可粘贴原图 URL 尝试导入；如果遇到 CORS、登录或反爬限制，请手动下载后拖拽上传。
- 搜索筛选：按游戏名、别名、标签、素材类型、图片比例和关键词筛选。
- 官方资料链接收藏：为游戏保存官网、Steam、新闻稿、press kit 等入口链接。
- 裁切工具：支持 16:9、3:4、4:5、1:1 等预设，支持缩放、旋转、参考线和多版本保存。
- 导出：导出 JPG/PNG，并同时下载 `source.json` 记录来源、裁切参数和导出信息。
- 备份恢复：导出/导入 `backup.json`，第一版只备份元数据、来源链接和裁切记录，不打包图片文件。

## 网络搜索说明

这是纯静态站，没有后端代理，也不会绕过反爬或登录验证。

当前实现原则：

- 能直接导入：浏览器允许跨域读取的公开图片 URL。
- 能搜索展示：公开 API 且允许 CORS 的图片源，例如 Wikimedia Commons。
- 只做入口：Google Images、Bing Images、Pinterest、Steam、游戏官网、新闻稿等站点会在新标签页打开，由用户自行确认授权和版权后复制原图 URL 或下载图片。
- 不做：绕过 CORS、绕过登录、模拟爬虫、破解反爬、把第三方 API Key 写死在前端。

## 设计系统

当前项目已实际运行：

```bash
npx getdesign@latest add playstation
npx getdesign@latest add pinterest
```

生成文件：

```text
DESIGN.md
pinterest/DESIGN.md
```

项目执行规范文件：

```text
design/DESIGN.md
```

当前 UI 按混合规则实现：

- PlayStation 负责主应用外壳、黑/白/蓝体系、全圆角 CTA、工具型面板和裁切页面。
- Pinterest 负责图片瀑布流、16px pin 卡片、8px gutter 和图片优先的发现体验。

### 如何从 getdesign.md 选择风格

1. 打开 [getdesign.md](https://getdesign.md/)。
2. 选择一个适合项目的设计风格。
3. 将对应的 `DESIGN.md` 内容复制到本项目的：

```text
design/DESIGN.md
```

4. 根据新规范调整 `design/DESIGN.md` 的混合执行规则。
5. 重新运行项目。

### 如何修改默认主题

主题 token 主要在：

```text
src/index.css
```

可调整：

- `--app-bg`
- `--surface`
- `--surface-raised`
- `--border`
- `--text-primary`
- `--text-secondary`
- `--accent`
- `--accent-cyan`
- 按钮、卡片、瀑布流、表单、空状态等组件类

`design/DESIGN.md` 是视觉规范源，`src/index.css` 是当前实现。

## 技术栈

- Vite + React + TypeScript
- Tailwind CSS
- Dexie.js / IndexedDB
- react-easy-crop
- Canvas 浏览器端图片处理

## 本地安装

```bash
npm install
```

## 本地运行

```bash
npm run dev
```

打开终端显示的本地地址即可使用。所有素材数据优先保存在当前浏览器本地，不需要后端服务。

## 构建

```bash
npm run build
```

构建输出目录为 `dist`。

## GitHub Pages 部署

本项目已包含 `.github/workflows/deploy.yml`。推送到 `main` 分支后，GitHub Actions 会自动构建并部署 `dist`。

首次部署前，在 GitHub 仓库中设置：

1. 打开仓库 `Settings`。
2. 进入 `Pages`。
3. 在 `Build and deployment` 中把 `Source` 设置为 `GitHub Actions`。
4. 推送到 `main` 分支，等待 Actions 完成。

`vite.config.ts` 会在 GitHub Actions 中自动把 `base` 设置为 `/game-asset-finder-static/`，兼容 GitHub Pages 项目页；本地开发仍使用 `/`。

## 使用说明

1. 在“本地素材”中点击“上传”或直接拖拽多张图片到页面。
2. 在弹窗中填写游戏中文名、英文名、别名、来源 URL、素材类型、标签和备注。
3. 切换到“网络发现”，输入游戏名或关键词搜索公开图片源。
4. 对可直接读取的结果点击“导入原图”，或打开外部搜索入口后复制原图 URL 导入。
5. 在首页通过搜索框和左侧筛选栏查找素材。
6. 选中素材后，可在右侧保存官方素材库或新闻稿链接。
7. 点击“进入裁切”，选择 16:9、3:4、4:5 等预设。
8. 调整裁切框、缩放、旋转和参考线。
9. 点击“保存版本”保存裁切参数，点击“导出”下载图片和 `source.json`。
10. 点击“备份”导出元数据备份；点击“恢复”导入备份。

## 注意事项

- 这是纯静态站，不包含后端服务器、Node 服务端接口或数据库服务。
- 不要在前端代码中写入任何需要保密的 API Key。
- 不做自动爬虫，不绕过反爬或登录验证。
- URL 导入受浏览器 CORS 限制影响；失败时请手动下载图片后拖拽上传。
- 第一版备份不包含图片文件。恢复后可看到元数据记录，但没有原图的记录不能裁切导出。
- 不建议把大量图片提交到 GitHub 仓库，图片应保存在浏览器本地素材库中。

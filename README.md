# Game Asset Finder

游戏媒体配图检索、网络素材采集、本地管理、裁切和导出工具。

当前项目支持两种运行方式：

- `npm run dev`：纯前端模式，适合本地素材库、裁切、导出。
- `npm run dev:local`：本地采集模式，前端 + localhost Node API，适合搜索官方素材、下载原图、本地缓存。

## 本地采集模式

本地采集模式会启动：

```text
Vite React 前端: http://127.0.0.1:5173
Node 采集 API:   http://127.0.0.1:8787
```

运行：

```bash
npm run dev:local
```

本地 API 能做：

- 搜索 Steam Store 官方素材。
- 提取 Steam header image 和 screenshots。
- 可选接入 Google Custom Search JSON API。
- 可选接入 IGDB。
- 解析公开页面里的 Open Graph、Twitter Card、img、srcset 图片。
- 下载图片到 `library/images/`。
- 记录下载元数据到 `library/metadata.json`。
- 前端再把本地下载后的图片导入 IndexedDB 素材库。

`library/` 和 `.env` 已加入 `.gitignore`，不会提交到仓库。

## 可选 API Key

复制配置：

```bash
copy .env.example .env
```

按需填写：

```env
LOCAL_API_PORT=8787

GOOGLE_CSE_API_KEY=
GOOGLE_CSE_CX=

IGDB_CLIENT_ID=
IGDB_CLIENT_SECRET=
```

不填 API Key 也能使用 Steam 官方素材搜索。

## 能力边界

本地服务可以绕过浏览器 CORS 限制，因为图片下载由 Node 在本机完成。

但仍然不会做这些事：

- 不绕过登录。
- 不破解反爬。
- 不访问无权访问的内容。
- 不把 API Key 写进前端。
- 不自动处理强 Cloudflare / Akamai bot protection 页面。

遇到需要登录或强反爬的 press kit，仍需要你手动打开页面下载。

## 功能

- 本地素材库：拖拽或多选上传图片，保存到 IndexedDB。
- 网络发现：通过本地 API 搜索 Steam、Google CSE、IGDB 和页面图片。
- 官方页面解析：粘贴游戏官网、新闻稿、press kit URL，提取图片候选。
- 下载导入：把网络图片保存到 `library/images/`，再导入浏览器素材库。
- 搜索筛选：按游戏名、别名、标签、素材类型、比例和关键词筛选。
- 官方链接收藏：为游戏保存官网、Steam、新闻稿、press kit 等链接。
- 裁切工具：支持 16:9、3:4、4:5、1:1，支持缩放、旋转、参考线、多版本保存。
- 导出：导出 JPG/PNG，并同时下载 `source.json`。
- 备份恢复：导出/导入元数据 `backup.json`。

## 设计系统

项目已实际运行：

```bash
npx getdesign@latest add playstation
npx getdesign@latest add pinterest
```

生成文件：

```text
DESIGN.md
pinterest/DESIGN.md
```

项目执行规范：

```text
design/DESIGN.md
```

当前 UI 混合规则：

- PlayStation：主应用外壳、黑/白/蓝体系、全圆角 CTA、工具面板、裁切页。
- Pinterest：图片瀑布流、16px pin 卡片、8px gutter、图片优先发现体验。

## 安装

```bash
npm install
```

## 运行

纯前端：

```bash
npm run dev
```

本地采集：

```bash
npm run dev:local
```

## 构建

```bash
npm run build
```

输出目录为 `dist`。

## GitHub Pages

GitHub Pages 只能部署前端静态部分，不能运行本地采集 API。

推送到 `main` 后，`.github/workflows/deploy.yml` 会构建并部署 `dist`。

如果需要网络原图采集，请使用本地采集模式。

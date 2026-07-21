# MindTab 技术方案

> 版本 0.1.0 · 更新于 2026-05-27

---

## 1. 技术栈清单

| 层级 | 技术 | 版本 | 用途 |
|------|------|------|------|
| **运行环境** | Chrome Extension MV3 | Manifest V3 | 扩展宿主 |
| **框架** | React | 19.2.6 | UI 渲染 |
| **语言** | TypeScript | 6.0.2 | 类型安全 |
| **构建** | Vite | 8.0.12 | 打包 + HMR |
| **扩展适配** | @crxjs/vite-plugin | 2.4.0 | MV3 开发集成 |
| **状态管理** | Zustand | 5.0.13 | 全局状态 |
| **样式** | Tailwind CSS | 4.3.0 | 原子化 CSS |
| **UI 组件** | Radix UI | 各组件 1.x–2.x | 无障碍基础组件 |
| **动画** | Motion (Framer Motion) | 12.40.0 | 页面过渡、弹窗动画 |
| **拖拽** | @dnd-kit/core + sortable | 6.3.1 / 10.0.0 | 书签拖拽排序 |
| **图标** | Lucide React | 1.16.0 | 矢量图标 |
| **本地存储** | IndexedDB | 浏览器原生 | 书签、待确认、文件夹 |
| **轻量存储** | chrome.storage.local | MV3 API | 设置项、搜索历史 |
| **AI 转发** | Express 5 (Vercel) | 5.2.1 | 代理 DeepSeek API |
| **AI 模型** | DeepSeek Chat | deepseek-chat | 语义索引 + 搜索 |

---

## 2. 项目目录结构

```
mindtab-extension/
├── manifest.json                  # Chrome MV3 清单
├── package.json
├── vite.config.ts
├── tsconfig.json
├── assets/
│   └── icons/                     # 扩展图标 16/48/128
├── src/
│   ├── background/
│   │   └── serviceWorker.ts       # MV3 Service Worker（收藏入口 + 索引调度）
│   ├── content/
│   │   └── contentScript.ts       # Content Script（当前占位）
│   ├── newtab/
│   │   ├── index.html             # 新标签页入口
│   │   ├── main.tsx               # React 挂载
│   │   └── App.tsx                # 主应用壳
│   ├── popup/
│   │   ├── index.html             # Popup 入口
│   │   ├── main.tsx
│   │   └── Popup.tsx
│   ├── components/
│   │   ├── bookmark/              # 书签卡片、网格、置顶行、待确认面板
│   │   ├── filter/                # 筛选栏（排序、内容类型）
│   │   ├── search/                # 搜索栏、搜索弹窗、结果卡片
│   │   ├── sidebar/               # 侧边栏、文件夹树
│   │   ├── settings/              # 设置页
│   │   ├── onboarding/            # 隐私授权、导入引导
│   │   ├── ui/                    # 通用 UI 组件（Button, Dialog, Toast 等）
│   │   └── Background.tsx         # 视频壁纸背景
│   ├── hooks/
│   │   ├── useSearch.ts           # 搜索逻辑（AI + 关键词降级）
│   │   └── useImport.ts           # 书签导入
│   ├── lib/
│   │   ├── db.ts                  # IndexedDB 封装
│   │   ├── storage.ts             # chrome.storage 封装
│   │   ├── api.ts                 # AI 转发服务客户端
│   │   ├── aiIndex.ts             # AI 索引调度
│   │   ├── favicon.ts             # Favicon URL 生成
│   │   ├── faviconDiscovery.ts    # Favicon 智能发现
│   │   ├── faviconMap.ts          # 知名站点 Favicon 静态映射
│   │   ├── importer.ts            # HTML 书签解析导入
│   │   ├── bookmarkParser.ts      # Netscape 格式解析
│   │   ├── messages.ts            # 跨模块消息常量
│   │   ├── timeFormat.ts          # 时间格式化
│   │   ├── videoCache.ts          # 视频壁纸缓存
│   │   └── videoThemes.ts         # 壁纸主题配置
│   ├── store/
│   │   ├── bookmarkStore.ts       # 书签 + 文件夹全局 store
│   │   ├── uiStore.ts             # UI 状态（pending、toast）
│   │   └── themeStore.ts          # 深色模式 store
│   └── styles/
│       └── globals.css            # 全局样式 + CSS 变量
└── dist/                          # 构建输出（chrome 加载此目录）
```

---

## 3. 数据存储方案

### 3.1 IndexedDB（数据库名：`mindtab`，版本 2）

#### `bookmarks` 对象仓库

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | string (PK) | crypto.randomUUID() |
| `url` | string | 页面 URL |
| `title` | string | 页面标题（AI 可优化） |
| `favicon` | string | Favicon URL |
| `domain` | string | 域名 |
| `summary` | string | AI 生成的中文摘要（≤100 字） |
| `tags` | string[] | AI 生成的标签（3–5 个） |
| `contentType` | string | 内容类型：文章/视频/工具/文档/其他 |
| `folderId` | string \| null | 所属文件夹 ID |
| `pinnedIn` | string[] | 置顶的作用域列表 |
| `createdAt` | number | 收藏时间戳 |
| `lastOpenedAt` | number | 最近打开时间戳 |
| `indexStatus` | enum | `indexing` → `pending` → `done` |
| `order` | number | 手动排序权重 |

索引：`by-url`、`by-folderId`、`by-createdAt`

#### `pending` 对象仓库

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | string (PK) | 与最终 bookmark 共享 UUID |
| `url` | string | 页面 URL |
| `title` | string | 页面标题 |
| `favicon` | string | Favicon URL |
| `domain` | string | 域名 |
| `summary` | string | AI 索引完成后填入 |
| `tags` | string[] | AI 索引完成后填入 |
| `contentType` | string | AI 索引完成后填入 |
| `createdAt` | number | 创建时间戳 |
| `indexStatus` | enum | `indexing` → `pending` → `done` |

索引：`by-url`、`by-createdAt`

#### `folders` 对象仓库

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | string (PK) | crypto.randomUUID() |
| `name` | string | 文件夹名称（≤8 字符） |
| `parentId` | string \| null | 父文件夹 ID |
| `order` | number | 排序权重 |
| `createdAt` | number | 创建时间戳 |

索引：`by-parentId`

### 3.2 chrome.storage.local

| Key | 类型 | 说明 |
|-----|------|------|
| `mt:darkMode` | `'system' \| 'light' \| 'dark'` | 深色模式设置 |
| `mt:privacyAgreed` | boolean | 隐私协议是否已同意 |
| `mt:importGuideShown` | boolean | 导入引导是否已展示 |
| `mt:searchHistory` | string[] | 搜索历史（最多 10 条） |
| `mt:searchQuota` | `{ date: string, count: number }` | 每日搜索使用量 |
| `mt:improveProduct` | boolean | 是否开启匿名统计 |

---

## 4. AI 转发服务接口清单

<!-- TODO（直连版重构中）：本节描述的自建中转服务已废弃。新架构下 AI 调用由 `shared/lib/api.ts` 经 `aiClient.ts` 直连用户在设置中配置的 OpenAI 兼容服务商（DeepSeek/OpenAI/Kimi/自定义），API Key 仅存本地 chrome.storage.local。待代码重构落地后按新实现重写本节。 -->

**基地址**：`https://mindtab-server.vercel.app`

### `GET /api/health`

健康检查。

**响应**：
```json
{ "ok": true, "service": "mindtab-server", "port": 3001 }
```

### `POST /api/index`

单条书签语义索引。

**入参**：
```json
{
  "url": "https://example.com",
  "title": "页面标题",
  "content": "页面正文片段（≤4000 字符）"
}
```

**出参**：
```json
{
  "summary": "100字以内中文摘要",
  "tags": ["标签1", "标签2", "标签3"],
  "contentType": "文章",
  "optimizedTitle": "优化后的标题（可选）"
}
```

### `POST /api/index-batch`

批量语义索引（每次最多 5 条）。

**入参**：
```json
{
  "items": [
    { "url": "...", "title": "...", "content": "..." }
  ]
}
```

**出参**：
```json
[
  {
    "index": 0,
    "summary": "...",
    "tags": ["...", "..."],
    "contentType": "...",
    "optimizedTitle": "..."
  }
]
```

### `POST /api/search`

自然语言语义搜索。

**入参**：
```json
{
  "query": "用户的自然语言查询",
  "bookmarks": [
    { "id": "...", "title": "...", "domain": "...", "summary": "...", "tags": ["..."] }
  ]
}
```

**出参**：
```json
{
  "results": [
    { "id": "书签ID", "score": 0.85, "reason": "匹配理由" }
  ]
}
```

### `POST /api/favicon-discover`

Favicon 智能发现。

**入参**：
```json
{
  "url": "https://example.com/page",
  "domain": "example.com"
}
```

**出参**：
```json
{ "favicon": "https://example.com/apple-touch-icon.png" }
```

---

## 5. Chrome 扩展各模块职责

### Background Service Worker (`serviceWorker.ts`)

| 职责 | 说明 |
|------|------|
| 收藏入口 | 监听扩展图标点击 (`action.onClicked`) 和右键菜单 (`contextMenus`) |
| 写入流程 | URL 校验 → 去重 → 容量检查 → 写入 pending → 广播通知 |
| AI 索引调度 | 30 秒一次 alarm 轮询未索引书签，按 5 条/批调用批量索引 API |
| Favicon 发现 | 30 秒一次 alarm 轮询，对通用 favicon 的域名尝试智能发现 |
| 全量排空 | 导入大量书签后一次性排空所有待索引队列 |
| 消息路由 | 接收 UI 端消息（手动添加 URL、手动重索引、触发排空） |
| 反馈通知 | 向 newtab 发送 Toast 消息，无监听者时降级为 badge 闪烁 |

### Content Script (`contentScript.ts`)

当前为占位模块。注册于 `<all_urls>`，后续可用于页面正文提取增强。

### New Tab Page (`newtab/`)

主界面。覆盖 Chrome 新标签页，包含：

| 区域 | 组件 | 功能 |
|------|------|------|
| 背景层 | `Background.tsx` | 视频壁纸 + 主题切换 |
| 侧边栏 | `Sidebar.tsx` | 文件夹树、新建/重命名/删除文件夹 |
| 筛选栏 | `FilterBar.tsx` | 排序（最近打开/手动/最早/字母）、内容类型筛选 |
| 置顶行 | `PinnedRow.tsx` | 置顶书签，支持拖拽排序 |
| 书签网格 | `BookmarkGrid.tsx` | 主区域卡片网格，支持拖拽排序 |
| 待确认面板 | `PendingPanel.tsx` | 底部抽屉，展示待确认收藏项 |
| 搜索栏 | `SearchBar.tsx` | 底部搜索胶囊，展开为 AI 搜索面板 |
| 设置页 | `SettingsPage.tsx` | 通用/数据管理/隐私/关于 |
| 隐私授权 | `PrivacyModal.tsx` | 首次使用时的隐私协议弹窗 |

### Popup (`popup/`)

扩展图标弹窗（当前为极简状态提示）。主要收藏操作通过 `action.onClicked` 直接触发，不经过 Popup。

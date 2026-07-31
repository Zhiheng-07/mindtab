# MindTab 架构说明

> 版本 0.2.7 · 更新于 2026-07-31
> 本文描述当前真实代码结构。AI 协作细则见根目录 `CLAUDE.md`，贡献流程见 `CONTRIBUTING.md`。

---

## 1. 总览

MindTab 是 Chrome MV3 扩展（React 19 + Vite + TypeScript），单 HTML 入口接管新标签页。
自开源 BYOK 改造起**无任何自建服务端**：AI 调用由用户自填 API Key 直连 OpenAI 兼容端点，
书签数据全部存本地 IndexedDB。

| 层 | 技术 |
|---|---|
| 语言 / 框架 | TypeScript · React 19 |
| 构建 | Vite + @crxjs/vite-plugin（MV3 打包） |
| 样式 / UI | Tailwind CSS v4 · shadcn/ui + Radix UI · Motion 动效 |
| 状态 | Zustand（每 feature 独立 store） |
| 本地搜索 | MiniSearch + `Intl.Segmenter('zh')` 分词 |
| 存储 | IndexedDB（书签/待确认/文件夹）+ chrome.storage.local（设置） |
| AI | 用户自配置 OpenAI 兼容服务（12 家预设 + 自定义），无中转 |
| 测试 | Vitest（`tests/`，37 条）+ Puppeteer 冒烟（`scripts/ui-smoke.mjs`） |
| CI | GitHub Actions：push main / PR 跑 build + lint + test |

---

## 2. feature-sliced 目录结构

```
src/
├── shared/                  公共层（不含业务逻辑，绝不 import features/）
│   ├── ui/                  shadcn/Radix 通用组件（含 icons/）
│   ├── db/                  IndexedDB 基础设施
│   │   ├── connection.ts    唯一的 indexedDB.open 出口 + schema 迁移
│   │   ├── crossTable.ts    跨表操作（applyIndex / findByUrl）
│   │   └── types.ts         Bookmark / PendingBookmark / Folder 类型
│   ├── storage/             chrome.storage.local 封装（engine + keys）
│   ├── messages/            跨上下文消息（MSG 常量 + broadcast）
│   ├── lib/                 AI 调用链、favicon、工具函数
│   ├── dnd/                 拖拽基础设施（@dnd-kit 封装）
│   └── assets/              共享静态资源（data / lottie）
│
├── features/                业务模块（每个自成一体）
│   ├── bookmarks/           书签网格：components + db.ts + store.ts + selectors.ts
│   ├── pending/             待确认面板：components + db.ts + store.ts
│   ├── sidebar/             侧导栏与文件夹树：components + db.ts + hooks + lib
│   ├── search/              搜索：components + hooks + lib(localIndex/frecency) + storage.ts
│   ├── settings/            设置模态（含 AI 服务配置区）
│   ├── onboarding/          隐私弹窗 + 版本更新弹窗：components + lib(privacy/whatsNew)
│   ├── filter/              内容类型筛选栏
│   ├── theme/               亮暗主题 store
│   ├── toast/               通知（sonner 封装：id 去重 + 时长分层）
│   └── wallpaper/           视频壁纸（按主题惰性加载）
│
├── newtab/                  唯一 HTML 入口
│   ├── App.tsx              纯组装层（≤150 行约束）
│   ├── useAppController.ts  数据/编排逻辑
│   ├── AppHeader.tsx / AppMain.tsx
│   └── index.html / main.tsx
├── background/              MV3 Service Worker
├── content/                 Content Script（页面正文抽取）
├── popup/                   扩展图标 popup
├── styles/                  全局样式（CSS 变量、glass 风格）
├── assets/                  构建期静态资源（图标）
└── global.d.ts
```

### 分层铁律（违反 = 架构腐化）

1. `shared/` **绝不** import `features/` 的任何东西
2. 每个 `features/X/` 可以 import `shared/` 的任何东西
3. 跨 feature 导入**只能**通过 barrel export（`from '@/features/Y'`）

**铁律 #3 的唯一例外**：各 feature 的 `db.ts` 数据层允许被其它 feature / background /
newtab 直引（db 是持久化边界，不含 UI/编排）。现存合规直引：search / settings /
sidebar(lib) / background → `bookmarks/db`；bookmarks(store) → `sidebar/db`。
同 feature 内部互引用相对路径（`./db`、`../store`），不绕 `@/features/<自己>/...`。

---

## 3. 数据层

### IndexedDB（数据库 `mindtab`，版本 3）

连接唯一出口 `shared/db/connection.ts`（`openDB` / `tx`），组件禁止直接 `indexedDB.open`。

| store | keyPath | 索引 | 用途 |
|---|---|---|---|
| `bookmarks` | id | by-url / by-folderId / by-createdAt / by-indexStatus | 正式书签 |
| `pending` | id | — | 待确认收藏 |
| `folders` | id | — | 文件夹树（parentId 嵌套） |

Schema 迁移在 `onupgradeneeded` 内幂等执行：v1→v2 `isPinned`→`pinnedIn[]` 游标迁移；
v3 新增 `by-indexStatus` 索引（drain 走索引取待办，不再全表扫）。

### chrome.storage.local（`shared/storage/keys.ts`）

| key | 内容 |
|---|---|
| `mt:aiConfig` | AI 直连配置（provider/apiKey/baseUrl/model），单 key 原子读写 |
| `mt:darkMode` | 主题：system / light / dark |
| `mt:privacyAgreed` / `mt:importGuideShown` / `mt:lastSeenVersion` | 引导与弹窗状态 |
| `mt:searchHistory` | 搜索历史（最多 15 条） |
| `mt:searchFrecency` / `mt:searchAdaptive` | 搜索排序增强数据 |
| `mt:improveProduct` | 匿名统计开关 |

---

## 4. AI 调用链（BYOK 直连）

```
UI / Background
   └─ shared/lib/api.ts          业务封装：indexBookmark / indexBookmarkBatch / searchBookmarks
        ├─ aiPrompts.ts          纯函数：prompt 构建 + 响应解析（可单测）
        └─ aiClient.ts           OpenAI 兼容 /chat/completions 直连（超时/错误分类）
             └─ aiProvider.ts    12 家预设厂商 + 自定义（getAiConfig / resolveChatUrl）
```

- **绝不硬编码任何 Key**：`aiClient` 每次调用从 `mt:aiConfig` 读用户配置；
  未配置抛 `AiNotConfiguredError`（非瞬时错误，索引不退避重试，静默挂起）
- 组件不允许直接 fetch AI 接口，一律走 `api.ts`
- 索引编排在 `shared/lib/aiIndex.ts`：调 API → `applyIndex` 写库 → `broadcast` 通知 UI；
  由 Background SW fire-and-forget 调用
- 设置页支持「获取模型列表」（GET /models）与「测试连接」，错误语义化分类
  （401→Key 无效、404→接入点错误等）

---

## 5. 搜索架构（v0.2.6 两阶段）

设计决策见 [ADR-003](adrs/003-search-local-recall-llm-rerank.md)。

```
输入（防抖 250ms）
   └─ features/search/lib/localIndex.ts
        MiniSearch 双通道分词（Intl.Segmenter('zh') + CJK bigram）
        字段加权 title > tags > summary > domain
        → 本地即时结果（标注「即时匹配」，可直接点击）
回车
   └─ buildCandidates 粗筛 top 50（不足按新近度补满）
   └─ api.searchBookmarks：候选压缩为序号紧凑行（摘要截 60 字）→ LLM 精排
        seq 守卫防连搜竞态；失败/未配置 → 保持本地结果 + 降级横幅
排序增强
   └─ features/search/lib/frecency.ts
        frecency（30 天半衰期指数衰减）+ adaptive（同词再搜置顶上次选中）
```

向量粗筛为预留扩展（触发时机：书签量 >1000 或纯语义查询失败率明显，见 ADR-003）。

---

## 6. Background Service Worker

`src/background/serviceWorker.ts`。**所有监听器必须在顶层注册**（SW 会休眠，
回调内注册会丢事件）：

- `runtime.onInstalled`：创建右键菜单 + 两个周期 alarm（索引重试 / favicon 补扫）
- `runtime.onStartup`：幂等补建 alarm
- `alarms.onAlarm`：触发 drain（走 `by-indexStatus` 索引批量补索引，滑动窗口并发池）
- `action.onClicked` / `contextMenus.onClicked`：收藏当前页 → 抽正文 → 入 pending → AI 索引
- 消息（`shared/messages/constants.ts` 的 `MSG`）：Background 写库后 `broadcast`，
  所有打开的 newtab 订阅刷新（如 `pendingRemoved` 保证多标签页同步）

已知限制：drain 的 `isDraining`/attempts 为内存态，SW 休眠即丢（技术债，见父目录 PROGRESS）。

---

## 7. 构建 / 测试 / CI

- `npm run dev`：watch 构建到 `dist/`；`npm run build`：`tsc -b && vite build`
- `npm run lint`：ESLint，仓库保持 **0 问题**（进 CI）
- `npm test`：Vitest（`vitest.config.ts` 独立配置，不加载 crx 插件），
  `tests/` 覆盖 localIndex / aiPrompts / searchApi / frecency 共 37 条
- `npm run smoke`：Puppeteer 真实加载 `dist/` 扩展模拟点击 + 截图
  （`screenshots/smoke/`，需人工核对；需显示环境，不进 CI）
- CI（`.github/workflows/ci.yml`）：push main / PR → build + lint + test 三关
- 发版：版本号**四处**同步（package.json / manifest.json / SettingsModal.tsx /
  onboarding `lib/whatsNew.ts` 的 `CURRENT_VERSION`）+ 弹窗 `UPDATES` 文案

---

## 8. UI 浮层约定（踩坑记录见 ADR-002）

- 设置模态 zIndex 280，模态内任何浮层 z-index ≥ 300
- Radix 弹层传 `modal={false}`（默认 true 锁滚动导致背景抖动）
- 实底浮层用 `glass-solid glass-border`，背景/悬停色走 className（不用 inline style）

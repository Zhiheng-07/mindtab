# MindTab Chrome 扩展 · Claude Code 协作指南

> 这个文件会被 Claude Code 自动加载到 context。
> 内容是项目特定的"AI 协作规则"，跟 README.md 互补（README 给人看，这个给 AI 看）。

---

## 项目类型

Chrome MV3 扩展 · React 19 + Vite + TypeScript · 单 HTML 入口（newtab）

## 架构原则（必读）

本项目使用 **feature-sliced 架构**。完整说明见 `docs/ARCHITECTURE.md`。

### 三条铁律

1. `shared/` **绝不** import `features/` 的任何东西
2. 每个 `features/X/` 可以 import `shared/` 的任何东西
3. 跨 feature 导入**只能**通过 barrel export（`from '@/features/Y'`），不能深入到内部文件

违反这三条 = 架构腐化，必须拒绝。

**铁律#3 的唯一例外 —— `db.ts` 数据层**：
`@/features/X/db` 允许被其它 feature / background / newtab 跨 feature 直引。
理由：db 模块是持久化边界，不含 UI / 业务编排，把它们塞进组件 barrel 反而别扭
（和 `@/shared/db` 同理）。**除 `db.ts` 外**，一律走 barrel。
现存合规的跨 feature db 直引：search / settings / sidebar(lib) / background → `bookmarks/db`；
bookmarks(store) → `sidebar/db`。新增同类直引 OK；新增**非-db** 的跨 feature 深引用必须拒绝。

### 同 feature 内部导入

feature **内部**文件互引用**相对路径**（`./db`、`../store`、`../lib/importer`），
不要用 `@/features/<自己>/...` 绕一圈。

### 改动范围约束（默认指引，非硬性限制）

下表是**默认指引**，用来帮你在大多数情况下"改一处只动一个地方"。
它**不是硬性限制**：如果一次改动确实需要跨层（比如改 UI 顺带要调整 store 的数据形状），
**先说明原因再动手**，不要默默跨层、也不要因为表格就拒绝合理的跨层改动。

| 用户的需求 | 你能改哪里 | 你不能改哪里 |
|---|---|---|
| 改 UI 外观 | 对应 feature 的 `components/` 或 `shared/ui/` | `db.ts` / `store.ts` |
| 改数据存储 | `shared/db/` 或 feature 的 `db.ts` | `components/` |
| 改状态逻辑 | feature 的 `store.ts` | 其他 feature 的任何东西 |
| 改 AI 索引 | `shared/lib/aiIndex.ts` 或 `background/serviceWorker.ts` | UI 层 |

## 关键文件

- `src/newtab/App.tsx` —— 唯一的组装入口，只做 modal/drawer 组装 + 少量视图 state。
  数据/编排逻辑在 `src/newtab/useAppController.ts`，头部/主区在 `AppHeader.tsx` / `AppMain.tsx`。
  当前 ~120 行，几乎全是挂载 11 个组件的 JSX；保持在 **150 行以内**（再多说明又混进了逻辑，应回抽到 useAppController 或拆子组件）。
- `src/background/serviceWorker.ts` —— Service Worker 主文件，所有 alarm / contextMenu / action 监听器**必须在顶层注册**（Service Worker 会休眠）
- `shared/db/connection.ts` —— 唯一的 IndexedDB 连接出口，组件不允许直接调用 `indexedDB.open`

## 改代码前必做

1. 读 `docs/ARCHITECTURE.md` 了解整体设计
2. 用户描述的需求落在哪个 feature？只动那个 feature
3. 涉及数据库改动时，**先确认是否需要 schema 迁移**

## 改代码后必做

1. 跑 `npm run build` 确保编译通过
2. **UI 改动必须跑 `npm run smoke`**（Puppeteer 真实加载扩展模拟点击 + 截图），
   并人工查看 `screenshots/smoke/` 截图确认视觉/交互正常后才算完成——
   仅编译通过不代表可用（历史教训：下拉被蒙层遮挡、悬停失效均通过了编译）
3. 如果改了 IndexedDB schema，提醒用户**先在测试环境验证**
4. 如果新增了跨 feature 依赖，提醒用户审查
5. 完成特性后更新 `docs/progress.md`；重要设计决策写入 `docs/adrs/`

## UI 浮层组件约定（历史踩坑，见 docs/adrs/002）

- 设置模态（zIndex 280）内的任何浮层 z-index ≥ 300（如 `z-[300]`）
- Radix 弹层组件默认 `modal={true}` 会锁滚动导致背景抖动 → 传 `modal={false}`
- 实底浮层用 `glass-solid glass-border` class，勿用半透明的 `--mt-bg-primary`
- 背景色/悬停色一律走 className（inline style 会压死 Tailwind hover: 前缀）

## 性能与安全注意

- IndexedDB 写入要走 transaction，禁止裸 `put()` 单写
- AI 接口调用必须走 `shared/lib/api.ts`，不要在组件里直接 fetch
- chrome.storage 写入走 `shared/storage/` 封装，不要直接调 `chrome.storage.local.set`
- 不要往代码里写死 API key：AI 调用必须走 `shared/lib/api.ts`（内部经 `aiClient.ts` 从用户配置读取 key），绝不硬编码任何密钥

## 当前已知问题

（这一栏随时更新，记录尚未修复的已知问题）

- 暂无（2026-06-08 feature-sliced 重构完成，跨 feature import 已审查，仅保留 db 数据层例外）

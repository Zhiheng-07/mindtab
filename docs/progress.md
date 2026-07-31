# 项目进程

> 记录 MindTab 的开发进程：已完成的里程碑、当前焦点、待办计划。
> 每完成一个特性/阶段就更新本文件。版本级变更见 [CHANGELOG.md](../CHANGELOG.md)。

---

## 当前焦点

- v0.2.7 已发版（2026-07-31），观察期：自用验证 + 关注 GitHub Issues

## 待办

- （待定）商店版（mindtab-extension-store）同步本期改动的评估
- （待议）向量粗筛扩展：书签量 >1000 或纯语义查询失败率明显时启动，见 ADR-003

## 已完成

### 2026-07-31 · V0.2.7 发版：版本更新弹窗补发（PR #4）

- 修复 `CURRENT_VERSION` 停在 '0.2.3' 导致 0.2.4~0.2.6 更新弹窗从未触发；合并三版亮点为一个弹窗补发（🔍 搜索全面升级 / 🔑 AI 服务自主绑定 / ✨ 体验细节优化）
- 版本号 bump 0.2.6 → 0.2.7（package.json / manifest.json / SettingsModal.tsx）
- 发版 SOP 规则化：版本号 bump 三处 → 四处（含 `whatsNew.ts`），「发版必须更新弹窗」写入项目级规则
- 验证：build / lint 0 / 37 条单测 / smoke 全绿；Puppeteer 真实模拟老用户升级链路（弹一次 → 确认后不再弹）截图人工核对
- PR #4 → CI 绿 → squash merge → tag `v0.2.7` → [GitHub Release](https://github.com/Zhiheng-07/mindtab/releases/tag/v0.2.7) 挂 `mindtab-v0.2.7.zip`

### 2026-07-31 · lint 清债（PR #3）

- 23 error + 3 warning → **0**：模态重置改「渲染期间调整状态」、Background 用 `useEffectEvent`（避免主题切换重建视频源）、flyout 锚点事件时捕获、shadcn variants / useConfirm / onboarding 存储拆出组件文件、删除死代码 SearchModal
- `npm run lint` 纳入 CI（build + lint + test 三关守门）
- 12 个逻辑单元提交 squash 合并；smoke 全绿无视觉回归

### 2026-07-31 · V0.2.6 发版

- PR #2（CI 首跑通过，28s）→ squash merge → tag `v0.2.6` → [GitHub Release](https://github.com/Zhiheng-07/mindtab/releases/tag/v0.2.6) 挂 `mindtab-v0.2.6.zip`（488K）
- 新增 GitHub Actions CI（`.github/workflows/ci.yml`：push main / PR 自动 build + test）

### 2026-07-31 · V0.2.6 收尾：单元测试体系 + 版本号 bump

- 新增 vitest 测试体系：`tests/` 文件夹 + `vitest.config.ts`（独立配置不加载 crx 插件），`npm test`
- 37 条用例全部通过：localIndex（分词/加权/frecency/adaptive/粗筛边界 14 条）、aiPrompts（格式/截断/抗注入/双形状解析 11 条）、searchApi（序号映射 4 条，mock 网络层）、frecency（衰减/过期 8 条，chrome.storage 内存 stub）
- 版本号三处 bump 0.2.5 → 0.2.6；发布记录草稿 `../版本记录/LATEST_RELEASE_V0.2.6.md`

### 2026-07-30 · V0.2.6 搜索架构改造（待发版）

- 根因修复「AI 搜索慢」：LLM 不再通读全量书签（≤500 条 JSON，数万 token），改为本地粗筛 top 50 后精排（紧凑序号行格式，~3k token），prompt 与 token 成本降一个数量级
- 新增本地索引层 `features/search/lib/localIndex.ts`：MiniSearch（唯一新依赖，~6KB）+ `Intl.Segmenter('zh')` 分词 + CJK bigram 双通道，中文降级搜索从「整句 includes」质变为可用
- 两阶段交互：输入防抖 250ms 即出本地结果（可点击）；回车 AI 精排异步替换，等待期不再整屏 Skeleton；seq 守卫防连搜竞态；↑↓ 方向键导航
- 排序增强 `features/search/lib/frecency.ts`：frecency（30 天半衰期指数衰减）+ adaptive history（同词再搜置顶上次选中）
- 召回 prompt 对齐《02 · AI能力说明》定稿：补回抗注入安全规则、恢复 match_reason 对话语气，新增类型/时间意图理解
- 冒烟扩展：搜索段（预置书签 → 即时结果断言 → 降级链路断言），`npm run smoke` 全绿
- 技术方案留底：`../版本记录/TECH_PLAN_V0.2.6_搜索架构改造.md`；向量层决策见 [ADR-003](adrs/003-search-local-recall-llm-rerank.md)

### 2026-07-26 · AI 服务绑定流程重构（`374e788`）

- 预设厂商 3 家 → 12 家（DeepSeek/OpenAI/Kimi/通义/智谱/豆包/硅基流动/MiniMax/阶跃/小米MiMo/Claude/OpenRouter）
- 厂商选择器 Segmented → DropdownMenu；修复设置模态内 z-index 遮挡与 Radix 滚动锁抖动
- 新增「获取模型列表」（GET /models 拉取账号可用模型），失败回退手动输入
- 测试连接错误语义化；host 权限被拒可「重新授权」
- 建立 Puppeteer UI 冒烟自测流程（`npm run smoke`），交付前必须通过并人工查看截图
- 决策记录：[ADR-001](adrs/001-api-binding-preset-expansion.md)、[ADR-002](adrs/002-provider-selector-dropdown.md)

### 2026-07-26 · 首页筛选栏吸顶动效优化（`a9b714a`）

- Apple 风格强减速曲线 `cubic-bezier(0.16, 1, 0.3, 1)`，吸顶 280ms 滑入+渐显
- 触发阈值提前 20px（滞回带 76/84），消除临界抖动

### 2026-06-17 · V0.2.3（商店线上版本）

- 中转服务防滥用加固配合、WhatsNewModal 修复（详见 CHANGELOG）

### 2026-06-16 · V0.2.1 / V0.2.2

- AI 索引引擎滑动窗口并发池重写；N=2000 drain 7-8min → ~100s
- 中转服务器迁移国内节点

### 2026-06-08 · V0.2 架构重构

- feature-sliced 分层（shared/ + features/），跨 feature 仅 barrel 导入

### 2026-05-28 · V0.1 首发

- Chrome Web Store 上架：一键收藏 + AI 摘要/标签/分类 + 自然语言搜索

### 2026-07-21 · 双文件夹分流

- `mindtab-extension`（开源 BYOK 版，GitHub public）与 `mindtab-extension-store`（商店中转版，私有）分开维护

## 已放弃 / 推迟

- **「只填 API Key 全自动识别厂商」**：技术不可行（Key 格式无法区分厂商，试探会泄露 Key），以预设扩充 + 模型自动拉取替代（见 ADR-001）
- **小米 MiMo 单列预设的早期结论**：曾误判无公开 API，2026-07-26 已纠正并加入预设

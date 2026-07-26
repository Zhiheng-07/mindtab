# 项目进程

> 记录 MindTab 的开发进程：已完成的里程碑、当前焦点、待办计划。
> 每完成一个特性/阶段就更新本文件。版本级变更见 [CHANGELOG.md](../CHANGELOG.md)。

---

## 当前焦点

- v0.2.4 发版（AI 服务绑定重构 + 首页动效优化）

## 待办

- （暂无排期）GitHub Actions CI 流水线：push 时自动跑 build + smoke
- （待定）商店版（mindtab-extension-store）同步本期改动的评估

## 已完成

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

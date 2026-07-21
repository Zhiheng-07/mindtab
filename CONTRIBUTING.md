# 参与贡献 MindTab

感谢你有兴趣参与 MindTab 的开发。这份文档说明如何搭环境、跑起来、以及提 PR 的约定。

---

## 环境要求

- Node.js 20+（LTS 即可）
- npm（随 Node 附带）
- Chrome 浏览器（Manifest V3）

## 本地开发

```bash
npm install        # 装依赖
npm run dev        # 开发模式（watch 构建到 dist/）
npm run build      # 生产构建
```

加载到 Chrome（unpacked）：

1. 打开 `chrome://extensions/`
2. 右上角开启「开发者模式」
3. 点「加载已解压的扩展程序」，选择项目下的 `dist/` 文件夹
4. 打开一个新标签页即可看到 MindTab；改代码后若页面未自动刷新，在扩展管理页点「重新加载」

调试 AI 功能需要在 设置 → AI 服务 里配置你自己的 API Key（详见 README「配置 AI 服务」一节）。

---

## 架构约定（提 PR 前必读）

本项目采用 **feature-sliced 架构**，完整说明见 [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)，AI 协作细则见 [CLAUDE.md](CLAUDE.md)。三条铁律：

1. `src/shared/` **绝不** import `src/features/` 的任何东西
2. 每个 `features/X/` 可以 import `shared/` 的任何东西
3. 跨 feature 导入**只能**通过 barrel export（`from '@/features/Y'`），不能深入内部文件（唯一例外：各 feature 的 `db.ts` 数据层允许直引）

违反这三条的 PR 会被要求修改。其他常见约定：

- 同 feature 内部文件互引用相对路径（`./db`、`../store`），不要绕 `@/features/<自己>/...`
- AI 调用必须走 `shared/lib/api.ts`，不要在组件里直接 fetch；绝不硬编码任何 API Key
- IndexedDB 连接只能来自 `shared/db/connection.ts`；涉及 schema 变更时 PR 里要说明迁移方案
- chrome.storage 读写走 `shared/storage/` 封装

---

## 提交 PR

1. Fork 并从最新主分支拉出特性分支
2. 改动尽量聚焦：一个 PR 解决一件事，只动相关 feature 的文件夹
3. 提交前确保通过：

   ```bash
   npm run build     # 编译必须通过
   npm run lint      # lint 必须通过
   ```

4. PR 描述里写清：改了什么、为什么、怎么验证（涉及 UI 的附截图）
5. 涉及 IndexedDB schema 或跨 feature 依赖的改动，请在描述中显式标注

## 报告问题

提 Issue 时请附上：Chrome 版本、扩展版本、复现步骤、预期与实际行为；涉及 AI 功能的问题请说明所用服务商（不要贴出你的 API Key）。

# ADR-003: 搜索改为「本地粗筛 + LLM 精排」，向量检索暂缓

- 状态：已采纳
- 日期：2026-07-30
- 技术方案全文：`../../../版本记录/TECH_PLAN_V0.2.6_搜索架构改造.md`

## Context

用户反馈 AI 搜索慢、语义识别弱、中文降级搜索失效。根因：每次搜索把全量书签（≤500 条，含完整摘要）JSON 序列化进 prompt（数万 token），LLM prefill 是延迟大头；降级关键词搜索无中文分词。

业界调研结论（Google/Chrome omnibox/Raycast/Perplexity/Raindrop/mymind/Karakeep）：没有产品把 LLM 放在搜索关键路径读全库；标准架构 = 写入时 AI 理解内容 → 查询时本地毫秒级检索 → LLM 只精排 top-N。

## 选项对比

### 选项 A：关键词粗筛 + LLM 精排（采纳）
- ✅ MiniSearch（~6KB）+ Chrome 内置 `Intl.Segmenter('zh')` 分词 + bigram 兜底，零 API 依赖
- ✅ prompt 降一个数量级（~10⁵ → ~10³ token），真实提速 + token 成本同比例下降
- ✅ 对 DeepSeek 用户（无 embeddings 端点）完全可用
- ⚠️ 纯语义零字面重叠查询依赖「新近度兜底 + AI 生成的中文 tags/summary 命中」

### 选项 B：BYOK embeddings 向量粗筛
- ✅ 真语义召回（零字面重叠也能命中）
- ❌ DeepSeek 无 `/embeddings` 端点，需独立 embedding 厂商配置 + 探测降级设计
- ❌ 换厂商需全量重建向量；工程量约为选项 A 的两倍
- 说明：**不涉及向量数据库**——512 维 Float32Array（~2KB/条）存现有 IndexedDB，查询时本地暴力余弦（几千条 <10ms），零运维；1000 条一次性向量化成本 <¥0.2

### 选项 C：transformers.js 本地向量模型
- ✅ 完全离线、零 API 消耗
- ❌ 首次 24MB 模型下载、MV3 SW 生命周期管理复杂、仅 7-star 级开源先例

## 决策

采纳 A，B 作为后续扩展（触发时机：书签量 >1000 或纯语义查询失败率明显——即《02 · AI能力说明》P1 规划节奏）。C 否决。

为 B 预留的接口：`localIndex.buildCandidates()` 是唯一候选源出口，向量召回未来作为第二路并联（RRF 按排名融合），LLM 精排链路无需改动。

## 关键实现约定

1. 精排 prompt 用**序号**指代候选（省 token、抄错率低），`api.ts` 内部映射回真实 id，对外签名不变
2. `parseSearchResponse` 双形状兼容：数字 `i` 优先，旧 `id` 字符串仅在属于候选集时接受
3. 两阶段结果替换的并发守卫：`useSearch` 内 `seqRef`，preview/search/reset 均推进 seq，旧异步结果静默丢弃
4. `aiClient.ts` 完全不动（`chat ${status}:` 错误格式是 `aiIndex.isTransientError` 的契约）
5. 候选 ≤50 条全量直传；`aiPrompts` 内保留 500 上限安全网

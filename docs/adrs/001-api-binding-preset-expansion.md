# ADR-001: AI 服务绑定采用「预设扩充 + 模型自动拉取」而非全自动探测

- 状态：已采纳
- 日期：2026-07-26
- 相关 commit：`374e788`

## Context

用户期望的理想体验是「只填 API Key，其他什么都不用填」。需要评估自动识别厂商的可行性。

## 选项对比

### 选项 A：拿 Key 挨个试探各厂商服务器（全自动）
- ✅ 体验最接近理想
- ❌ **安全不可接受**：会把用户的 Key 发给一堆不相关的厂商（如把 DeepSeek Key 发给 OpenAI），泄露风险
- ❌ Key 格式高度雷同（DeepSeek/Kimi/通义/OpenAI 都是 `sk-` 开头），无法从格式预判
- ❌ 每个候选域名都要弹一次 Chrome host 权限授权，体验反而更差

### 选项 B：预设厂商扩充 + 填 Key 后自动拉取模型列表（采纳）
- ✅ 用户流程简化为「点厂商 → 粘贴 Key →（可选）拉取模型列表选择」
- ✅ Key 只发给用户明确选择的那一家厂商
- ✅ `GET /v1/models` 是 OpenAI 兼容标准，绝大多数厂商支持
- ⚠️ 个别厂商（豆包 Ark、阶跃）/models 不可用 → 失败回退手动输入，语义化文案引导

## 决策

采纳选项 B。预设扩至 12 家（含国内主流 + Claude + OpenRouter 聚合），`fetchModels()` 拉取账号真实可用模型填充下拉。

## 影响

- `AiConfig` 存储结构不变（provider/apiKey/baseUrl/model 四字段），老配置完全兼容
- 新预设厂商全部走 OpenAI 兼容协议（Claude 走 Anthropic 的 OpenAI 兼容层）
- 拉取的模型列表仅存组件 state，不持久化——每次打开设置重新拉取

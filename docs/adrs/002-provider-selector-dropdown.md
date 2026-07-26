# ADR-002: 厂商选择器从 Segmented 按钮组改为 DropdownMenu

- 状态：已采纳
- 日期：2026-07-26
- 相关 commit：`374e788`

## Context

预设厂商从 3 家扩到 12 家后，原 Segmented 按钮组单行放不下；换行（flexWrap）后视觉拥挤，用户明确否决。

## 选项对比

### 选项 A：Segmented + flexWrap 换行
- ✅ 改动最小
- ❌ 12+ 项换行后拥挤、不美观，用户实测否决

### 选项 B：引入 @radix-ui/react-select 新依赖
- ✅ 语义上最正统（表单选择器）
- ❌ 新增依赖；项目已有 DropdownMenu 能力重复

### 选项 C：复用项目已有 DropdownMenu（RadioGroup 模式）（采纳）
- ✅ 零新依赖（`@radix-ui/react-dropdown-menu` 已在 ContextMenu 使用）
- ✅ `DropdownMenuRadioGroup` + `DropdownMenuRadioItem` 就是单选下拉语义
- ✅ 视觉语言与项目现有右键菜单一致

## 决策

采纳选项 C。

## 落地时踩的坑（重要，后续模态内浮层组件都要注意）

1. **z-index 遮挡**：`DropdownMenuContent` 默认 `z-50`，而设置模态蒙层 `zIndex: 280` → 下拉打开了但被蒙层盖住，表象是"点击无反应"。修复：调用方传 `className="z-[300]"`。
   **约定：设置模态内的任何浮层 z-index ≥ 300。**
2. **背景抖动**：Radix 弹层默认 `modal={true}` 会锁 body 滚动、抽掉滚动条 → 页面宽度跳变。修复：`modal={false}`。
3. **半透明穿帮**：自绘浮层若用 `var(--mt-bg-primary)` 做背景是半透明的；实底浮层统一用 `glass-solid glass-border` class（与 DropdownMenuContent 一致）。
4. **inline style 压死 hover**：`style={{ background: ... }}` 优先级高于 Tailwind `hover:bg-[...]`，悬停态失效。背景色一律走 className 条件拼接，不进 inline style。

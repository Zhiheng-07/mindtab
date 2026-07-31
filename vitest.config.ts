// Vitest 独立配置：不复用 vite.config.ts（crx 插件需要扩展上下文，测试环境不加载）。
// 只提供 @ 别名解析；测试跑在 Node 环境（被测对象为纯函数/存储封装，无 DOM 依赖）。

import path from 'node:path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
})

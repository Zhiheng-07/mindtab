// AI 配置状态检测 hook。
// 提供 useAiConfigured() 给任何 UI 组件同步读取缓存后的配置状态，
// 避免各组件各自重复调用 chrome.storage（isAiConfigured()）。
//
// refreshAiStatus() 供 App.tsx 等在设置关闭后主动刷新缓存。
//
// 搜索模块（useSearch）已有先例：直接调用 isAiConfigured() 做降级判断。
// 这里统一成带缓存的 hook，减少异步读取次数。

import { useEffect, useState } from 'react'
import { isAiConfigured } from './aiProvider'

// 模块级缓存：避免多个组件并行重复读 chrome.storage
let cachedConfigured: boolean | null = null
const listeners = new Set<(v: boolean) => void>()

/** 强制刷新 AI 配置缓存。设置保存/关闭后调用。返回当前配置状态。 */
export async function refreshAiStatus(): Promise<boolean> {
  cachedConfigured = await isAiConfigured()
  listeners.forEach((fn) => fn(cachedConfigured!))
  return cachedConfigured
}

/**
 * React hook：AI 配置状态，首次读取 chrome.storage 完成前为 null。
 * 供需要区分「未读取」与「未配置」的 UI 使用（如未配置横幅：读取完成前不渲染，避免已配置用户看到闪烁）。
 * refreshAiStatus() 被调用时自动更新所有挂载的组件。
 */
export function useAiConfiguredState(): boolean | null {
  const [configured, setConfigured] = useState<boolean | null>(cachedConfigured)

  useEffect(() => {
    if (cachedConfigured === null) {
      void refreshAiStatus().then(setConfigured)
    }
    listeners.add(setConfigured)
    return () => {
      listeners.delete(setConfigured)
    }
  }, [])

  return configured
}

/**
 * React hook：AI 是否已配置。
 *
 * - 首次调用（缓存 null）时异步读 chrome.storage，返回 false 兜底。
 * - 缓存有值后同步返回；refreshAiStatus() 被调用时自动更新所有挂载的组件。
 */
export function useAiConfigured(): boolean {
  return useAiConfiguredState() === true
}

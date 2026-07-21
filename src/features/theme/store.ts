import { create } from 'zustand'
import { get as storageGet, set as storageSet, STORAGE_KEYS } from '@/shared/storage'

export type ThemeMode = 'system' | 'light' | 'dark'

interface ThemeState {
  mode: ThemeMode
  /** 实际生效的主题（system 模式下根据 prefers-color-scheme 决定）*/
  effective: 'light' | 'dark'
  hydrate: () => Promise<void>
  setMode: (m: ThemeMode) => Promise<void>
  cycle: () => Promise<void>
}

function computeEffective(mode: ThemeMode): 'light' | 'dark' {
  if (mode === 'system') {
    return typeof window !== 'undefined' &&
      window.matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light'
  }
  return mode
}

function applyToDom(mode: ThemeMode): void {
  const html = document.documentElement
  if (mode === 'system') {
    html.removeAttribute('data-theme')
  } else {
    html.setAttribute('data-theme', mode)
  }
}

export const useThemeStore = create<ThemeState>((set, get) => ({
  mode: 'dark',
  effective: 'dark',

  hydrate: async () => {
    const mode = await storageGet<ThemeMode>(STORAGE_KEYS.darkMode, 'dark')
    applyToDom(mode)
    set({ mode, effective: computeEffective(mode) })

    // 监听系统主题变化（当 mode === 'system' 时）
    if (typeof window !== 'undefined' && window.matchMedia) {
      const mql = window.matchMedia('(prefers-color-scheme: dark)')
      const handler = () => {
        if (get().mode === 'system') {
          set({ effective: mql.matches ? 'dark' : 'light' })
        }
      }
      mql.addEventListener?.('change', handler)
    }
  },

  setMode: async (m) => {
    applyToDom(m)
    await storageSet<ThemeMode>(STORAGE_KEYS.darkMode, m)
    set({ mode: m, effective: computeEffective(m) })
  },

  cycle: async () => {
    const cur = get().mode
    const next: ThemeMode = cur === 'system' ? 'light' : cur === 'light' ? 'dark' : 'system'
    await get().setMode(next)
  },
}))

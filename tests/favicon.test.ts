// favicon 工具纯函数测试：rootDomain / isServiceFavicon / isGenericFavicon
import { describe, expect, it } from 'vitest'
import {
  isGenericFavicon,
  isServiceFavicon,
  rootDomain,
} from '@/shared/lib/favicon'

describe('rootDomain', () => {
  it('子域名 → 根域', () => {
    expect(rootDomain('kimi.moonshot.cn')).toBe('moonshot.cn')
    expect(rootDomain('a.b.example.com')).toBe('example.com')
  })

  it('双段公共后缀取三段', () => {
    expect(rootDomain('www.example.com.cn')).toBe('example.com.cn')
    expect(rootDomain('news.bbc.co.uk')).toBe('bbc.co.uk')
  })

  it('已是根域 → null', () => {
    expect(rootDomain('example.com')).toBeNull()
    expect(rootDomain('example.com.cn')).toBeNull()
  })

  it('IP / localhost / 单段 → null', () => {
    expect(rootDomain('192.168.1.1')).toBeNull()
    expect(rootDomain('localhost')).toBeNull()
    expect(rootDomain('[::1]')).toBeNull()
  })
})

describe('isServiceFavicon', () => {
  it('识别 DDG 与 Google s2 服务 URL', () => {
    expect(isServiceFavicon('https://icons.duckduckgo.com/ip3/x.com.ico')).toBe(true)
    expect(
      isServiceFavicon('https://www.google.com/s2/favicons?domain=x.com&sz=64'),
    ).toBe(true)
  })

  it('站点真实图标 URL 不误判', () => {
    expect(isServiceFavicon('https://example.com/favicon.ico')).toBe(false)
    expect(isServiceFavicon('https://cdn.example.com/icon.png')).toBe(false)
  })
})

describe('isGenericFavicon', () => {
  it('仅匹配本域通用路径', () => {
    expect(isGenericFavicon('https://example.com/favicon.ico', 'example.com')).toBe(true)
    expect(isGenericFavicon('https://example.com/favicon.png', 'example.com')).toBe(false)
    expect(isGenericFavicon('https://other.com/favicon.ico', 'example.com')).toBe(false)
  })
})

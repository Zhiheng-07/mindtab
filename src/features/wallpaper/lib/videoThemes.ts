// 视频背景主题预设
// 后续在设置面板中让用户选择不同主题

export interface VideoTheme {
  id: string
  name: string
  /** 深色模式视频 URL */
  darkUrl: string
  /** 浅色模式视频 URL */
  lightUrl: string
  /** 深色视频 objectFit */
  darkFit?: 'cover' | 'contain'
  /** 深色视频位移（CSS transform） */
  darkTransform?: string
  /** 浅色视频 objectFit */
  lightFit?: 'cover' | 'contain'
}

export const VIDEO_THEMES: VideoTheme[] = [
  {
    id: 'flora',
    name: '花漫',
    darkUrl:
      'https://mindtab-assets-1316694721.cos.ap-shanghai.myqcloud.com/videos/pingpong.mp4',
    lightUrl:
      'https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260525_054404_f1935fea-5c67-4e9c-a5d1-80fa249ccb33.mp4',
    darkFit: 'contain',
    darkTransform: 'translateY(15%)',
    lightFit: 'cover',
  },
]

export const DEFAULT_THEME_ID = 'flora'

/** 根据 ID 查找主题，找不到返回默认 */
export function getTheme(id: string): VideoTheme {
  return VIDEO_THEMES.find((t) => t.id === id) ?? VIDEO_THEMES[0]
}

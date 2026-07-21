// 热门站点静态 favicon 映射
// 覆盖被墙、Cloudflare 防护、或 server 无法 fetch 的站点。
// URL 从各站点 HTML <link rel="icon"> 手动提取，零网络请求。

export const FAVICON_MAP: Record<string, string> = {
  // ── 国际被墙站点 ──
  'chatgpt.com':           'https://cdn.oaistatic.com/assets/apple-touch-icon-mz9nyA.png',
  'chat.openai.com':       'https://cdn.oaistatic.com/assets/apple-touch-icon-mz9nyA.png',
  'www.figma.com':         'https://static.figma.com/app/icon/1/favicon.png',
  'figma.com':             'https://static.figma.com/app/icon/1/favicon.png',
  'x.com':                 'https://abs.twimg.com/responsive-web/client-web/icon-ios.77d25eba.png',
  'twitter.com':           'https://abs.twimg.com/responsive-web/client-web/icon-ios.77d25eba.png',
  'www.youtube.com':       'https://www.youtube.com/s/desktop/0e9d1cf5/img/favicon_144x144.png',
  'youtube.com':           'https://www.youtube.com/s/desktop/0e9d1cf5/img/favicon_144x144.png',
  'www.google.com':        'https://www.google.com/images/branding/googleg/1x/googleg_standard_color_128dp.png',
  'google.com':            'https://www.google.com/images/branding/googleg/1x/googleg_standard_color_128dp.png',
  'www.reddit.com':        'https://www.redditstatic.com/desktop2x/img/favicon/apple-icon-180x180.png',
  'reddit.com':            'https://www.redditstatic.com/desktop2x/img/favicon/apple-icon-180x180.png',
  'stackoverflow.com':     'https://cdn.sstatic.net/Sites/stackoverflow/Img/apple-touch-icon.png',
  'www.npmjs.com':         'https://static-production.npmjs.com/1996fcfdf7ca81ea795f67f093d7f449.png',
  'npmjs.com':             'https://static-production.npmjs.com/1996fcfdf7ca81ea795f67f093d7f449.png',
  'medium.com':            'https://miro.medium.com/v2/1*m-R_BkNf1Qjr1YbyOIJY2w.png',
  'wikipedia.org':         'https://www.wikipedia.org/static/apple-touch/wikipedia.png',
  'en.wikipedia.org':      'https://www.wikipedia.org/static/apple-touch/wikipedia.png',
  'zh.wikipedia.org':      'https://www.wikipedia.org/static/apple-touch/wikipedia.png',

  // ── 国际开发者站点（部分在中国访问慢）──
  'github.com':            'https://github.githubassets.com/favicons/favicon.svg',
  'gitlab.com':            'https://gitlab.com/assets/favicon-72a2cad5025aa931d6ea56c3201d1f18e68a8571148571a3cede91946425033a.png',
  'codepen.io':            'https://cpwebassets.codepen.io/assets/favicon/apple-touch-icon-5ae1a0698dcc2402e9712f7d01ed509a57814f994c660df9f7a952f3060571.png',
  'vercel.com':            'https://vercel.com/apple-touch-icon.png',

  // ── AI 产品（SPA 全路径 catch-all 或 Cloudflare 防护，server 无法可靠发现）──
  'www.doubao.com':        'https://lf-flow-web-cdn.doubao.com/obj/flow-doubao/favicon/128x128.png',
  'doubao.com':            'https://lf-flow-web-cdn.doubao.com/obj/flow-doubao/favicon/128x128.png',
  'tongyi.aliyun.com':     'https://img.alicdn.com/imgextra/i3/O1CN01k8nC9v1NYbgbBe3VM_!!6000000001582-2-tps-100-100.png',
  'kimi.moonshot.cn':      'https://statics.moonshot.cn/kimi-chat/favicon.ico',
  'claude.ai':             'https://cdn.prod.website-files.com/6889473510b50328dbb70ae6/68c33859cc6cd903686c66a2_apple-touch-icon.png',
  'chat.deepseek.com':     'https://cdn.deepseek.com/chat/icon.png',

  // ── 中国站点（大部分 server 能自动发现，此处做即时加速）──
  'v2ex.com':              'https://www.v2ex.com/static/icon-192.png',
  'www.v2ex.com':          'https://www.v2ex.com/static/icon-192.png',
}

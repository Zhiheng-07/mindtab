// MindTab Background Service Worker (MV3)
// 收藏入口：扩展图标点击 + 右键菜单。
// 写入流程：校验 → 去重 → 容量 → 写 pending → 广播 mt:pending-added → 反馈 Toast / badge。

import { findByUrl, type Bookmark, type PendingBookmark } from '@/shared/db'
import {
  addBookmark,
  getAllBookmarks,
  updateBookmark,
  getUnindexedBatch,
  countUnindexed,
} from '@/features/bookmarks/db'
import { addPending, getPendingCount } from '@/features/pending/db'
import { MSG, broadcast } from '@/shared/messages'
import { runIndexing, runBatchIndexing, isTransientError } from '@/shared/lib/aiIndex'
import { getAiConfig, hasHostPermission } from '@/shared/lib/aiProvider'
import { remove as storageRemove } from '@/shared/storage'
import { faviconUrl, isGenericFavicon } from '@/shared/lib/favicon'
import { discoverFavicon } from '@/shared/lib/faviconDiscovery'
import { FAVICON_MAP } from '@/shared/lib/faviconMap'

const MAX_PENDING = 10
const CTX_MENU_ID = 'mindtab-save'
const RETRY_ALARM = 'mindtab-retry-index'
const FAVICON_ALARM = 'mindtab-favicon-discover'
const RETRY_PERIOD_MIN = 0.5  // alarm 每 30 秒一次（Chrome 117+ 最小 30s）
const RETRY_BATCH = 30        // tickRetry 单次（alarm 触发）最多处理 30 条
const BATCH_SIZE = 5          // 每 5 条合一次 API 调用（后端放开 items 上限前保持 5）
const FAVICON_BATCH = 10      // 每轮 favicon 发现最多 10 个域名

// drain 滑动窗口并发：同时在途的批请求数。先取 2 压测，吞吐够就停，不够再调。
// CONCURRENCY × BATCH_SIZE = 同时在途的书签条数（2×5=10）。
const CONCURRENCY = 2
// 整批瞬时失败（网络/超时/429/5xx）的指数退避：base 500ms，每次翻倍，封顶 8s。
const BACKOFF_BASE_MS = 500
const BACKOFF_CAP_MS = 8000

// ───── 监听器必须在顶层注册（Service Worker 可能被休眠重启）─────

chrome.runtime.onInstalled.addListener((details) => {
  chrome.contextMenus.create({
    id: CTX_MENU_ID,
    title: '收藏到 MindTab',
    contexts: ['page', 'link'],
  })
  chrome.alarms.create(RETRY_ALARM, { periodInMinutes: RETRY_PERIOD_MIN })
  chrome.alarms.create(FAVICON_ALARM, { periodInMinutes: RETRY_PERIOD_MIN })
  if (details.reason === 'update') {
    // 中转时代遗留的搜索配额记录已无意义（用户自带 key），升级时清掉。
    // key 字面量而非 STORAGE_KEYS.searchQuota：该常量由 P3 连同配额逻辑一起移除。
    void storageRemove('mt:searchQuota')
  }
  console.log('[MindTab] installed: ctx menu + retry alarm + favicon alarm registered')
})

chrome.runtime.onStartup.addListener(() => {
  // SW 启动时也确保 alarm 存在
  chrome.alarms.get(RETRY_ALARM, (a) => {
    if (!a) chrome.alarms.create(RETRY_ALARM, { periodInMinutes: RETRY_PERIOD_MIN })
  })
  chrome.alarms.get(FAVICON_ALARM, (a) => {
    if (!a) chrome.alarms.create(FAVICON_ALARM, { periodInMinutes: RETRY_PERIOD_MIN })
  })
})

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === RETRY_ALARM) void tickRetry()
  if (alarm.name === FAVICON_ALARM) void tickFaviconDiscovery()
})

chrome.action.onClicked.addListener((tab) => {
  void saveTab(tab, { withContent: true })
})

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId !== CTX_MENU_ID) return
  // 右键菜单可能带 linkUrl（在链接上右键），优先用它
  const targetUrl = info.linkUrl ?? tab?.url
  if (!targetUrl || !tab) return
  const sameUrl = targetUrl === tab.url
  void saveTab(
    { ...tab, url: targetUrl, title: sameUrl ? tab.title : '' },
    { withContent: sameUrl }, // 链接右键时不抽当前页正文
  )
})

// UI 端消息路由
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type === MSG.saveUrl && msg.payload?.url) {
    // 用户在 + 添加网址 里显式输入 → 跳过 pending 直接入库
    void saveUrlDirect(msg.payload.url, msg.payload.title).then(
      (info) => sendResponse({ ok: true, ...info }),
      (e) => sendResponse({ ok: false, error: (e as Error).message }),
    )
    return true
  }
  if (msg?.type === MSG.retryIndex) {
    // 用户手动点"立即重试" → 全量补齐（持续跑直到队列清空或本轮重试上限）
    void drainAllPending().then(
      (r) => sendResponse({ ok: true, ...r }),
      (e) => sendResponse({ ok: false, error: (e as Error).message }),
    )
    return true
  }
  if (msg?.type === MSG.triggerDrain) {
    // 导入完成后立即触发排空，不等 alarm
    void drainAllPending()
    sendResponse?.({ ok: true })
    return true
  }
})

// + 添加网址：直接写 bookmarks（用户已确认 URL，不需要再走 pending）
async function saveUrlDirect(
  rawUrl: string,
  rawTitle: string | undefined,
): Promise<{ duplicated?: boolean; id?: string }> {
  const reason = unsupportedReason(rawUrl)
  if (reason) throw new Error(reason)
  const existing = await findByUrl(rawUrl)
  if (existing) return { duplicated: true }

  const domain = safeHost(rawUrl)
  const title = (rawTitle ?? '').trim() || domain
  const bookmark: Bookmark = {
    id: crypto.randomUUID(),
    url: rawUrl,
    title,
    favicon: faviconUrl(domain),
    domain,
    summary: '',
    tags: [],
    contentType: '',
    folderId: null,
    pinnedIn: [],
    createdAt: Date.now(),
    lastOpenedAt: Date.now(),
    indexStatus: 'indexing',
    order: Date.now(),
  }
  await addBookmark(bookmark)
  broadcast({ type: MSG.bookmarkAdded, payload: { id: bookmark.id } })

  // 后台异步索引（无 tab 内容，靠 URL + title 推断）
  void runIndexing({
    id: bookmark.id,
    url: rawUrl,
    title,
    content: '',
    allowTitleReplace: !rawTitle || rawTitle.trim() === '' || rawTitle.trim() === domain,
  })

  return { id: bookmark.id }
}

// AI 可用性守卫：未配置 API key 或缺少目标域名 host 权限时，drain/retry 静默跳过。
// pending 记录原地保留，用户配好 key 后 alarm 自动恢复排空。
// SW 内禁止调 chrome.permissions.request（需要用户手势），只做 contains 检查。
async function aiReady(): Promise<boolean> {
  const cfg = await getAiConfig()
  if (!cfg) return false
  return hasHostPermission(cfg.baseUrl)
}

// 一次性 tick（alarm 30s 触发）：走索引取 RETRY_BATCH 条 pending，按 BATCH_SIZE 分组并行。
// 如果正在 drain，跳过，避免叠加并发。
async function tickRetry(): Promise<number> {
  if (isDraining) return 0
  if (!(await aiReady())) return 0
  const candidates = await getUnindexedBatch(RETRY_BATCH)
  if (candidates.length === 0) return 0

  const batches = chunk(candidates, BATCH_SIZE)
  await Promise.allSettled(
    batches.map((batch) =>
      runBatchIndexing(
        batch.map((b) => ({
          id: b.id,
          url: b.url,
          title: b.title,
          content: '',
          allowTitleReplace: false,
        })),
      ),
    ),
  )
  console.log(`[MindTab] tick: processed ${candidates.length} in ${batches.length} batches`)
  return candidates.length
}

// 全量排空：滑动窗口并发池跑到队列清空。批量 API 大幅减少 HTTP 开销，
// CONCURRENCY 个批请求同时在途、任一完成立即补位，消除原「凑满一轮齐发」的队头阻塞。
// 同条目本轮最多 MAX_RETRIES 次重试（避免 DNS/API 长断时无限打）。
// 注意：attempts / isDraining 仍是内存态，SW 休眠重启即丢——断点续传(#4)推迟阶段二。
let isDraining = false
const MAX_RETRIES_PER_ITEM = 2

interface PendingItem {
  id: string
  url: string
  title: string
}

async function drainAllPending(): Promise<{
  done: number
  attempted: number
  skipped: number
}> {
  if (isDraining) return { done: 0, attempted: 0, skipped: 0 }
  if (!(await aiReady())) return { done: 0, attempted: 0, skipped: 0 }
  isDraining = true
  const attempts = new Map<string, number>()
  let done = 0
  let attempted = 0

  // 当前退避延迟（ms）：整批瞬时失败时翻倍，成功时清零。各 worker 共享。
  // 多 worker 并发读写 backoffMs 有轻微 race（如 A 失败设 500 同时 B 也设 500，
  // 或 A 成功清 0 同时 B 失败设 500 而非 4000），但所有 race 收敛方向都是「退避变保守」，
  // 不致命，故不加锁。
  let backoffMs = 0

  // inFlight：本轮 drain 中已被 worker 取走、尚未处理完的 record id。
  // refill 必须排除这些 id，否则 record 在 DB 里 indexStatus='pending' 期间会被
  // 另一个 worker 重复取到，导致 done/attempted 翻倍、attempts 提前撞 MAX_RETRIES。
  const inFlight = new Set<string>()

  try {
    // 内存批队列：从索引按块取 pending，切成 BATCH_SIZE 的批喂给并发池。
    let queue: PendingItem[][] = []

    // 续取下一块到队列。返回是否取到新条目。
    // 用 in-flight promise 互斥：多 worker 同时 refill 时，后到者直接拿到第一个的
    // promise，不会重复执行抽取逻辑（否则 await getUnindexedBatch 让出 microtask
    // 期间两个 refill 会并发跑，导致 attempts 双倍加、queue 被覆盖、同批 record 双倍处理）。
    let refilling: Promise<boolean> | null = null
    const refill = async (): Promise<boolean> => {
      if (refilling) return refilling
      refilling = (async () => {
        try {
          // 一次取一个窗口的量，过滤掉「已在途」和「已达重试上限」的条目。
          // 排除 inFlight 是关键：record 写 done 前 DB 里仍是 pending，会被重复取到。
          const block = (await getUnindexedBatch(CONCURRENCY * BATCH_SIZE)).filter(
            (b) => !inFlight.has(b.id) && (attempts.get(b.id) ?? 0) < MAX_RETRIES_PER_ITEM,
          )
          if (block.length === 0) return false
          for (const b of block) {
            attempts.set(b.id, (attempts.get(b.id) ?? 0) + 1)
            inFlight.add(b.id)
          }
          attempted += block.length
          queue = chunk(
            block.map((b) => ({ id: b.id, url: b.url, title: b.title })),
            BATCH_SIZE,
          )
          return true
        } finally {
          refilling = null
        }
      })()
      return refilling
    }

    // 单个 worker：循环从队列领批 → 索引 → 据结果退避；队列空则尝试 refill。
    const worker = async (): Promise<void> => {
      while (true) {
        if (backoffMs > 0) {
          await sleep(backoffMs)
        }
        let batch = queue.shift()
        if (!batch) {
          // 队列空 → refill（用 in-flight promise 互斥，避免多 worker 同时 refill 导致重复抽取）
          const got = await refill()
          if (!got) {
            // refill 取不到，需区分两种情况：
            //  a) DB 里一条 pending 都没有 → 真完成，退出
            //  b) 剩余 pending 都被其它 worker 占在 inFlight 里 → 不能退，否则它们若失败
            //     回退 pending 后没人重试，留下永久 pending。短暂让步后重试。
            if ((await countUnindexed()) === 0) return
            await sleep(50)
            continue
          }
          batch = queue.shift()
          if (!batch) continue
        }

        const outcome = await runBatchIndexing(
          batch.map((b) => ({
            id: b.id,
            url: b.url,
            title: b.title,
            content: '',
            allowTitleReplace: false,
          })),
        )
        // 本批处理完 → 释放在途标记，让下一轮 refill 能正确判断剩余 pending。
        // 失败的条目已回退 pending，释放后会被后续 refill 重新取到（受 attempts 上限约束）。
        for (const item of batch) inFlight.delete(item.id)
        done += outcome.succeeded

        if (outcome.batchError && isTransientError(outcome.batchError)) {
          // 整批瞬时失败 → 指数退避（共享变量，影响后续所有 worker 取批节奏）
          backoffMs = backoffMs === 0
            ? BACKOFF_BASE_MS
            : Math.min(backoffMs * 2, BACKOFF_CAP_MS)
          console.warn(
            `[MindTab] drain transient fail, backoff ${backoffMs}ms: ${outcome.batchError.message}`,
          )
        } else if (outcome.batchError) {
          // 非瞬时（如 4xx 业务错误）→ 不退避，条目已回 pending、靠重试上限收敛
          console.warn('[MindTab] drain non-transient fail:', outcome.batchError.message)
        } else {
          backoffMs = 0 // 成功 → 清退避
        }
      }
    }

    // 启动 CONCURRENCY 个 worker，全部跑完即排空
    await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()))

    const remaining = await countUnindexed()
    console.log(`[MindTab] drain done: +${done}/${attempted} attempted, remaining=${remaining}`)
  } finally {
    isDraining = false
  }
  const skipped = [...attempts.values()].filter(
    (n) => n >= MAX_RETRIES_PER_ITEM,
  ).length
  return { done, attempted, skipped }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

// ───── Favicon 后台发现 ─────

// 按域名去重：同域名只处理一次。先查静态映射，再调 server。
// 一轮结束后只广播一次，避免 N 次 hydrate 导致闪动。
async function tickFaviconDiscovery(): Promise<number> {
  const all = await getAllBookmarks()

  // 找出 favicon 为通用 /favicon.ico 的书签，按域名分组
  const domainMap = new Map<string, Bookmark[]>()
  for (const b of all) {
    if (isGenericFavicon(b.favicon, b.domain)) {
      const group = domainMap.get(b.domain)
      if (group) group.push(b)
      else domainMap.set(b.domain, [b])
    }
  }
  if (domainMap.size === 0) return 0

  const domains = [...domainMap.keys()].slice(0, FAVICON_BATCH)
  let updated = 0

  await Promise.allSettled(
    domains.map(async (domain) => {
      const bookmarks = domainMap.get(domain)!

      // 优先查静态映射（零网络请求）
      let discovered: string | null = FAVICON_MAP[domain] ?? null

      // 静态映射未命中 → 调 server API
      if (!discovered) {
        const sampleUrl = bookmarks[0].url
        discovered = await discoverFavicon(sampleUrl, domain)
      }
      if (!discovered) return

      for (const b of bookmarks) {
        try {
          await updateBookmark(b.id, { favicon: discovered })
          updated++
        } catch {
          // 书签可能已被删除
        }
      }
    }),
  )

  // 批量广播：一轮结束后只触发一次 hydrate，消除闪动
  if (updated > 0) {
    broadcast({ type: MSG.bookmarkChanged, payload: { id: '' } })
    console.log(
      `[MindTab] favicon discovery: updated ${updated} bookmarks across ${domains.length} domains`,
    )
  }
  return updated
}

// ───── 工具 ─────

function chunk<T>(arr: T[], size: number): T[][] {
  const result: T[][] = []
  for (let i = 0; i < arr.length; i += size) {
    result.push(arr.slice(i, i + size))
  }
  return result
}

// ───── 主流程 ─────

interface SaveOptions {
  withContent: boolean
}

async function saveTab(
  tab: chrome.tabs.Tab | undefined,
  opts: SaveOptions,
): Promise<void> {
  if (!tab?.url) {
    return notify('error', '该页面不支持收藏')
  }
  const url = tab.url
  const reason = unsupportedReason(url)
  if (reason) {
    return notify('info', reason)
  }

  try {
    const existing = await findByUrl(url)
    if (existing) {
      return notify('info', '该页面已在收藏库中')
    }

    const count = await getPendingCount()
    if (count >= MAX_PENDING) {
      return notify('warning', '待确认面板已满，请先处理')
    }

    const domain = safeHost(url)
    const rawTitle = (tab.title ?? '').trim()
    const title = rawTitle || domain
    const favicon = tab.favIconUrl?.trim()
      ? tab.favIconUrl
      : faviconUrl(domain)

    const item: PendingBookmark = {
      id: crypto.randomUUID(),
      url,
      title,
      favicon,
      domain,
      summary: '',
      tags: [],
      contentType: '',
      createdAt: Date.now(),
      indexStatus: 'indexing',
    }

    await addPending(item)
    await flashBadge('✓')
    broadcast({ type: MSG.pendingAdded, payload: item })

    // 异步索引（不阻塞用户反馈）
    const content = opts.withContent && tab.id != null
      ? await extractContent(tab.id)
      : ''
    void runIndexing({
      id: item.id,
      url,
      title,
      content,
      allowTitleReplace: !rawTitle || rawTitle === domain,
    })
  } catch (e) {
    notify('error', `收藏失败：${(e as Error).message}`)
  }
}

async function extractContent(tabId: number): Promise<string> {
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => {
        // 优先 article > main > body 文本
        const el =
          (document.querySelector('article') as HTMLElement | null) ??
          (document.querySelector('main') as HTMLElement | null) ??
          document.body
        return (el?.innerText ?? '').slice(0, 8000)
      },
    })
    return results[0]?.result ?? ''
  } catch (e) {
    console.warn('[MindTab] extractContent failed:', (e as Error).message)
    return ''
  }
}

// ───── 边界 ─────

function unsupportedReason(url: string): string | null {
  if (
    url.startsWith('chrome://') ||
    url.startsWith('chrome-extension://') ||
    url.startsWith('edge://') ||
    url.startsWith('about:') ||
    url.startsWith('chrome.google.com/webstore') ||
    url.startsWith('https://chrome.google.com/webstore') ||
    url.startsWith('https://chromewebstore.google.com')
  ) {
    return '该页面不支持收藏'
  }
  return null
}

function safeHost(url: string): string {
  try {
    return new URL(url).hostname
  } catch {
    return url
  }
}

// ───── 反馈 ─────

function notify(
  kind: 'success' | 'info' | 'warning' | 'error',
  message: string,
): void {
  // 没有 newtab 打开时，sendMessage 会失败，先尝试发广播
  chrome.runtime
    .sendMessage({
      type: 'mt:toast',
      payload: { kind, message },
    })
    .catch(() => {
      // 没监听者时退化为 badge 闪一下
      void flashBadge(kind === 'error' ? '!' : '·')
    })
}

let badgeResetTimer: number | undefined
async function flashBadge(text: string): Promise<void> {
  await chrome.action.setBadgeText({ text })
  await chrome.action.setBadgeBackgroundColor({ color: '#191919' })
  if (badgeResetTimer) clearTimeout(badgeResetTimer)
  badgeResetTimer = setTimeout(() => {
    void chrome.action.setBadgeText({ text: '' })
  }, 1500) as unknown as number
}

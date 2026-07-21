// AI 索引编排：调 API → 写库 → 广播。
// 在 Background SW 中 fire-and-forget 调用，UI 不直接持有。

import { indexBookmark, indexBookmarkBatch } from './api'
import { AiNotConfiguredError } from './aiClient'
import { applyIndex } from '@/shared/db'
import { MSG, broadcast } from '@/shared/messages'

export interface IndexInput {
  id: string
  url: string
  title: string
  content: string
  /** 索引完成后若提供 optimized_title，是否允许覆盖标题 */
  allowTitleReplace: boolean
}

/** 单条索引（带正文内容时使用，如收藏当前页） */
export async function runIndexing(input: IndexInput): Promise<void> {
  const { id, url, title, content, allowTitleReplace } = input
  try {
    const result = await indexBookmark({ url, title, content })

    const patch: Record<string, unknown> = {
      summary: result.summary,
      tags: result.tags,
      contentType: result.contentType,
      indexStatus: 'done',
    }
    if (allowTitleReplace && result.optimizedTitle) {
      patch.title = result.optimizedTitle
    }

    const where = await applyIndex(id, patch)
    notifyChange(where, id)
  } catch (e) {
    console.warn('[MindTab] index failed:', (e as Error).message)
    const where = await applyIndex(id, { indexStatus: 'pending' })
    notifyChange(where, id)
  }
}

/** runBatchIndexing 的结构化返回，供 drain 据此累加进度 + 决策退避。 */
export interface BatchIndexOutcome {
  /** 成功写入 done 的条数 */
  succeeded: number
  /** 写回 pending 等下次重试的条目 id（含整批失败时的全部、单条结果缺失） */
  failedItems: string[]
  /**
   * 整批 API 调用失败时的错误（网络/超时/5xx/429 等瞬时错误）。
   * 非 null 表示这是「整批挂了」而非「个别条目缺失」，drain 应据此做指数退避。
   * null 表示 API 调用本身成功（即便部分条目结果缺失）。
   */
  batchError: Error | null
}

/** 判断是否为「瞬时网络类」错误：超时(AbortError) / 5xx / 429。这类值得退避重试。 */
export function isTransientError(e: unknown): boolean {
  if (e instanceof AiNotConfiguredError) return false // 未配置 key → 重试无意义
  if (e instanceof Error) {
    if (e.name === 'AbortError') return true // fetch 超时被 abort
    // postJson 把 HTTP 错误格式化成 `${path} ${status}: ...`，从消息里抠状态码
    const m = /\s(\d{3}):/.exec(e.message)
    if (m) {
      const status = Number(m[1])
      return status === 429 || (status >= 500 && status <= 599)
    }
    // 无状态码的 fetch 失败（断网、DNS、连接重置）通常是 TypeError → 也按瞬时处理
    if (e instanceof TypeError) return true
  }
  return false
}

/**
 * 批量索引（最多 5 条合一次 API 调用，适用于 retry / drain）。
 * 返回 BatchIndexOutcome：drain 据 succeeded 累加进度、据 batchError 决定是否退避。
 */
export async function runBatchIndexing(
  inputs: IndexInput[],
): Promise<BatchIndexOutcome> {
  if (inputs.length === 0) {
    return { succeeded: 0, failedItems: [], batchError: null }
  }

  // 收集所有变更的 where 类型，最后只广播一次，避免连续 hydrate 导致闪动
  let hasPendingChange = false
  let hasBookmarkChange = false
  let succeeded = 0
  const failedItems: string[] = []
  let batchError: Error | null = null

  try {
    const results = await indexBookmarkBatch(
      inputs.map(({ url, title, content }) => ({ url, title, content })),
    )
    // 按 index 映射结果
    const resultMap = new Map<number, (typeof results)[number]>()
    for (const r of results) resultMap.set(r.index, r)

    for (let i = 0; i < inputs.length; i++) {
      const input = inputs[i]
      const result = resultMap.get(i)
      try {
        if (result) {
          const patch: Record<string, unknown> = {
            summary: result.summary,
            tags: result.tags,
            contentType: result.contentType,
            indexStatus: 'done',
          }
          if (input.allowTitleReplace && result.optimizedTitle) {
            patch.title = result.optimizedTitle
          }
          const where = await applyIndex(input.id, patch)
          succeeded++
          if (where === 'pending') hasPendingChange = true
          else if (where === 'bookmark') hasBookmarkChange = true
        } else {
          // 该条在批量结果中缺失 → 标记 pending 等下次重试（非整批失败，batchError 保持 null）
          const where = await applyIndex(input.id, { indexStatus: 'pending' })
          failedItems.push(input.id)
          if (where === 'pending') hasPendingChange = true
          else if (where === 'bookmark') hasBookmarkChange = true
        }
      } catch (e) {
        console.warn('[MindTab] batch apply failed:', input.id, (e as Error).message)
        failedItems.push(input.id)
      }
    }
  } catch (e) {
    // 整批 API 失败 → 全部回退 pending，记录 batchError 供 drain 退避
    batchError = e instanceof Error ? e : new Error(String(e))
    console.warn('[MindTab] batch index failed:', batchError.message)
    for (const input of inputs) {
      try {
        const where = await applyIndex(input.id, { indexStatus: 'pending' })
        failedItems.push(input.id)
        if (where === 'pending') hasPendingChange = true
        else if (where === 'bookmark') hasBookmarkChange = true
      } catch { /* noop */ }
    }
  }

  // 批量结束后统一广播一次
  if (hasPendingChange) {
    broadcast({ type: MSG.pendingUpdated, payload: { id: '', patch: {} } })
  }
  if (hasBookmarkChange) {
    broadcast({ type: MSG.bookmarkChanged, payload: { id: '' } })
  }

  return { succeeded, failedItems, batchError }
}

function notifyChange(where: 'pending' | 'bookmark' | null, id: string): void {
  if (where === 'pending') {
    broadcast({ type: MSG.pendingUpdated, payload: { id, patch: {} } })
  } else if (where === 'bookmark') {
    broadcast({ type: MSG.bookmarkChanged, payload: { id } })
  }
}

// 向所有扩展上下文广播消息（其它 newtab 也能同步）。

import type { Message } from './constants'

export function broadcast(msg: Message): void {
  // 发到所有扩展上下文（其它 newtab 也能同步）
  chrome.runtime.sendMessage(msg).catch(() => {
    // 没有任何监听者时会 reject，正常忽略。
  })
}

// Chrome / Edge 导出的 Netscape Bookmark File Format 解析。
// 关键兼容：<DL> 既可能是 <DT> 的子节点（DT 未闭合），也可能是 <DT> 的下一个兄弟节点
// （DT 被 HTML 解析器隐式闭合）。两种结构都得识别，否则文件夹层级会丢失。

export interface ParsedBookmark {
  title: string
  url: string
  /** 创建时间戳（秒）→ 毫秒；缺失则当前时间 */
  addedAt: number
  /** ['Bookmarks Bar', '设计'] 这种祖先文件夹链 */
  folderPath: string[]
}

export function parseBookmarkHtml(html: string): ParsedBookmark[] {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  const out: ParsedBookmark[] = []
  // isInsideTopWrapper=true 表示当前所在 DL 是 Chrome 的根包装（书签栏 / 其他书签）
  // 此层的 H3（即包装名）不进路径，让用户实际的分类直接升为顶层。
  walk(doc.body, [], true, out)
  return out
}

function walk(
  node: ParentNode,
  path: string[],
  isInsideTopWrapper: boolean,
  out: ParsedBookmark[],
): void {
  const children = Array.from(node.children)
  const consumed = new Set<number>()
  for (let i = 0; i < children.length; i++) {
    if (consumed.has(i)) continue
    const child = children[i]
    const tag = child.tagName.toUpperCase()

    if (tag === 'DT') {
      const h3 = child.querySelector(':scope > H3')
      const a = child.querySelector(':scope > A')

      if (h3) {
        const folderName = (h3.textContent ?? '').trim()
        // 在顶层包装上下文里，H3 是 Chrome 的"书签栏/其他书签"——跳过不入路径
        const childPath = isInsideTopWrapper ? path : [...path, folderName]
        // 优先找 DT 内的 DL（DT 未被自动闭合的情况）
        let subDl: Element | null = child.querySelector(':scope > DL')
        // 否则取 DT 的下一个兄弟 DL
        if (!subDl) {
          for (let j = i + 1; j < children.length; j++) {
            const sib = children[j]
            const sibTag = sib.tagName.toUpperCase()
            if (sibTag === 'DL') {
              subDl = sib
              consumed.add(j)
              break
            }
            if (sibTag === 'DT') break
          }
        }
        if (subDl) walk(subDl, childPath, false, out)
      } else if (a) {
        const url = a.getAttribute('HREF') ?? a.getAttribute('href') ?? ''
        if (!url || !/^https?:\/\//i.test(url)) continue
        const title = (a.textContent ?? '').trim()
        const addedRaw =
          a.getAttribute('ADD_DATE') ?? a.getAttribute('add_date') ?? '0'
        const addedAt = Number(addedRaw) * 1000 || Date.now()
        out.push({ title, url, addedAt, folderPath: path })
      }
    } else if (tag === 'DL' || tag === 'P') {
      // 独立 DL/P：继承当前层级状态
      walk(child, path, isInsideTopWrapper, out)
    }
  }
}

/**
 * UI 冒烟测试：首次引导（隐私 → AI 绑定引导）+ SettingsModal AI 服务配置 + 搜索
 *
 * 用 Puppeteer 加载 dist/ 扩展：走新用户引导（跳过 AI 绑定 → 空状态横幅），
 * 打开设置模态、展开服务商下拉菜单、切换厂商，搜索冒烟，
 * 最后重置引导标记走一遍「引导内保存配置」路径，截屏验证交互正常。
 *
 * 用法：node scripts/ui-smoke.mjs
 * 前置：npm run build（dist/ 需存在且最新）
 */

import puppeteer from 'puppeteer'
import { mkdirSync, cpSync, rmSync, readFileSync, writeFileSync } from 'fs'
import path, { dirname } from 'path'
import { tmpdir } from 'os'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const distSrc = path.resolve(__dirname, '..', 'dist')
const screenshotDir = path.resolve(__dirname, '..', 'screenshots', 'smoke')

// 测试构建：复制 dist 并把宽域名权限提为必选（跳过 chrome.permissions.request 弹窗，
// 自动化环境无法点原生授权窗口；生产 manifest 不受影响）
const dist = path.join(tmpdir(), 'mindtab-smoke-dist')
rmSync(dist, { recursive: true, force: true })
cpSync(distSrc, dist, { recursive: true })
const manifest = JSON.parse(readFileSync(path.join(dist, 'manifest.json'), 'utf8'))
manifest.host_permissions = [...(manifest.host_permissions ?? []), 'https://*/*']
writeFileSync(path.join(dist, 'manifest.json'), JSON.stringify(manifest, null, 2))

mkdirSync(screenshotDir, { recursive: true })

const PASS = (msg) => console.log(`  ✅ ${msg}`)
const FAIL = (msg) => { console.log(`  ❌ ${msg}`); process.exitCode = 1 }

async function main() {
  console.log('🚀 启动 Chrome for Testing...')
  const browser = await puppeteer.launch({
    headless: false,
    args: [
      `--disable-extensions-except=${dist}`,
      `--load-extension=${dist}`,
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-features=ChromeWhatsNewUI',
      '--disable-sync',
    ],
  })

  // 等待扩展的 service worker 注册
  console.log('⏳ 等待扩展加载...')
  let extId = null
  for (let i = 0; i < 30; i++) {
    const targets = browser.targets()
    for (const t of targets) {
      if (t.type() === 'service_worker' && t.url().startsWith('chrome-extension://')) {
        extId = new URL(t.url()).hostname
        break
      }
    }
    if (extId) break
    await new Promise((r) => setTimeout(r, 1000))
  }
  if (!extId) { FAIL('扩展未加载'); await browser.close(); return }
  PASS(`扩展已加载，ID: ${extId}`)

  // 打开新标签页（扩展接管）
  const page = await browser.newPage()
  await page.setViewport({ width: 1280, height: 800 })
  await page.goto(`chrome-extension://${extId}/src/newtab/index.html`, {
    waitUntil: 'load',
    timeout: 20_000,
  })
  // 等 React 挂载完成（设置按钮出现）
  await page.waitForSelector('button[aria-label="设置"]', { timeout: 15_000 })
  PASS('新标签页已打开')

  // 先截一张完整页面图调试
  await page.screenshot({ path: path.join(screenshotDir, '00-page-loaded.png') })

  // 打印页面关键文本，确认当前状态
  const preText = await page.evaluate(() => document.body.textContent?.slice(0, 300))
  console.log('  📝 页面文本:', JSON.stringify(preText))

  // 检查是否有隐私弹窗遮罩需要关闭
  const hasPrivacy = await page.evaluate(() => !!document.querySelector('[role="dialog"]'))
  if (hasPrivacy) {
    console.log('  ⚠️ 检测到弹窗，尝试点击同意/开始按钮...')
    await page.evaluate(() => {
      const btns = [...document.querySelectorAll('button')]
      const target = btns.find((b) =>
        ['同意', '开始使用', '开始', '我知道了', '继续'].some((t) => b.textContent?.includes(t)),
      )
      target?.click()
    })
    await new Promise((r) => setTimeout(r, 800))
  }

  // ── 新用户 AI 绑定引导：同意隐私后应弹出，跳过后空状态也有未配置横幅 ──
  console.log('🧪 测试 AI 绑定引导（新用户）...')
  try {
    await page.waitForFunction(() => document.body.textContent.includes('绑定你的 AI 服务'), {
      timeout: 5_000,
    })
    PASS('同意隐私后弹出 AI 绑定引导')
  } catch {
    FAIL('同意隐私后未弹出 AI 绑定引导')
  }
  await page.screenshot({ path: path.join(screenshotDir, '00a-ai-guide.png') })
  const guideState = await page.evaluate(() => {
    const dialog = document.querySelector('[role="dialog"]')
    const text = dialog?.textContent ?? ''
    const link = [...(dialog?.querySelectorAll('a') ?? [])].find((a) =>
      a.textContent?.includes('获取 API Key'),
    )
    return {
      saveLabel: text.includes('保存并开始使用'),
      skip: text.includes('稍后再说'),
      noSettingsTitle: !text.includes('AI 服务配置'),
      keyLink: link ? { href: link.href, target: link.target } : null,
    }
  })
  if (guideState.saveLabel && guideState.skip && guideState.noSettingsTitle) {
    PASS('引导弹窗为 guide 形态（「保存并开始使用」+「稍后再说」，无设置摘要行）')
  } else {
    FAIL(`引导弹窗形态异常: ${JSON.stringify(guideState)}`)
  }
  if (guideState.keyLink?.href.startsWith('https://') && guideState.keyLink.target === '_blank') {
    PASS(`「获取 API Key」链接存在：${guideState.keyLink.href}`)
  } else {
    FAIL(`「获取 API Key」链接缺失或未新标签打开: ${JSON.stringify(guideState.keyLink)}`)
  }
  // 引导弹窗内的服务商下拉需可展开（Dialog 内浮层层级）
  const guideTrigger = await page.evaluateHandle(() => {
    for (const label of document.querySelectorAll('[role="dialog"] span')) {
      if (label.textContent === '服务商') {
        return label.closest('div[style*="justify-content"]')?.querySelector('button') ?? null
      }
    }
    return null
  })
  if (guideTrigger.asElement()) {
    await guideTrigger.asElement().click()
    await new Promise((r) => setTimeout(r, 500))
    const items = await page.$$('[role="menuitemradio"]')
    await page.screenshot({ path: path.join(screenshotDir, '00b-ai-guide-dropdown.png') })
    if (items.length >= 2) PASS(`引导内服务商下拉可展开：${items.length} 项`)
    else FAIL(`引导内服务商下拉未展开: ${items.length}`)
    await page.keyboard.press('Escape') // 只关下拉
    await new Promise((r) => setTimeout(r, 300))
  } else {
    FAIL('引导内未找到服务商下拉 trigger')
  }
  await page.evaluate(() => {
    const btn = [...document.querySelectorAll('button')].find((b) => b.textContent === '稍后再说')
    btn?.click()
  })
  await new Promise((r) => setTimeout(r, 800))
  const afterSkip = await page.evaluate(async () => ({
    guideOpen: document.body.textContent.includes('绑定你的 AI 服务'),
    banner: document.body.textContent.includes('AI 未配置'),
    flag: (await chrome.storage.local.get('mt:aiGuideShown'))['mt:aiGuideShown'],
  }))
  await page.screenshot({ path: path.join(screenshotDir, '00c-ai-guide-skipped.png') })
  if (!afterSkip.guideOpen && afterSkip.banner && afterSkip.flag === true) {
    PASS('「稍后再说」后引导关闭，空状态显示未配置横幅，mt:aiGuideShown 已写入')
  } else {
    FAIL(`跳过引导后状态异常: ${JSON.stringify(afterSkip)}`)
  }

  // 强行点击设置按钮（force: true 绕过层级遮挡）
  await page.click('button[aria-label="设置"]', { delay: 50 })

  // 等 1.5s 让模态动画完成
  await new Promise((r) => setTimeout(r, 1500))

  // 调试：打印页面关键文本内容
  const bodyText = await page.evaluate(() => document.body.textContent?.slice(0, 500))
  console.log('  📝 页面文本片段:', JSON.stringify(bodyText))

  // 调试用：截屏看看实际渲染了什么
  await page.screenshot({ path: path.join(screenshotDir, 'debug-after-click.png') })

  // 等待模态面板内的按钮出现（"测试连接"按钮只在 AI 设置区内）
  try {
    await page.waitForFunction(
      () =>
        document.body.textContent.includes('测试连接') ||
        document.body.textContent.includes('API Key'),
      { timeout: 10_000 },
    )
    PASS('设置模态已打开')
  } catch {
    await page.screenshot({ path: path.join(screenshotDir, 'debug-modal-fail.png') })
    FAIL('设置模态未出现（见 debug-modal-fail.png）')
    await browser.close()
    return
  }

  // 找到服务商下拉 trigger（第一个 rounded-full button 在模态内）
  const providerBtn = await page.$('button[aria-label="服务商"]')
  // 如果 aria-label 没有，尝试按文本找。实际上 DropdownMenuTrigger 是 Button，定位它
  // 更可靠的方式：找到包含 "服务商" label 的 row，然后找其内的第一个 button
  const triggerBtn = await page.evaluateHandle(() => {
    const labels = document.querySelectorAll('span')
    for (const label of labels) {
      if (label.textContent === '服务商') {
        const row = label.closest('div[style*="justify-content"]')
        if (!row) return null
        // Row 的右半部分包含下拉 trigger button
        const btn = row.querySelector('button')
        return btn
      }
    }
    return null
  })
  if (!triggerBtn) { FAIL('未找到服务商下拉 trigger') } else {
    PASS('服务商下拉 trigger 已找到')
  }

  // 截屏：初始状态
  await page.screenshot({ path: path.join(screenshotDir, '01-settings-initial.png') })
  PASS('截屏 #1：初始状态')

  // 点击服务商下拉 trigger
  const btnHandle = triggerBtn || providerBtn
  if (btnHandle) {
    await btnHandle.click()
    await new Promise((r) => setTimeout(r, 500))

    // 截屏：下拉展开
    await page.screenshot({ path: path.join(screenshotDir, '02-dropdown-open.png') })
    PASS('截屏 #2：下拉展开')

    // 验证下拉面板确实可见（找到一个 DropdownMenuRadioItem）
    const radioItems = await page.$$('[data-slot="dropdown-menu-radio-item"], [role="menuitemradio"]')
    if (radioItems.length >= 2) {
      PASS(`下拉选项可见：${radioItems.length} 项`)

      // 选择第 3 个选项（跳过 deepseek/openai，选 kimi）
      // 注意：自定义在最后，选一个中间的预设
      const targetItem = radioItems[2]
      const itemText = await targetItem.evaluate((el) => el.textContent)
      await targetItem.click()
      await new Promise((r) => setTimeout(r, 400))

      // 截屏：切换厂商后
      await page.screenshot({ path: path.join(screenshotDir, '03-provider-changed.png') })
      PASS(`截屏 #3：已切换到 "${itemText}"`)

      // 验证 trigger 文字已更新
      const newBtnText = await triggerBtn?.evaluate((el) => el.textContent)
      if (newBtnText && !newBtnText.includes('DeepSeek')) {
        PASS(`trigger 文字已更新: "${newBtnText}"`)
      } else {
        FAIL(`trigger 文字未更新: "${newBtnText}"`)
      }
    } else {
      FAIL(`下拉选项不足: ${radioItems.length}`)
    }
  }

  // 截屏：全页最终状态
  await page.screenshot({ path: path.join(screenshotDir, '04-final.png') })
  PASS('截屏 #4：最终状态')

  // ── 测试「获取模型列表」（用 OpenRouter：/models 无需有效 Key 也返回 200）──
  console.log('🧪 测试获取模型列表...')
  // 重新打开服务商下拉，选 OpenRouter
  const reopenTrigger = await page.evaluateHandle(() => {
    const labels = document.querySelectorAll('span')
    for (const label of labels) {
      if (label.textContent === '服务商') {
        const row = label.closest('div[style*="justify-content"]')
        return row?.querySelector('button') ?? null
      }
    }
    return null
  })
  await reopenTrigger.click()
  await new Promise((r) => setTimeout(r, 400))
  const orItem = await page.evaluateHandle(() => {
    const items = document.querySelectorAll('[role="menuitemradio"]')
    for (const it of items) {
      if (it.textContent?.includes('OpenRouter')) return it
    }
    return null
  })
  const orItemEl = orItem.asElement()
  if (!orItemEl) { FAIL('下拉中未找到 OpenRouter') } else {
    await orItemEl.click()
    await new Promise((r) => setTimeout(r, 400))
    PASS('已切换到 OpenRouter')

    // 填一个假 Key（OpenRouter /models 不校验）
    await page.evaluate(() => {
      const inputs = [...document.querySelectorAll('input')]
      const keyInput = inputs.find((i) => i.placeholder?.includes('sk-'))
      if (keyInput) {
        const setter = Object.getOwnPropertyDescriptor(
          window.HTMLInputElement.prototype, 'value',
        ).set
        setter.call(keyInput, 'sk-dummy-for-test')
        keyInput.dispatchEvent(new Event('input', { bubbles: true }))
      }
    })
    await new Promise((r) => setTimeout(r, 300))

    // 点「获取模型列表」按钮
    const fetchBtn = await page.evaluateHandle(() => {
      const btns = [...document.querySelectorAll('button')]
      return btns.find((b) => b.textContent?.includes('获取模型列表')) ?? null
    })
    const fetchBtnEl = fetchBtn.asElement()
    if (!fetchBtnEl) { FAIL('未找到「获取模型列表」按钮') } else {
      // 捕获控制台日志和错误
      const consoleMsgs = []
      page.on('console', (msg) => consoleMsgs.push(`[${msg.type()}] ${msg.text()}`))
      page.on('pageerror', (err) => consoleMsgs.push(`[PAGE_ERROR] ${err.message}`))

      await fetchBtnEl.click()
      // 立即截屏捕获可能一闪而过的 toast
      await new Promise((r) => setTimeout(r, 500))
      await page.screenshot({ path: path.join(screenshotDir, '05-fetch-toast.png') })
      // 再等 4s 让模型列表加载完成
      await new Promise((r) => setTimeout(r, 4000))
      await page.screenshot({ path: path.join(screenshotDir, '06-fetch-result.png') })

      // 检查结果：成功 → 页面出现"已获取 N 个可用模型"；失败 → 查看页面文本中的错误
      const fetchResult = await page.evaluate(() => {
        const body = document.body.textContent ?? ''
        const okMatch = body.match(/已获取 (\d+) 个可用模型/)
        if (okMatch) return { ok: true, count: okMatch[1] }
        // 出错时 toast 文案会出现在 body 文本中（sonner 用 portal 渲染到 body 的子级）
        const errMatch = body.match(/获取模型列表失败[:：](.+)/)
        if (errMatch) return { ok: false, error: errMatch[1] }
        // 检查整个文档文本中其他可能的错误标志
        const fullText = document.documentElement.textContent ?? ''
        const errGeneric = fullText.match(/失败|error|Error/)
        return { ok: false, error: errGeneric ? errGeneric[0] : '未知错误（页面文本无错误标志）', fullText: fullText.slice(0, 300) }
      })
      if (fetchResult.ok) {
        PASS(`获取模型列表成功：${fetchResult.count} 个模型`)

        // 断言：下拉确实显示了模型列表（聚焦 input → 展示）
        const modelInput = await page.$('input[placeholder*="从已获取的列表中选择"]')
        if (modelInput) {
          await modelInput.focus()
          await new Promise((r) => setTimeout(r, 500))
          // 查找下拉面板中的按钮项
          const suggestionBtns = await page.$$(
            '[style*="position: absolute"][style*="z-index: 50"] button, ' +
            'div[style*="max-height: 200"] button',
          )
          if (suggestionBtns.length >= 2) {
            PASS(`模型建议下拉可见：${suggestionBtns.length} 项`)
          } else {
            FAIL(`模型建议下拉项不足: ${suggestionBtns.length}`)
          }
          await modelInput.evaluate((el) => el.blur())
          await new Promise((r) => setTimeout(r, 300))
        } else {
          FAIL('未找到模型输入框')
        }

        // 切换到另一厂商 → 断言"已获取 N 个"hint 消失
        const origBtn = await page.evaluateHandle(() => {
          const labels = document.querySelectorAll('span')
          for (const l of labels) {
            if (l.textContent === '服务商') {
              return l.closest('div[style*="justify-content"]')?.querySelector('button') ?? null
            }
          }
          return null
        })
        await origBtn.click()
        await new Promise((r) => setTimeout(r, 400))
        const deepseek = await page.evaluateHandle(() => {
          for (const it of document.querySelectorAll('[role="menuitemradio"]')) {
            if (it.textContent?.includes('DeepSeek')) return it
          }
          return null
        })
        if (deepseek) {
          await deepseek.click()
          await new Promise((r) => setTimeout(r, 400))
          const hasFetchHint = await page.evaluate(() =>
            document.body.textContent?.includes('已获取'),
          )
          if (hasFetchHint) {
            FAIL('切换厂商后「已获取 N 个可用模型」hint 未清空')
          } else {
            PASS('切换厂商后拉取状态已清空')
          }
        }
      } else {
        FAIL(`获取模型列表失败: ${fetchResult.error}`)
        console.log('  📝 页面文本:', JSON.stringify(fetchResult.fullText))
        if (consoleMsgs.length > 0) {
          console.log('  📝 控制台消息（前 5 条）:', consoleMsgs.slice(0, 5).join(' | '))
        }
      }
      PASS('截屏 #5+6：获取模型列表结果')
    }
  }

  // ── 搜索冒烟：预置书签 → 输入即出本地结果 → 回车（无 key → 降级链路）──
  console.log('🧪 测试搜索（本地即时结果 + 降级链路）...')

  // 关闭设置模态
  await page.keyboard.press('Escape')
  await new Promise((r) => setTimeout(r, 600))

  // 直接向扩展 IndexedDB 预置书签（结构对齐 shared/db/types.ts Bookmark）
  const now = Date.now()
  const seedBookmarks = [
    {
      id: 'smoke-bm-1', url: 'https://zhihu.com/react19', title: 'React 19 新特性详解',
      favicon: '', domain: 'zhihu.com', summary: '介绍 React 19 的并发特性与新 Hooks 用法',
      tags: ['React', '前端'], contentType: '文章', folderId: null, pinnedIn: [],
      createdAt: now - 45 * 86400000, lastOpenedAt: now - 3 * 86400000, indexStatus: 'done', order: 1,
    },
    {
      id: 'smoke-bm-2', url: 'https://bilibili.com/css-anim', title: 'CSS 动画完全指南',
      favicon: '', domain: 'bilibili.com', summary: '讲解 CSS 动画与过渡的系统视频教程',
      tags: ['CSS', '动画', '教程'], contentType: '视频', folderId: null, pinnedIn: [],
      createdAt: now - 10 * 86400000, lastOpenedAt: 0, indexStatus: 'done', order: 2,
    },
    {
      id: 'smoke-bm-3', url: 'https://sspai.com/prompt', title: '提示词工程实用技巧',
      favicon: '', domain: 'sspai.com', summary: '总结 18 个提示词工程实用技巧提升 AI 对话质量',
      tags: ['提示词', 'AI'], contentType: '文章', folderId: null, pinnedIn: [],
      createdAt: now - 2 * 86400000, lastOpenedAt: now - 86400000, indexStatus: 'done', order: 3,
    },
  ]
  await page.evaluate(async (bookmarks) => {
    const db = await new Promise((res, rej) => {
      const req = indexedDB.open('mindtab', 3)
      req.onsuccess = () => res(req.result)
      req.onerror = () => rej(req.error)
    })
    await new Promise((res, rej) => {
      const t = db.transaction('bookmarks', 'readwrite')
      const s = t.objectStore('bookmarks')
      bookmarks.forEach((b) => s.put(b))
      t.oncomplete = res
      t.onerror = () => rej(t.error)
    })
    db.close()
  }, seedBookmarks)
  PASS(`已预置 ${seedBookmarks.length} 条书签`)

  // 刷新让 store 重新 hydrate（空态页面不渲染搜索 pill）
  await page.reload({ waitUntil: 'load' })
  await page.waitForSelector('button[aria-label="设置"]', { timeout: 15_000 })
  await new Promise((r) => setTimeout(r, 1000))

  // 点击搜索 pill 打开面板
  await page.evaluate(() => {
    const spans = [...document.querySelectorAll('span')]
    const pillText = spans.find((s) => s.textContent === '用自然语言找回收藏…')
    pillText?.click()
  })
  await new Promise((r) => setTimeout(r, 700))
  const searchInput = await page.$('input.search-input')
  if (!searchInput) {
    await page.screenshot({ path: path.join(screenshotDir, 'debug-search-fail.png') })
    FAIL('搜索面板未打开（见 debug-search-fail.png）')
  } else {
    PASS('搜索面板已打开')

    // 输入中文查询 → 防抖 250ms 后本地即时结果
    await searchInput.type('动画视频', { delay: 40 })
    await new Promise((r) => setTimeout(r, 800))
    await page.screenshot({ path: path.join(screenshotDir, '07-search-preview.png') })
    const preview = await page.evaluate(() => {
      const body = document.body.textContent ?? ''
      return {
        hasHit: body.includes('CSS 动画完全指南'),
        hasLabel: body.includes('即时匹配'),
      }
    })
    if (preview.hasHit && preview.hasLabel) {
      PASS('输入即出本地结果（命中「CSS 动画完全指南」，标注「即时匹配」）')
    } else {
      FAIL(`本地即时结果异常: 命中=${preview.hasHit} 标注=${preview.hasLabel}`)
    }

    // 方向键选中第一条
    await page.keyboard.press('ArrowDown')
    await new Promise((r) => setTimeout(r, 300))
    await page.screenshot({ path: path.join(screenshotDir, '08-search-arrow-select.png') })
    PASS('截屏 #8：方向键选中态')

    // 取消选中（回到 -1 需要循环，直接清空重输避免 Enter 打开书签）
    await page.keyboard.press('ArrowUp')
    await new Promise((r) => setTimeout(r, 200))
    // 回车提交：未配置 AI → local-only + 降级横幅
    // （ArrowUp 后仍有选中项，故用点击历史链路外的直接 submit：先清选中）
    await searchInput.type(' ', { delay: 20 }) // 触发 results 变化重置 selectedIdx
    await new Promise((r) => setTimeout(r, 500))
    await page.keyboard.press('Enter')
    await new Promise((r) => setTimeout(r, 900))
    await page.screenshot({ path: path.join(screenshotDir, '09-search-submitted.png') })
    const submitted = await page.evaluate(() => {
      const body = document.body.textContent ?? ''
      return {
        degraded: body.includes('未配置 AI 服务'),
        label: body.includes('关键词搜索'),
        stillHasResults: body.includes('CSS 动画完全指南'),
      }
    })
    if (submitted.degraded && submitted.label && submitted.stillHasResults) {
      PASS('回车后无 key 降级链路正常（横幅 + 关键词搜索标注 + 结果保留）')
    } else {
      FAIL(`降级链路异常: 横幅=${submitted.degraded} 标注=${submitted.label} 结果=${submitted.stillHasResults}`)
    }
  }

  // ── 引导内保存路径：重置引导标记 → 刷新（已同意隐私、无版本弹窗 → 首屏直接弹）→ 填 Key 保存 ──
  console.log('🧪 测试 AI 绑定引导内保存配置...')
  await page.evaluate(() => chrome.storage.local.remove('mt:aiGuideShown'))
  await page.reload({ waitUntil: 'load' })
  await page.waitForSelector('button[aria-label="设置"]', { timeout: 15_000 })
  try {
    await page.waitForFunction(() => document.body.textContent.includes('绑定你的 AI 服务'), {
      timeout: 5_000,
    })
    PASS('重置标记后首屏弹出 AI 绑定引导')
    await page.evaluate(() => {
      const keyInput = [...document.querySelectorAll('[role="dialog"] input')].find((i) =>
        i.placeholder?.includes('sk-'),
      )
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
      setter.call(keyInput, 'sk-dummy-for-test')
      keyInput.dispatchEvent(new Event('input', { bubbles: true }))
    })
    await new Promise((r) => setTimeout(r, 300))
    await page.evaluate(() => {
      const btn = [...document.querySelectorAll('button')].find((b) =>
        b.textContent?.includes('保存并开始使用'),
      )
      btn?.click()
    })
    await new Promise((r) => setTimeout(r, 1200))
    await page.screenshot({ path: path.join(screenshotDir, '10-ai-guide-saved.png') })
    const afterSave = await page.evaluate(async () => ({
      guideOpen: document.body.textContent.includes('绑定你的 AI 服务'),
      banner: document.body.textContent.includes('AI 未配置'),
      config: (await chrome.storage.local.get('mt:aiConfig'))['mt:aiConfig'],
    }))
    if (!afterSave.guideOpen && !afterSave.banner && afterSave.config?.apiKey === 'sk-dummy-for-test') {
      PASS('引导内保存后弹窗关闭、横幅消失、mt:aiConfig 已写入')
    } else {
      FAIL(`引导内保存后状态异常: ${JSON.stringify({ ...afterSave, config: !!afterSave.config })}`)
    }
  } catch {
    await page.screenshot({ path: path.join(screenshotDir, 'debug-guide-save-fail.png') })
    FAIL('重置标记后未弹出 AI 绑定引导（见 debug-guide-save-fail.png）')
  }

  await browser.close()
  console.log('\n🎉 冒烟测试完成，截图已保存到 screenshots/smoke/')
}

main().catch((e) => {
  console.error('💥 冒烟测试崩溃:', e)
  process.exitCode = 1
})

/**
 * Scroll focused field into view after IME opens (Huawei / EMUI / old WebViews).
 * Use `nearest` + non-smooth first scroll — smooth + `center` scrolls aggressively and can
 * leave the whole viewport black on buggy engines when paired with resize + overflow hidden.
 */
export function scrollFieldIntoView(el) {
  if (!el || !(el instanceof HTMLElement)) return
  const run = () => {
    try {
      el.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'auto' })
    } catch {
      try {
        el.scrollIntoView(true)
      } catch (_) {}
    }
    const vv = window.visualViewport
    if (!vv || typeof vv.height !== 'number') return
    try {
      const rect = el.getBoundingClientRect()
      const visibleBottom = vv.offsetTop + vv.height
      const pad = 72
      if (rect.bottom > visibleBottom - pad) {
        const delta = rect.bottom - visibleBottom + pad
        /** Cap avoids huge jumps that push content entirely off-screen on some Chromium WebViews */
        const cap = vv.height > 160 ? vv.height * 0.85 : vv.height - 88
        const capped = Math.min(Math.max(0, delta), Math.max(0, cap))
        window.scrollBy({ top: capped, behavior: 'auto' })
      }
    } catch (_) {}
  }
  requestAnimationFrame(() => {
    requestAnimationFrame(run)
    setTimeout(run, 120)
    setTimeout(run, 400)
  })
}

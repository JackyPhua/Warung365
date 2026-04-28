/** Backup / export helpers — Android WebView often handles Share better than <a download>. */

export function isAndroidNative() {
  try {
    return window.Capacitor?.getPlatform?.() === 'android' && window.Capacitor?.isNativePlatform?.()
  } catch {
    return false
  }
}

export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text)
    return { ok: true }
  } catch {
    return { ok: false, error: 'clipboard' }
  }
}

/**
 * Share JSON as a file when supported; else share as text; else trigger download.
 */
export async function shareOrDownloadJson(jsonString, filename) {
  const file = new File([jsonString], filename, { type: 'application/json' })
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: filename })
      return 'share_file'
    } catch (e) {
      if (e?.name === 'AbortError') return 'aborted'
    }
  }
  if (navigator.share && jsonString.length < 900_000) {
    try {
      await navigator.share({ title: filename, text: jsonString })
      return 'share_text'
    } catch (e) {
      if (e?.name === 'AbortError') return 'aborted'
    }
  }
  const blob = new Blob([jsonString], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
  return 'download'
}

/** Backup / export helpers — Android WebView `<a download>` blobs often DO NOT appear in Downloads. */

import { ExportDownloads } from '../plugins/exportDownloads'

export function isAndroidNative() {
  try {
    return window.Capacitor?.getPlatform?.() === 'android' && window.Capacitor?.isNativePlatform?.()
  } catch {
    return false
  }
}

/** Strip path fragments; keeps a single basename safe for filesystem paths. */
export function safeExportFilename(name) {
  const base = String(name || 'export.bin').replace(/\\/g, '/').split('/').pop() || 'export.bin'
  return base.replace(/\.\./g, '_')
}

function arrayBufferToBase64(buffer) {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer)
  let binary = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk))
  }
  return btoa(binary)
}

/** UTF-8 text → base64 (for JSON Documents save). */
function utf8TextToBase64(text) {
  const u8 = new TextEncoder().encode(text)
  return arrayBufferToBase64(u8)
}

/** Public Downloads via native MediaStore (API 29+) / legacy Downloads dir. */
async function trySaveBlobAndroidDownloads(blob, filename, mimeType) {
  if (!isAndroidNative()) return false
  try {
    const data = arrayBufferToBase64(await blob.arrayBuffer())
    const r = await ExportDownloads.saveToDownloads({
      base64: data,
      fileName: safeExportFilename(filename),
      mimeType: mimeType || 'application/octet-stream',
    })
    return !!(r && r.ok)
  } catch (e) {
    console.warn('[export] native Downloads save failed', e)
    return false
  }
}

/** Fallback: public Documents folder (same native plugin — no Capacitor Filesystem / JDK 21 toolchain). */
async function trySaveBlobAndroidDocuments(blobOrString, filename, asUtf8Json, mimeType) {
  if (!isAndroidNative()) return false
  try {
    let base64
    let mt = mimeType || 'application/octet-stream'
    if (asUtf8Json) {
      const text = typeof blobOrString === 'string' ? blobOrString : await blobOrString.text()
      base64 = utf8TextToBase64(text)
      mt = 'application/json'
    } else {
      const blob = blobOrString instanceof Blob ? blobOrString : new Blob([blobOrString])
      base64 = arrayBufferToBase64(await blob.arrayBuffer())
    }
    const r = await ExportDownloads.saveToDocuments({
      base64,
      fileName: safeExportFilename(filename),
      mimeType: mt,
    })
    return !!(r && r.ok)
  } catch (e) {
    console.warn('[export] native Documents save failed', e)
    return false
  }
}

/**
 * @returns {'saved_downloads'|'saved_documents'|null}
 */
async function androidSaveAfterShareFails(blobOrJson, filename, mimeType) {
  if (!isAndroidNative()) return null
  const baseBlob = typeof blobOrJson === 'string'
    ? new Blob([blobOrJson], { type: mimeType })
    : blobOrJson

  if (await trySaveBlobAndroidDownloads(baseBlob, filename, mimeType)) {
    return 'saved_downloads'
  }

  if (typeof blobOrJson === 'string') {
    if (await trySaveBlobAndroidDocuments(blobOrJson, filename, true, mimeType)) return 'saved_documents'
  } else {
    if (await trySaveBlobAndroidDocuments(blobOrJson, filename, false, mimeType)) return 'saved_documents'
  }
  return null
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
 * Share JSON as a file when supported; else save to Downloads / Documents on Android; else download.
 * @returns {'share_file'|'share_text'|'saved_downloads'|'saved_documents'|'download'|'aborted'}
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
  const mode = await androidSaveAfterShareFails(jsonString, filename, 'application/json')
  if (mode === 'saved_downloads' || mode === 'saved_documents') return mode
  downloadBlob(blob, filename)
  return 'download'
}

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.rel = 'noopener'
  a.style.display = 'none'
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1500)
}

/**
 * @returns {'share_file'|'saved_downloads'|'saved_documents'|'download'|'aborted'}
 */
export async function shareOrDownloadBlob(blob, filename, mimeType = 'application/octet-stream') {
  const file = new File([blob], filename, { type: mimeType })
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: filename })
      return 'share_file'
    } catch (e) {
      if (e?.name === 'AbortError') return 'aborted'
    }
  }
  const mode = await androidSaveAfterShareFails(blob, filename, mimeType)
  if (mode === 'saved_downloads' || mode === 'saved_documents') return mode
  downloadBlob(blob, filename)
  return 'download'
}

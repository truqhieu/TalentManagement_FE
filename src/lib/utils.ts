import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import type { z } from 'zod'

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}

/** UUID for client-only keys (form rows, etc.). Works on http://LAN IP where randomUUID is unavailable. */
export function randomId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

export function safeParse<T>(
  schema: z.ZodType<T, z.ZodTypeDef, unknown>,
  data: unknown,
  context: string
): T {
  const result = schema.safeParse(data)
  if (!result.success) {
    console.error(`[API Contract Violation] ${context}`, result.error.flatten())
    if (import.meta.env.PROD) {
      // Sentry.captureException(result.error, { extra: { context } })
    }
    throw new Error(`Invalid API response shape: ${context}`)
  }
  return result.data
}

const OFFICE_FILE_EXT_RE = /\.(docx?|xlsx?|pptx?)$/i

/** Relative `/uploads/...` paths → full API URL for browser / Office Online viewer. */
export function resolveFileUrl(url: string | null | undefined): string {
  if (!url) return ''
  const cleanUrl = url.trim()
  if (!cleanUrl.startsWith('/uploads/')) return cleanUrl
  const apiBase = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') ?? ''
  return apiBase ? `${apiBase}${cleanUrl}` : cleanUrl
}

export function isOfficeDocumentUrl(url: string, fileName?: string): boolean {
  const probe = (fileName?.trim() || url).toLowerCase()
  return OFFICE_FILE_EXT_RE.test(probe)
}

export function getFileViewerUrl(url: string | null | undefined): string {
  const cleanUrl = resolveFileUrl(url)
  if (!cleanUrl) return ''
  if (isOfficeDocumentUrl(cleanUrl)) {
    return `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(cleanUrl)}`
  }
  return cleanUrl
}

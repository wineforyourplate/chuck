import { FileText, Link2, MessageSquareText, Github, Youtube, Lightbulb } from 'lucide-react'
import { plainText } from './markdown'

export type Rec = Record<string, unknown>
export const str = (r: Rec | null | undefined, k: string) => (r && r[k] != null ? String(r[k]) : '')

// ── notes model ─────────────────────────────────────────────────────────────
export const KINDS = ['thought', 'article', 'tweet', 'repo', 'video', 'other'] as const
export type Kind = (typeof KINDS)[number]
export const STATUSES = ['raw', 'curating', 'filed', 'failed'] as const
export type Status = (typeof STATUSES)[number]

// The Developer Agent keeps output format and writing style separate. A script can
// use the user's writing, while an essay can be clear/direct or mechanism-first.
export const DEVELOPER_STYLES = [
  { slug: 'none', label: 'No style', blurb: 'Follow the thought and your instruction naturally.' },
  { slug: 'clear_direct', label: 'Clear, direct', blurb: 'Plain language, concrete examples, no padding.' },
  { slug: 'first_principles', label: 'First principles', blurb: 'Patient, structural, and mechanism-first.' },
  { slug: 'my_writing', label: 'My writing', blurb: 'Learns only from the references you select.' },
] as const

export const OUTPUT_TYPES = [
  { slug: 'essay', label: 'Essay', blurb: 'Develop one argument in coherent prose.' },
  { slug: 'plan', label: 'Plan', blurb: 'Turn the idea into decisions and useful next steps.' },
  { slug: 'script', label: 'Script', blurb: 'Shape it for spoken delivery, scenes, or beats.' },
  { slug: 'explainer', label: 'Explainer', blurb: 'Teach the mechanism with concrete examples.' },
  { slug: 'custom', label: 'Custom', blurb: 'Let your instruction define the document.' },
] as const

// Templates are common output intentions, not another required form step. They map
// onto the stable output_type enum while preserving the more specific intent on the
// draft and in the Developer Agent input.
export const DEVELOPMENT_TEMPLATES = [
  {
    slug: 'email',
    label: 'Email copy',
    blurb: 'A focused email with a clear purpose and next action.',
    outputType: 'custom',
    fallbackInstruction: 'Turn the source thought into concise email copy.',
  },
  {
    slug: 'task_list',
    label: 'To-do list',
    blurb: 'Concrete actions in a useful sequence.',
    outputType: 'plan',
    fallbackInstruction: 'Turn the source thought into a practical to-do list.',
  },
  {
    slug: 'social_post',
    label: 'Social post',
    blurb: 'A publishable short-form post built around one idea.',
    outputType: 'custom',
    fallbackInstruction: 'Turn the source thought into a concise social post.',
  },
  {
    slug: 'essay',
    label: 'Essay',
    blurb: 'A coherent argument with room to develop.',
    outputType: 'essay',
    fallbackInstruction: 'Develop the source thought into a coherent essay.',
  },
  {
    slug: 'plan',
    label: 'Plan',
    blurb: 'Decisions, steps, and unresolved choices.',
    outputType: 'plan',
    fallbackInstruction: 'Turn the source thought into an actionable plan.',
  },
  {
    slug: 'summary',
    label: 'Summary',
    blurb: 'The essential meaning without the extra weight.',
    outputType: 'custom',
    fallbackInstruction: 'Create a concise, faithful summary of the source thought.',
  },
  {
    slug: 'explainer',
    label: 'Explainer',
    blurb: 'Teach the idea through its underlying mechanism.',
    outputType: 'explainer',
    fallbackInstruction: 'Develop the source thought into a clear explainer.',
  },
  {
    slug: 'script',
    label: 'Script',
    blurb: 'Spoken delivery with useful beats and pacing.',
    outputType: 'script',
    fallbackInstruction: 'Turn the source thought into a script for spoken delivery.',
  },
] as const

export type DeveloperStyle = (typeof DEVELOPER_STYLES)[number]['slug']
export type OutputType = (typeof OUTPUT_TYPES)[number]['slug']
export type DevelopmentTemplate = (typeof DEVELOPMENT_TEMPLATES)[number]['slug']

export function developmentTemplate(value: string) {
  return DEVELOPMENT_TEMPLATES.find((template) => template.slug === value)
}

export function normalizeDeveloperStyle(value: string): DeveloperStyle {
  if (value === 'none') return 'none'
  if (value === 'first_principles' || value === 'my_writing' || value === 'me') {
    return value === 'me' ? 'my_writing' : value
  }
  return 'clear_direct'
}

export const developerStyleLabel = (slug: string) =>
  DEVELOPER_STYLES.find((style) => style.slug === normalizeDeveloperStyle(slug))?.label || 'Clear, direct'

export function parseTags(value: unknown): string[] {
  let v: unknown = value
  if (typeof v === 'string') {
    const s = v.trim()
    if (!s) return []
    try { v = JSON.parse(s) } catch { return [s] }
  }
  return Array.isArray(v) ? (v as unknown[]).map(String) : []
}

/** Parse JSON the agent returns even when wrapped in prose or ```json fences. */
export function parseJsonLoose(text: string): unknown {
  let t = (text || '').trim()
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (fence) t = fence[1].trim()
  const a = t.indexOf('['), o = t.indexOf('{')
  if (a >= 0 && (o < 0 || a < o)) t = t.slice(a, t.lastIndexOf(']') + 1)
  else if (o >= 0) t = t.slice(o, t.lastIndexOf('}') + 1)
  try { return JSON.parse(t) } catch { return null }
}

export function snippet(md: string, n = 160): string {
  const t = plainText(md || '')
  return t.length <= n ? t : t.slice(0, n).replace(/\s+\S*$/, '') + '…'
}

export function timeAgo(iso: string): string {
  if (!iso) return ''
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return ''
  const s = Math.max(0, (Date.now() - then) / 1000)
  if (s < 60) return 'just now'
  const m = s / 60; if (m < 60) return `${Math.floor(m)}m ago`
  const h = m / 60; if (h < 24) return `${Math.floor(h)}h ago`
  const d = h / 24; if (d < 7) return `${Math.floor(d)}d ago`
  const w = d / 7; if (w < 5) return `${Math.floor(w)}w ago`
  const mo = d / 30; if (mo < 12) return `${Math.floor(mo)}mo ago`
  return `${Math.floor(d / 365)}y ago`
}

export const KIND_ICON: Record<string, typeof FileText> = {
  thought: Lightbulb, article: FileText, tweet: MessageSquareText,
  repo: Github, video: Youtube, other: Link2,
}

// ── collections + filtering ──────────────────────────────────────────────────
export type Collection = Rec

export const LINK_KINDS = new Set(['article', 'repo', 'tweet', 'video'])
export type BoardType = 'all' | 'thought' | 'link' | 'unsorted'

/** Which top filter chip a note falls under. */
export function noteIsLink(n: Rec): boolean {
  return LINK_KINDS.has(str(n, 'kind')) || !!str(n, 'source_url')
}

/** Notes shown on the board are the settled ones + the ones still sorting. */
export function matchesType(n: Rec, type: BoardType): boolean {
  if (type === 'all') return true
  if (type === 'unsorted') return !str(n, 'collection_id')
  if (type === 'link') return noteIsLink(n)
  if (type === 'thought') return !noteIsLink(n)
  return true
}

export function looksLikeUrl(s: string): boolean {
  const t = s.trim()
  if (/\s/.test(t)) return false
  return /^https?:\/\//i.test(t) || /^[a-z0-9-]+(\.[a-z0-9-]+)+(\/|$)/i.test(t)
}

export function safeExternalUrl(raw: string): string | null {
  try {
    const url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`)
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : null
  } catch {
    return null
  }
}

export type LinkCapture = { url: string; comment: string }

/** Pull one public web link out of a capture while preserving the user's own note. */
export function parseLinkCapture(value: string): LinkCapture | null {
  const input = value.trim()
  const match = input.match(
    /(?:https?:\/\/|www\.)[^\s<>"']+|(?:[a-z0-9-]+\.)+(?:com|org|net|io|ai|dev|app|co|me|tv|xyz|design|page|site)(?:\/[^\s<>"']*)?/i,
  )
  if (!match) return null

  // Sentence punctuation is commonly typed immediately after a pasted link.
  const rawUrl = match[0].replace(/[),.;!?]+$/, '')
  const url = safeExternalUrl(rawUrl)
  if (!url) return null

  const before = input.slice(0, match.index)
  const after = input.slice((match.index || 0) + rawUrl.length)
  const comment = `${before} ${after}`
    .replace(/^[\s—–\-:|→]+|[\s—–\-:|→]+$/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim()

  return { url, comment }
}

export function looksLikeQuestion(s: string): boolean {
  const t = s.trim().toLowerCase()
  if (t.endsWith('?')) return true
  return /^(what|who|when|where|why|how|do i|did i|have i|is there|any(thing)?|remind me|show me|find|search|which)\b/.test(t)
}

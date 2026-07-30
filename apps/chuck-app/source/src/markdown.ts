// Tiny, dependency-free markdown <-> HTML for the editor.
// Supports the subset our content uses: headings (1-3), bold, italic, inline
// code, links, blockquotes, unordered/ordered lists, horizontal rules.

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function escapeAttr(s: string): string {
  return escapeHtml(s).replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}

function safeLink(raw: string): string | null {
  try {
    const url = new URL(raw)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null
    return escapeAttr(url.href)
  } catch {
    return null
  }
}

/** Inline markdown (within a single line) -> HTML. */
export function inlineMd(src: string): string {
  const codes: string[] = []
  let t = escapeHtml(src)
  // protect inline code first so its contents aren't re-parsed
  t = t.replace(/`([^`]+)`/g, (_, c) => { codes.push(c); return `\uE000${codes.length - 1}\uE000` })
  t = t.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, txt, rawUrl) => {
    const href = safeLink(rawUrl)
    return href
      ? `<a href="${href}" target="_blank" rel="noopener noreferrer">${txt}</a>`
      : txt
  })
  t = t.replace(/\*\*([^*]+?)\*\*/g, '<strong>$1</strong>')
  t = t.replace(/__([^_]+?)__/g, '<strong>$1</strong>')
  t = t.replace(/(^|[^*])\*([^*\n]+?)\*(?!\*)/g, '$1<em>$2</em>')
  t = t.replace(/(^|[^_\w])_([^_\n]+?)_(?![_\w])/g, '$1<em>$2</em>')
  t = t.replace(/\uE000(\d+)\uE000/g, (_, i) => `<code>${codes[+i]}</code>`)
  return t
}

/** Block markdown -> HTML string. */
export function mdToHtml(md: string): string {
  const lines = (md || '').replace(/\r\n/g, '\n').split('\n')
  const out: string[] = []
  let para: string[] = []
  // Standard markdown: consecutive non-blank lines are ONE paragraph, joined by a
  // space (a blank line starts a new paragraph). This keeps prose flowing instead of
  // hard-breaking mid-sentence when the source is soft-wrapped.
  const flush = () => { if (para.length) { out.push(`<p>${para.map(inlineMd).join(' ')}</p>`); para = [] } }
  let i = 0
  while (i < lines.length) {
    const t = lines[i].trim()
    let m: RegExpExecArray | null
    if (t === '') { flush(); i++; continue }
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(t)) { flush(); out.push('<hr>'); i++; continue }
    if ((m = /^(#{1,3})\s+(.*)$/.exec(t))) { flush(); const n = m[1].length; out.push(`<h${n}>${inlineMd(m[2])}</h${n}>`); i++; continue }
    if (/^>\s?/.test(t)) {
      flush()
      const q: string[] = []
      while (i < lines.length && /^>\s?/.test(lines[i].trim())) { q.push(lines[i].trim().replace(/^>\s?/, '')); i++ }
      out.push(`<blockquote>${q.map((l) => (l === '' ? '' : inlineMd(l))).join('<br>')}</blockquote>`)
      continue
    }
    if (/^[-*]\s+/.test(t)) {
      flush()
      const items: string[] = []
      while (i < lines.length && /^[-*]\s+/.test(lines[i].trim())) { items.push(lines[i].trim().replace(/^[-*]\s+/, '')); i++ }
      out.push(`<ul>${items.map((it) => `<li>${inlineMd(it)}</li>`).join('')}</ul>`)
      continue
    }
    if (/^\d+\.\s+/.test(t)) {
      flush()
      const items: string[] = []
      while (i < lines.length && /^\d+\.\s+/.test(lines[i].trim())) { items.push(lines[i].trim().replace(/^\d+\.\s+/, '')); i++ }
      out.push(`<ol>${items.map((it) => `<li>${inlineMd(it)}</li>`).join('')}</ol>`)
      continue
    }
    para.push(t)
    i++
  }
  flush()
  return out.join('')
}

/** Strip markdown syntax to plain text — for compact previews (card snippets). */
export function plainText(md: string): string {
  return (md || '')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^>\s?/gm, '')
    .replace(/^[-*]\s+/gm, '')
    .replace(/^\d+\.\s+/gm, '')
    .replace(/\*\*([^*]+?)\*\*/g, '$1')
    .replace(/__([^_]+?)__/g, '$1')
    .replace(/\*([^*]+?)\*/g, '$1')
    .replace(/`([^`]+?)`/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Serialize the inline content of an element back to markdown. */
function serializeInline(node: Node): string {
  let s = ''
  node.childNodes.forEach((c) => {
    if (c.nodeType === Node.TEXT_NODE) { s += c.textContent || ''; return }
    if (c.nodeType !== Node.ELEMENT_NODE) return
    const el = c as HTMLElement
    const tag = el.tagName
    if (tag === 'BR') s += '\n'
    else if (tag === 'STRONG' || tag === 'B') s += `**${serializeInline(el)}**`
    else if (tag === 'EM' || tag === 'I') s += `*${serializeInline(el)}*`
    else if (tag === 'CODE') s += '`' + (el.textContent || '') + '`'
    else if (tag === 'A') s += `[${serializeInline(el)}](${el.getAttribute('href') || ''})`
    else if (tag === 'SPAN') {
      let inner = serializeInline(el)
      const fw = el.style.fontWeight
      const fs = el.style.fontStyle
      if (fw === 'bold' || (/^\d+$/.test(fw) && +fw >= 600)) inner = `**${inner}**`
      if (fs === 'italic') inner = `*${inner}*`
      s += inner
    } else s += serializeInline(el)
  })
  return s
}

/** A contentEditable root -> markdown. */
export function htmlToMd(root: HTMLElement): string {
  const parts: string[] = []
  root.childNodes.forEach((node) => {
    if (node.nodeType === Node.TEXT_NODE) { const t = (node.textContent || ''); if (t.trim()) parts.push(t); return }
    if (node.nodeType !== Node.ELEMENT_NODE) return
    const el = node as HTMLElement
    const tag = el.tagName
    if (tag === 'H1') parts.push('# ' + serializeInline(el))
    else if (tag === 'H2') parts.push('## ' + serializeInline(el))
    else if (tag === 'H3') parts.push('### ' + serializeInline(el))
    else if (tag === 'BLOCKQUOTE') parts.push(serializeInline(el).split('\n').map((l) => (l === '' ? '>' : '> ' + l)).join('\n'))
    else if (tag === 'UL') Array.from(el.children).forEach((li) => parts.push('- ' + serializeInline(li as HTMLElement)))
    else if (tag === 'OL') Array.from(el.children).forEach((li, idx) => parts.push(`${idx + 1}. ` + serializeInline(li as HTMLElement)))
    else if (tag === 'HR') parts.push('---')
    else parts.push(serializeInline(el)) // P, DIV, or stray inline
  })
  return parts.map((p) => p.replace(/[ \t]+$/g, '')).filter((p, idx, a) => p !== '' || (idx > 0 && idx < a.length - 1)).join('\n\n').trim()
}

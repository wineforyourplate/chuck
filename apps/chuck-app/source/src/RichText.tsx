import { useEffect, useRef } from 'react'
import { mdToHtml, htmlToMd } from './markdown'

/**
 * A Notion-style contentEditable block. Renders markdown as formatted rich text,
 * edits in place (bold shows as bold), and emits markdown back on blur.
 * Shortcuts: Cmd/Ctrl+B bold, +I italic, +K link. Markdown autoformat at line
 * start: `# `/`## `/`### ` headings, `> ` quote, `- ` bullet. Enter inserts a
 * line break (stays in one block) — Notion-like.
 */
export function RichText({
  value, onCommit, placeholder, autoFocus,
}: { value: string; onCommit: (md: string) => void; placeholder?: string; autoFocus?: boolean }) {
  const ref = useRef<HTMLDivElement>(null)
  const last = useRef(value)

  // Render markdown into the editor when the value changes from outside (not while focused).
  useEffect(() => {
    const el = ref.current
    if (!el || el === document.activeElement) return
    if (value !== last.current || el.innerHTML === '') {
      el.innerHTML = value ? mdToHtml(value) : ''
      last.current = value
    }
  }, [value])

  useEffect(() => { if (autoFocus) ref.current?.focus() }, [autoFocus])

  function commit() {
    const el = ref.current
    if (!el) return
    const md = htmlToMd(el)
    last.current = md
    if (md !== value) onCommit(md)
  }

  function exec(cmd: string, arg?: string) { document.execCommand(cmd, false, arg) }

  function onKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    const mod = e.metaKey || e.ctrlKey
    if (mod && (e.key === 'b' || e.key === 'B')) { e.preventDefault(); exec('bold'); return }
    if (mod && (e.key === 'i' || e.key === 'I')) { e.preventDefault(); exec('italic'); return }
    if (mod && (e.key === 'k' || e.key === 'K')) {
      e.preventDefault()
      const url = window.prompt('Link URL:')
      if (url) exec('createLink', url)
      return
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      // keep edits inside one block (line break, not a new paragraph div)
      e.preventDefault()
      exec('insertLineBreak')
      return
    }
  }

  // Markdown autoformat: when space is typed right after a line-start marker.
  function onInput() {
    const sel = window.getSelection()
    if (!sel || !sel.isCollapsed || !sel.anchorNode) return
    const node = sel.anchorNode
    const text = node.textContent || ''
    if (!/[ ]$/.test(text)) return
    const trimmed = text.slice(0, sel.anchorOffset)
    let block: string | null = null
    if (/^#\s$/.test(trimmed)) block = 'h1'
    else if (/^##\s$/.test(trimmed)) block = 'h2'
    else if (/^###\s$/.test(trimmed)) block = 'h3'
    else if (/^>\s$/.test(trimmed)) block = 'blockquote'
    const list = /^[-*]\s$/.test(trimmed)
    if (!block && !list) return
    // strip the marker text, then apply the block format
    if (node.nodeType === Node.TEXT_NODE) node.textContent = text.slice(sel.anchorOffset)
    const r = document.createRange(); r.setStart(node, 0); r.collapse(true)
    sel.removeAllRanges(); sel.addRange(r)
    if (list) exec('insertUnorderedList')
    else if (block) exec('formatBlock', block)
  }

  return (
    <div
      ref={ref}
      className="rich"
      contentEditable
      suppressContentEditableWarning
      data-ph={placeholder || 'Write…'}
      onKeyDown={onKeyDown}
      onInput={onInput}
      onBlur={commit}
    />
  )
}

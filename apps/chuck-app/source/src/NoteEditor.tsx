import { useEffect, useRef, useState } from 'react'
import { useDeleteRecord, useUpdateRecord } from 'lemma-sdk/react'
import {
  AlertTriangle, CornerUpLeft, ExternalLink, Trash2, X,
} from 'lucide-react'
import { ChuckIcon } from './ChuckPet'
import { lemmaClient } from './lemma-client'
import { KIND_ICON, parseTags, Rec, safeExternalUrl, snippet, str } from './lib'
import { RichText } from './RichText'

export function NoteEditor({
  noteId,
  note,
  collections,
  onClose,
  onDevelop,
  refresh,
}: {
  noteId: string
  note: Rec
  collections: Rec[]
  onClose: () => void
  onDevelop: (id: string) => void
  refresh: () => void
}) {
  const { update } = useUpdateRecord({ client: lemmaClient, tableName: 'notes', recordId: noteId })
  const { remove } = useDeleteRecord({ client: lemmaClient, tableName: 'notes', recordId: noteId })
  const [title, setTitle] = useState(str(note, 'title'))
  const seeded = useRef(false)

  const status = str(note, 'status')
  const kind = str(note, 'kind') || 'thought'
  const Icon = KIND_ICON[kind] || KIND_ICON.thought
  const tags = parseTags(note.tags)
  const sourceUrl = str(note, 'source_url')
  const sourceHref = safeExternalUrl(sourceUrl)
  const body = str(note, 'body')
  const originalBody = str(note, 'original_body')

  useEffect(() => {
    if (!seeded.current) {
      setTitle(str(note, 'title'))
      seeded.current = true
    }
  }, [note])

  async function commit(patch: Rec) {
    await update(patch)
    refresh()
  }

  async function revertLegacyDevelopment() {
    if (!originalBody) return
    await update({ body: originalBody, voice: null, original_body: null })
    refresh()
  }

  return (
    <div className="editor-scrim" onClick={onClose}>
      <div className="editor" onClick={(event) => event.stopPropagation()}>
        <div className="editor-top ui">
          <div className="left">
            <button className="x-btn" onClick={onClose} aria-label="Close note"><X size={18} /></button>
            <span className="kind-badge"><Icon size={12} /> {kind}</span>
            {sourceHref ? (
              <a className="src-link" href={sourceHref} target="_blank" rel="noopener noreferrer">
                <ExternalLink size={12} /> {new URL(sourceHref).hostname.replace(/^www\./, '')}
              </a>
            ) : null}
          </div>
          <div className="right">
            <button className="develop-note-btn" onClick={() => onDevelop(noteId)}>
              <ChuckIcon size={17} /> Develop
            </button>
            <button
              className="ghost danger"
              onClick={async () => {
                if (confirm('Delete this note?')) {
                  await remove()
                  onClose()
                }
              }}
            >
              <Trash2 size={14} /> Delete
            </button>
          </div>
        </div>

        <div className="editor-body">
          <input
            className="title-input"
            value={title}
            placeholder="Untitled"
            onChange={(event) => setTitle(event.target.value)}
            onBlur={() => { if (title !== str(note, 'title')) void commit({ title }) }}
          />
          <div className="metarow">
            <span className={`status-pill ${status}`}>{status}</span>
            <select
              className="coll-select"
              value={str(note, 'collection_id')}
              onChange={(event) => void commit({ collection_id: event.target.value || null })}
            >
              <option value="">◦ Unsorted</option>
              {collections.map((collection) => (
                <option key={str(collection, 'id')} value={str(collection, 'id')}>
                  {str(collection, 'emoji') || '•'} {str(collection, 'name')}
                </option>
              ))}
            </select>
            <TagEditor tags={tags} onChange={(nextTags) => void commit({ tags: nextTags })} />
          </div>

          {status === 'failed' ? (
            <div className="failed-note ui">
              <AlertTriangle size={16} />
              <span>Chuck couldn't read that link. Paste the text below and it can still stay in your Mind Palace.</span>
            </div>
          ) : null}

          {originalBody && originalBody.trim() !== body.trim() ? (
            <div className="orig-banner ui">
              <div className="orig-text">
                <span className="orig-label">Legacy developed note · original preserved</span>
                <span className="orig-quote">“{snippet(originalBody, 150)}”</span>
              </div>
              <button className="orig-revert" onClick={revertLegacyDevelopment}>
                <CornerUpLeft size={13} /> Restore original
              </button>
            </div>
          ) : null}

          <RichText
            key={`${noteId}:${body.length}`}
            value={body}
            placeholder="Write, or paste the text…"
            onCommit={(markdown) => { if (markdown !== body) void commit({ body: markdown }) }}
          />

          <div className="note-development-callout ui">
            <div className="note-development-icon"><ChuckIcon size={22} /></div>
            <div>
              <b>Want to turn this into something?</b>
              <span>The Developer Agent creates a separate draft. This note stays untouched.</span>
            </div>
            <button onClick={() => onDevelop(noteId)}>Open Development</button>
          </div>
        </div>
      </div>
    </div>
  )
}

function TagEditor({ tags, onChange }: { tags: string[]; onChange: (tags: string[]) => void }) {
  const [value, setValue] = useState('')
  return (
    <span className="tageditor">
      {tags.map((tag) => (
        <span key={tag} className="tag-chip">{tag}
          <button onClick={() => onChange(tags.filter((item) => item !== tag))} aria-label={`Remove ${tag} tag`}>
            <X size={11} />
          </button>
        </span>
      ))}
      <input
        className="tag-in"
        value={value}
        placeholder="+ tag"
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && value.trim()) {
            onChange([...new Set([...tags, value.trim()])])
            setValue('')
          }
        }}
      />
    </span>
  )
}

import { ExternalLink, FileSearch } from 'lucide-react'
import type { NoteEvidence } from './app-contract'
import { type Rec, safeExternalUrl, snippet, str } from './lib'

export function AnswerEvidence({
  evidence,
  notes,
  onOpenNote,
}: {
  evidence: NoteEvidence[]
  notes: Rec[]
  onOpenNote: (noteId: string) => void
}) {
  if (!evidence.length) return null

  return (
    <div className="answer-evidence ui" aria-label="Saved notes supporting this answer">
      <div className="answer-evidence__label"><FileSearch size={13} /> From your Mind Palace</div>
      {evidence.map((item) => {
        const note = notes.find((candidate) => str(candidate, 'id') === item.noteId)
        const source = safeExternalUrl(str(note, 'source_url'))
        const title = str(note, 'title') || snippet(str(note, 'body'), 72) || 'Saved note'
        const host = source ? new URL(source).hostname.replace(/^www\./, '') : ''
        return (
          <button
            key={item.noteId}
            className="citation-card"
            onClick={() => onOpenNote(item.noteId)}
            aria-label={`Open saved note: ${title}`}
          >
            <span className="citation-card__copy">
              <b>{title}</b>
              <span>{item.reason}</span>
              <small>{item.source === 'file' ? 'Indexed note' : 'Saved thought'}{host ? ` · ${host}` : ''}</small>
            </span>
            <ExternalLink size={14} aria-hidden="true" />
          </button>
        )
      })}
    </div>
  )
}

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { ArrowUp, Lightbulb, Loader2, Plus, X } from 'lucide-react'
import gsap from 'gsap'
import { ChuckPet } from './ChuckPet'
import { lemmaClient } from './lemma-client'
import { Rec, str, matchesType, type BoardType } from './lib'
import { BoardCard } from './BoardCard'
import { useMasonryGrid } from './useMasonryGrid'

const TYPE_CHIPS: { key: BoardType; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'thought', label: 'Thoughts' },
  { key: 'link', label: 'Links' },
]

type CaptureFeedback = { message: string }

export function Board({
  notes, collections, collFilter, loading, onOpen, onDevelop, onCreate,
}: {
  notes: Rec[]; collections: Rec[]; collFilter: string
  loading: boolean
  onOpen: (id: string) => void
  onDevelop: (id: string) => void
  onCreate: (data: Rec) => Promise<string | null>
}) {
  const [input, setInput] = useState('')
  const [captureOpen, setCaptureOpen] = useState(false)
  const [captureError, setCaptureError] = useState('')
  const [saving, setSaving] = useState(false)
  const [captureFeedback, setCaptureFeedback] = useState<CaptureFeedback | null>(null)
  const [typeChip, setTypeChip] = useState<BoardType>('all')
  const [sort, setSort] = useState<'latest' | 'oldest'>('latest')
  const masonryRef = useRef<HTMLDivElement>(null)
  const appearedNoteIds = useRef(new Set<string>())

  useEffect(() => {
    if (!captureFeedback) return
    const timer = window.setTimeout(() => setCaptureFeedback(null), 4500)
    return () => window.clearTimeout(timer)
  }, [captureFeedback])

  async function submit(value = input) {
    const v = value.trim()
    if (!v || saving) return
    setSaving(true)
    setCaptureError('')
    setCaptureFeedback(null)
    try {
      const noteId = await onCreate({ source: 'chat', kind: 'thought', body: v, status: 'raw' })
      if (!noteId) throw new Error('The save completed without a note id.')
      setInput('')
      setCaptureOpen(false)
      setCaptureFeedback({ message: 'Thought saved. Chuck is sorting it now.' })
    } catch {
      setCaptureError('That didn’t save. Your thought is still here—try again.')
    } finally {
      setSaving(false)
    }
  }

  async function move(id: string, collId: string | null) {
    try { await lemmaClient.records.update('notes', id, { collection_id: collId }) } catch { /* live query will still reflect */ }
  }
  async function del(id: string) {
    try { await lemmaClient.records.delete('notes', id) } catch { /* ignore */ }
  }

  const collName = collFilter === 'all' ? 'Mind Palace'
    : collFilter === 'unsorted' ? 'Unsorted'
      : str(collections.find((c) => str(c, 'id') === collFilter) || {}, 'name') || 'Mind Palace'

  const visible = notes
    .filter((n) => {
      if (collFilter === 'all') return true
      if (collFilter === 'unsorted') return !str(n, 'collection_id')
      return str(n, 'collection_id') === collFilter
    })
    .filter((n) => matchesType(n, typeChip))
    .sort((a, b) => {
      const cmp = str(a, 'created_at').localeCompare(str(b, 'created_at'))
      return sort === 'latest' ? -cmp : cmp
    })

  const visibleKey = visible.map((note) => `${str(note, 'id')}:${str(note, 'status')}`).join('|')

  useMasonryGrid(masonryRef, visibleKey)

  useLayoutEffect(() => {
    const grid = masonryRef.current
    if (!grid) return
    const newCards = Array.from(grid.children).filter((element) => {
      const id = (element as HTMLElement).dataset.noteId
      if (!id || appearedNoteIds.current.has(id)) return false
      appearedNoteIds.current.add(id)
      return true
    })
    if (!newCards.length) return
    const mm = gsap.matchMedia()
    mm.add('(prefers-reduced-motion: no-preference)', () => {
      gsap.fromTo(
        newCards,
        { y: 18, scale: 0.985, autoAlpha: 0 },
        {
          y: 0,
          scale: 1,
          autoAlpha: 1,
          duration: 0.56,
          ease: 'power3.out',
          stagger: { each: 0.045, from: 'start' },
          clearProps: 'transform,opacity,visibility',
        },
      )
    })
    return () => mm.revert()
  }, [visibleKey])

  return (
    <div className="main">
      <div className="scroll">
        <div className="wrap wide">
          <div className="hero-head">
            <div>
              <div className="hero-title">{collName}</div>
              <div className="hero-tagline">
                {collFilter === 'all' ? 'Everything worth keeping, in one place.'
                  : collFilter === 'unsorted' ? "Not filed yet — triage, or leave it."
                    : str(collections.find((c) => str(c, 'id') === collFilter) || {}, 'rule') || ''}
              </div>
            </div>
            <div className="head-right ui">
              <span className="hero-meta">{visible.length} item{visible.length === 1 ? '' : 's'}</span>
              <select className="sortsel" value={sort} onChange={(e) => setSort(e.target.value as 'latest' | 'oldest')}>
                <option value="latest">Latest</option>
                <option value="oldest">Oldest</option>
              </select>
            </div>
          </div>

          <div className="chips ui">
            {TYPE_CHIPS.map((c) => (
              <button key={c.key} className={`chip${typeChip === c.key ? ' on' : ''}`} onClick={() => setTypeChip(c.key)}>{c.label}</button>
            ))}
          </div>

          {loading && !notes.length ? <div className="loading ui">Loading your mind palace…</div> : null}
          {!loading && !visible.length ? (
            <div className="empty">
              {collFilter === 'all' && !notes.length
                ? <ChuckPet state="waving" size={88} className="empty-pet" />
                : null}
              <b>Nothing here yet.</b><br />
              {collFilter === 'all' ? 'Use + to save a quick thought. Links and questions live in Chat.' : 'No items in this view.'}
            </div>
          ) : null}

          <div className="masonry" ref={masonryRef}>
            {visible.map((n) => (
              <BoardCard key={str(n, 'id')} note={n} collections={collections}
                onOpen={onOpen} onDevelop={onDevelop} onMove={move} onDelete={del} />
            ))}
          </div>
        </div>
      </div>

      {captureFeedback ? (
        <div className="capture-toast ui" role="status" aria-live="polite">
          <ChuckPet state="jumping" size={36} loop={false} />
          <span>{captureFeedback.message}</span>
          <button onClick={() => setCaptureFeedback(null)} aria-label="Dismiss save status"><X size={14} /></button>
        </div>
      ) : null}

      <button
        className="quick-capture-fab ui"
        onClick={() => { setCaptureError(''); setCaptureOpen(true) }}
        aria-label="Capture a quick thought"
        title="Quick thought"
      >
        <Plus size={24} aria-hidden="true" />
      </button>

      {captureOpen ? (
        <div className="quick-capture-scrim" onClick={() => { if (!saving) setCaptureOpen(false) }}>
          <form
            className="quick-capture-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="quick-thought-title"
            onClick={(e) => e.stopPropagation()}
            onSubmit={(e) => { e.preventDefault(); void submit() }}
          >
            <div className="quick-capture-head">
              <div>
                <span className="quick-capture-kicker ui"><Lightbulb size={13} /> Quick capture</span>
                <h2 id="quick-thought-title">What’s on your mind?</h2>
              </div>
              <button type="button" className="x-btn" onClick={() => setCaptureOpen(false)} disabled={saving} aria-label="Close quick capture">
                <X size={18} />
              </button>
            </div>
            <textarea
              autoFocus
              value={input}
              placeholder="A thought worth keeping…"
              onChange={(e) => { setInput(e.target.value); setCaptureError('') }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault()
                  void submit()
                }
              }}
              aria-describedby={captureError ? 'quick-thought-error' : 'quick-thought-hint'}
            />
            <div id="quick-thought-hint" className="quick-capture-hint ui">
              Saved exactly as you write it. Use Chat for links and questions.
            </div>
            {captureError ? (
              <div id="quick-thought-error" className="quick-capture-error pet-inline-state ui" role="alert">
                <ChuckPet state="failed" size={36} loop={false} />
                <span>{captureError}</span>
              </div>
            ) : null}
            <div className="quick-capture-actions ui">
              <span>⌘ Enter to save</span>
              <button className="primary" type="submit" disabled={!input.trim() || saving}>
                {saving ? <><Loader2 size={15} className="spin" /> Saving…</> : <><ArrowUp size={15} /> Save thought</>}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  )
}

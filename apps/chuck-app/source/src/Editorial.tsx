import { useEffect, useMemo, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { lemmaClient } from './lemma-client'
import { Rec, str } from './lib'
import { ChuckPet, ChuckSplash } from './ChuckPet'

const STATUS_LABEL: Record<string, string> = {
  drafting: 'Drafting', ready: 'Ready', sent: 'Sent', failed: 'Failed',
}

function fmtWeekRange(startIso: string, endIso: string): string {
  const start = new Date(startIso)
  const end = new Date(endIso)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return ''
  const monthDay = (d: Date) => d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  const sameMonth = start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear()
  return sameMonth
    ? `${monthDay(start)}–${end.getDate()}, ${end.getFullYear()}`
    : `${monthDay(start)} – ${monthDay(end)}, ${end.getFullYear()}`
}

export function Editorial() {
  const [editions, setEditions] = useState<Rec[] | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [html, setHtml] = useState<string | null>(null)
  const [htmlLoading, setHtmlLoading] = useState(false)
  const [htmlError, setHtmlError] = useState('')

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const rows = (await lemmaClient.records.list('editions', { limit: 200 })).items as Rec[]
        if (!cancelled) setEditions(rows)
      } catch {
        if (!cancelled) setEditions([])
      }
    })()
    return () => { cancelled = true }
  }, [])

  const sorted = useMemo(
    () => [...(editions || [])].sort((a, b) => str(b, 'week_start').localeCompare(str(a, 'week_start'))),
    [editions],
  )

  useEffect(() => {
    if (!sorted.length) { setSelectedId(null); return }
    if (!selectedId || !sorted.some((edition) => str(edition, 'id') === selectedId)) {
      setSelectedId(str(sorted[0], 'id'))
    }
  }, [sorted, selectedId])

  const selected = sorted.find((edition) => str(edition, 'id') === selectedId) || null
  const contentPath = selected ? str(selected, 'content_path') : ''

  useEffect(() => {
    if (!contentPath) { setHtml(null); setHtmlError(''); return }
    let cancelled = false
    setHtml(null)
    setHtmlLoading(true)
    setHtmlError('')
    ;(async () => {
      try {
        const blob = await lemmaClient.files.download(contentPath)
        const text = await blob.text()
        if (!cancelled) setHtml(text)
      } catch {
        if (!cancelled) setHtmlError('Could not load this edition.')
      } finally {
        if (!cancelled) setHtmlLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [contentPath])

  if (editions === null) {
    return <ChuckSplash message="Opening the paper." detail="Fetching your editions." />
  }

  if (!sorted.length) {
    return (
      <div className="main">
        <div className="scroll">
          <div className="wrap">
            <div className="hero-head"><div className="hero-title">Editorial</div></div>
            <div className="empty editorial-empty">
              <ChuckPet state="idle" size={40} animate={false} />
              <p>Nothing printed yet. First edition lands Sunday.</p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="main editorial-main">
      <div className="editorial-list ui">
        <div className="editorial-list-head">Editorial</div>
        <div className="editorial-list-scroll">
          {sorted.map((edition) => {
            const id = str(edition, 'id')
            const status = str(edition, 'status') || 'drafting'
            return (
              <button
                key={id}
                className={`editorial-item${id === selectedId ? ' active' : ''}`}
                onClick={() => setSelectedId(id)}
              >
                <span className="editorial-item-top">
                  <span className="editorial-item-title">{str(edition, 'title') || 'Untitled edition'}</span>
                  <span className={`editorial-status editorial-status--${status}`}>
                    {STATUS_LABEL[status] || status}
                  </span>
                </span>
                <span className="editorial-item-meta">
                  {fmtWeekRange(str(edition, 'week_start'), str(edition, 'week_end'))}
                  {' · '}{str(edition, 'item_count') || '0'} filed
                </span>
              </button>
            )
          })}
        </div>
      </div>

      <div className="editorial-preview">
        {htmlLoading ? (
          <div className="editorial-frame-status"><Loader2 size={20} className="spin" /></div>
        ) : htmlError ? (
          <div className="editorial-frame-status editorial-frame-status--error">{htmlError}</div>
        ) : html ? (
          <iframe
            key={contentPath}
            className="editorial-frame"
            srcDoc={html}
            sandbox="allow-popups allow-popups-to-escape-sandbox"
            title={selected ? str(selected, 'title') || 'Edition' : 'Edition'}
          />
        ) : null}
      </div>
    </div>
  )
}

import { useLayoutEffect, useRef, useState } from 'react'
import {
  AlertTriangle, ArrowUpRight, Check, FolderInput, Link2, MoreHorizontal,
  Sparkles, Trash2,
} from 'lucide-react'
import gsap from 'gsap'
import { ChuckIcon } from './ChuckPet'
import {
  type Rec, KIND_ICON, noteIsLink, parseTags, safeExternalUrl, snippet, str, timeAgo,
} from './lib'

type CardProps = {
  note: Rec
  collections: Rec[]
  onOpen: (id: string) => void
  onDevelop: (id: string) => void
  onMove: (id: string, collId: string | null) => void
  onDelete: (id: string) => void
}

const THOUGHT_TONES = ['oat', 'sage', 'sky', 'lilac', 'peach']

function stableIndex(value: string, length: number) {
  let hash = 0
  for (let i = 0; i < value.length; i += 1) hash = ((hash << 5) - hash + value.charCodeAt(i)) | 0
  return Math.abs(hash) % length
}

function hostFromUrl(value: string) {
  const safe = safeExternalUrl(value)
  if (!safe) return 'saved link'
  try { return new URL(safe).hostname.replace(/^www\./, '') } catch { return 'saved link' }
}

function formatCardDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return {
    month: date.toLocaleDateString(undefined, { month: 'short' }).toUpperCase(),
    day: date.toLocaleDateString(undefined, { day: '2-digit' }),
  }
}

function derivedPreview(sourceUrl: string, storedPreview: string) {
  const stored = safeExternalUrl(storedPreview)
  if (stored) return stored
  const safe = safeExternalUrl(sourceUrl)
  if (!safe) return ''

  try {
    const url = new URL(safe)
    const host = url.hostname.replace(/^www\./, '')
    if (host === 'youtu.be') {
      const id = url.pathname.split('/').filter(Boolean)[0]
      return id ? `https://i.ytimg.com/vi/${id}/hqdefault.jpg` : ''
    }
    if (host.endsWith('youtube.com')) {
      const id = url.searchParams.get('v') || url.pathname.match(/\/(?:shorts|embed)\/([^/?]+)/)?.[1]
      return id ? `https://i.ytimg.com/vi/${id}/hqdefault.jpg` : ''
    }
    if (host === 'github.com') {
      const [owner, repo] = url.pathname.split('/').filter(Boolean)
      return owner && repo ? `https://opengraph.githubassets.com/chuck/${owner}/${repo}` : ''
    }
  } catch {
    return ''
  }
  return ''
}

function CardMenu({
  id, collId, collections, menu, setMenu, onDevelop, onMove, onDelete, variant,
}: {
  id: string
  collId: string
  collections: Rec[]
  menu: boolean
  setMenu: (value: boolean) => void
  onDevelop: CardProps['onDevelop']
  onMove: CardProps['onMove']
  onDelete: CardProps['onDelete']
  variant?: 'overlay'
}) {
  return (
    <>
      <button
        className={`card-menu-btn${variant ? ` ${variant}` : ''}`}
        onClick={(event) => { event.stopPropagation(); setMenu(!menu) }}
        aria-label="Card actions"
        aria-expanded={menu}
      >
        <MoreHorizontal size={17} />
      </button>
      {menu ? (
        <>
          <div className="menu-scrim" onClick={(event) => { event.stopPropagation(); setMenu(false) }} />
          <div className="card-menu" onClick={(event) => event.stopPropagation()}>
            <button className="menu-item develop-menu-item" onClick={() => { onDevelop(id); setMenu(false) }}>
              <span><ChuckIcon size={16} /> Develop</span>
              <ChevronRightIcon />
            </button>
            <div className="menu-sep" />
            <div className="menu-label"><FolderInput size={12} /> Move to</div>
            {collections.map((collection) => (
              <button
                key={str(collection, 'id')}
                className="menu-item"
                onClick={() => { onMove(id, str(collection, 'id')); setMenu(false) }}
              >
                <span>{str(collection, 'emoji') || '•'} {str(collection, 'name')}</span>
                {collId === str(collection, 'id') ? <Check size={13} /> : null}
              </button>
            ))}
            <button className="menu-item" onClick={() => { onMove(id, null); setMenu(false) }}>
              <span>Unsorted</span>{!collId ? <Check size={13} /> : null}
            </button>
            <div className="menu-sep" />
            <button className="menu-item danger" onClick={() => { onDelete(id); setMenu(false) }}>
              <Trash2 size={13} /> Delete
            </button>
          </div>
        </>
      ) : null}
    </>
  )
}

function ChevronRightIcon() {
  return <span aria-hidden="true">›</span>
}

export function BoardCard({ note, collections, onOpen, onDevelop, onMove, onDelete }: CardProps) {
  const [menu, setMenu] = useState(false)
  const [previewFailed, setPreviewFailed] = useState(false)
  const cardRef = useRef<HTMLDivElement>(null)
  const previewArtRef = useRef<HTMLDivElement>(null)
  const previousStatus = useRef<string | null>(null)
  const id = str(note, 'id')
  const status = str(note, 'status')
  const kind = str(note, 'kind') || 'thought'
  const title = str(note, 'title')
  const body = str(note, 'body')
  const userNote = str(note, 'user_note')
  const sourceUrl = str(note, 'source_url')
  const link = noteIsLink(note)
  const sorting = status === 'raw' || status === 'curating'
  const collId = str(note, 'collection_id')
  const tags = parseTags(note.tags)
  const Icon = KIND_ICON[kind] || Link2
  const safeSource = safeExternalUrl(sourceUrl)
  const host = hostFromUrl(sourceUrl)
  const date = formatCardDate(str(note, 'created_at'))
  const preview = derivedPreview(sourceUrl, str(note, 'preview_image_url'))
  const tone = THOUGHT_TONES[stableIndex(id || title || body, THOUGHT_TONES.length)]
  const openLabel = `Open note${title ? `: ${title}` : ''}`

  useLayoutEffect(() => {
    const card = cardRef.current
    if (!card) return
    const priorStatus = previousStatus.current
    previousStatus.current = status
    const context = gsap.context(() => {
      gsap.set(card, { transformOrigin: 'center bottom' })
      if (previewArtRef.current) gsap.set(previewArtRef.current, { transformOrigin: 'center center' })
      if (
        priorStatus
        && priorStatus !== status
        && !window.matchMedia('(prefers-reduced-motion: reduce)').matches
      ) {
        gsap.fromTo(
          card,
          { y: 10, scale: 0.985, autoAlpha: 0.68 },
          {
            y: 0,
            scale: 1,
            autoAlpha: 1,
            duration: 0.44,
            ease: 'power3.out',
            overwrite: 'auto',
            clearProps: 'transform,opacity,visibility',
          },
        )
      }
    }, card)
    return () => context.revert()
  }, [link, status])

  function animateHover(active: boolean) {
    if (
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
      || !window.matchMedia('(hover: hover) and (pointer: fine)').matches
    ) return
    if (cardRef.current) {
      gsap.to(cardRef.current, {
        y: active ? -6 : 0,
        duration: active ? 0.34 : 0.46,
        ease: active ? 'power3.out' : 'expo.out',
        overwrite: 'auto',
      })
    }
    if (previewArtRef.current) {
      gsap.to(previewArtRef.current, {
        scale: active ? 1.035 : 1,
        duration: 0.65,
        ease: 'power3.out',
        overwrite: 'auto',
      })
    }
  }

  const commonProps = {
    role: 'article',
    onMouseEnter: () => animateHover(true),
    onMouseLeave: () => animateHover(false),
    onFocus: () => animateHover(true),
    onBlur: () => animateHover(false),
  }

  if (sorting) {
    return (
      <div className="card-wrap" data-note-id={id}>
        <div ref={cardRef} className={`card card--sorting${link ? ' card--link' : ''}`} {...commonProps}>
          <button className="card-open" onClick={() => onOpen(id)} aria-label={openLabel} />
          <div className="sorting-head">
            <span className="kind-badge"><Sparkles size={12} /> Chuck is reading</span>
            <span className="sorting-pulse" aria-hidden="true" />
          </div>
          <div className="card-snippet">{snippet(body || sourceUrl, 140) || 'Just landed.'}</div>
          <div className="sk-lines" aria-hidden="true"><div className="shimmer" /><div className="shimmer" /></div>
        </div>
      </div>
    )
  }

  if (link) {
    return (
      <div className="card-wrap" data-note-id={id}>
        <div
          ref={cardRef}
          className={`card card--link${status === 'failed' ? ' is-failed' : ''}`}
          {...commonProps}
        >
          <button className="card-open" onClick={() => onOpen(id)} aria-label={openLabel} />
          <div className="link-card__media">
            <div ref={previewArtRef} className={`link-card__art link-card__art--${stableIndex(host, 4)}`}>
              {preview && !previewFailed ? (
                <img
                  src={preview}
                  alt=""
                  loading="lazy"
                  referrerPolicy="no-referrer"
                  onError={() => setPreviewFailed(true)}
                />
              ) : (
                <div className="link-card__fallback" aria-hidden="true">
                  <span>{host.split('.')[0].slice(0, 2).toUpperCase()}</span>
                  <i />
                </div>
              )}
            </div>
            <div className="link-card__shade" />
            {date ? (
              <span className="date-stamp ui">
                <b>{date.month}</b><span>{date.day}</span>
              </span>
            ) : null}
            <span className="link-kind ui"><Icon size={12} /> {kind}</span>
          </div>

          <div className="link-card__content">
            <div className="link-card__source ui">{host}</div>
            {title ? <div className="link-card__title">{title}</div> : null}
            {userNote ? (
              <div className="link-card__note">
                <span className="ui">My note</span>
                {userNote}
              </div>
            ) : null}
            {status === 'failed' ? (
              <div className="status-line failed"><AlertTriangle size={12} /> Couldn’t read this link — open to paste</div>
            ) : null}
            <div className="link-card__summary">{snippet(body, 190) || 'Saved for later.'}</div>
            <div className="link-card__foot ui">
              <span className="tags">
                {tags.slice(0, 2).map((tag) => <span className="tag" key={tag}>#{tag}</span>)}
              </span>
              {safeSource ? (
                <a
                  className="source-link"
                  href={safeSource}
                  target="_blank"
                  rel="noreferrer"
                  onClick={(event) => event.stopPropagation()}
                  aria-label={`Open ${host}`}
                >
                  Visit <ArrowUpRight size={13} />
                </a>
              ) : <span className="card-time">{timeAgo(str(note, 'created_at'))}</span>}
            </div>
          </div>
        </div>
        <CardMenu
          id={id} collId={collId} collections={collections} menu={menu} setMenu={setMenu}
          onDevelop={onDevelop} onMove={onMove} onDelete={onDelete} variant="overlay"
        />
      </div>
    )
  }

  return (
    <div className="card-wrap" data-note-id={id}>
      <div ref={cardRef} className={`card card--thought card--${tone}`} {...commonProps}>
        <button className="card-open" onClick={() => onOpen(id)} aria-label={openLabel} />
        <div className="thought-card__top ui">
          <span className="thought-card__eyebrow"><Sparkles size={12} /> Thought</span>
        </div>
        <span className="thought-card__mark" aria-hidden="true">“</span>
        {title ? <div className="thought-card__title">{title}</div> : null}
        <div className={`thought-card__body${body.length > 220 ? ' is-long' : ''}`}>
          {snippet(body, 330) || 'Saved thought'}
        </div>
        <div className="thought-card__foot ui">
          <span className="tags">
            {tags.slice(0, 3).map((tag) => <span className="tag" key={tag}>#{tag}</span>)}
          </span>
          <span className="card-time">{timeAgo(str(note, 'created_at'))}</span>
        </div>
      </div>
      <CardMenu
        id={id} collId={collId} collections={collections} menu={menu} setMenu={setMenu}
        onDevelop={onDevelop} onMove={onMove} onDelete={onDelete}
      />
    </div>
  )
}

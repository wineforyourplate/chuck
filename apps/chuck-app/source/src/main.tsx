import React, { useEffect, useMemo, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ScheduleType } from 'lemma-sdk'
import { useCurrentUser, useLiveRecords, useCreateRecord, useRecord } from 'lemma-sdk/react'
import {
  LayoutGrid, MessagesSquare, SlidersHorizontal, Plus, Hash, Inbox, Newspaper, X,
} from 'lucide-react'
import { lemmaClient } from './lemma-client'
import { AccessGate } from './AccessGate'
import {
  APP_ROUTES,
  appPath,
  curationScheduleName,
  curationSchedulePayload,
  isCurationSchedule,
  parseAppLocation,
} from './app-contract'
import { Rec, str } from './lib'
import { Board } from './Board'
import { NoteEditor } from './NoteEditor'
import { Chat } from './Chat'
import { Profile } from './Profile'
import { DeveloperStudio } from './DeveloperStudio'
import { Editorial } from './Editorial'
import { NewCollectionDialog } from './NewCollectionDialog'
import { ChuckIcon, ChuckPet, ChuckSplash } from './ChuckPet'
import './styles.css'

const queryClient = new QueryClient()

type CollFilter = 'all' | 'unsorted' | string  // string = a collection id
type Route = (typeof APP_ROUTES)[number]

function Sidebar({
  route, onRoute, collections, counts, collFilter, onPickColl, onNewColl, email,
}: {
  route: Route; onRoute: (r: Route) => void
  collections: Rec[]; counts: Record<string, number>
  collFilter: CollFilter; onPickColl: (c: CollFilter) => void
  onNewColl: () => void; email: string
}) {
  const goBoard = (c: CollFilter) => { onPickColl(c); onRoute('board') }
  return (
    <div className="sidebar">
      <div className="brand">
        <ChuckPet state="idle" size={30} animate={false} className="brand-pet" />
        Chuck
      </div>
      <div className="brand-sub">your second memory</div>

      <button className={`nav-item${route === 'board' && collFilter === 'all' ? ' active' : ''}`} onClick={() => goBoard('all')}>
        <LayoutGrid size={16} /> Mind Palace
      </button>
      <button className={`nav-item${route === 'chat' ? ' active' : ''}`} onClick={() => onRoute('chat')}>
        <MessagesSquare size={16} /> Chat
      </button>
      <button className={`nav-item${route === 'develop' ? ' active' : ''}`} onClick={() => onRoute('develop')}>
        <ChuckIcon size={19} /> Develop
      </button>
      <button className={`nav-item${route === 'editorial' ? ' active' : ''}`} onClick={() => onRoute('editorial')}>
        <Newspaper size={16} /> Editorial
      </button>
      <button className={`nav-item profile-nav-mobile${route === 'profile' ? ' active' : ''}`} onClick={() => onRoute('profile')}>
        <SlidersHorizontal size={16} /> Settings
      </button>

      <div className="nav-section">Collections</div>
      {collections.map((c) => {
        const id = str(c, 'id')
        return (
          <button key={id} className={`nav-item coll${route === 'board' && collFilter === id ? ' active' : ''}`} onClick={() => goBoard(id)}>
            <span className="coll-emoji">{str(c, 'emoji') || <Hash size={14} />}</span>
            <span className="coll-name">{str(c, 'name')}</span>
            <span className="coll-count">{counts[id] || 0}</span>
          </button>
        )
      })}
      <button className={`nav-item coll${route === 'board' && collFilter === 'unsorted' ? ' active' : ''}`} onClick={() => goBoard('unsorted')}>
        <span className="coll-emoji"><Inbox size={14} /></span>
        <span className="coll-name">Unsorted</span>
        <span className="coll-count">{counts['__unsorted__'] || 0}</span>
      </button>
      <button className="nav-item new-coll" onClick={onNewColl}><Plus size={15} /> New collection</button>

      <div className="nav-spacer" />
      <button
        className={`profile-nav${route === 'profile' ? ' active' : ''}`}
        onClick={() => onRoute('profile')}
        title={email || 'Profile'}
      >
        <span className="profile-nav-avatar" aria-hidden="true">{email.trim().charAt(0).toUpperCase() || 'P'}</span>
        <span className="profile-nav-copy">
          <b>Settings</b>
          <small>Account &amp; preferences</small>
        </span>
        <SlidersHorizontal size={15} />
      </button>
    </div>
  )
}

function App() {
  const initialLocation = parseAppLocation(window.location.pathname, window.location.search)
  const [route, setRoute] = useState<Route>(initialLocation.route as Route)
  const [collFilter, setCollFilter] = useState<CollFilter>('all')
  const [openId, setOpenId] = useState<string | null>(initialLocation.route === 'board' ? initialLocation.noteId : null)
  const [developNoteId, setDevelopNoteId] = useState<string | null>(initialLocation.route === 'develop' ? initialLocation.noteId : null)
  const [newColl, setNewColl] = useState(false)
  const [missingNoteId, setMissingNoteId] = useState('')
  const [curationSetupError, setCurationSetupError] = useState('')

  const { user } = useCurrentUser({ client: lemmaClient })
  const notesQuery = useLiveRecords({ client: lemmaClient, tableName: 'notes' })
  const collQuery = useLiveRecords({ client: lemmaClient, tableName: 'collections' })
  const draftsQuery = useLiveRecords({ client: lemmaClient, tableName: 'drafts' })
  const { create: createNoteRec } = useCreateRecord({ client: lemmaClient, tableName: 'notes' })
  const { create: createCollRec } = useCreateRecord({ client: lemmaClient, tableName: 'collections' })

  useEffect(() => {
    if (!user?.id) return
    let cancelled = false

    async function ensurePersonalCurationSchedule() {
      try {
        const desiredName = curationScheduleName(user!.id)
        const response = await lemmaClient.schedules.list({
          scheduleType: ScheduleType.DATASTORE,
          agentName: 'curator',
          limit: 100,
        })
        const personalSchedules = response.items.filter(
          (schedule) => schedule.user_id === user!.id,
        )
        const exact = personalSchedules.find((schedule) => schedule.name === desiredName)
        const compatible = personalSchedules.find(isCurationSchedule)
        const existing = exact || compatible

        if (existing) {
          if (!isCurationSchedule(existing) || !existing.is_active) {
            await lemmaClient.schedules.update(existing.id, {
              agent_name: 'curator',
              config: { table_name: 'notes', operations: ['INSERT'] },
              is_active: true,
              visibility: 'PERSONAL',
            })
          }
        } else {
          await lemmaClient.schedules.create({
            ...curationSchedulePayload(user!.id),
            schedule_type: ScheduleType.DATASTORE,
          })
        }
        if (!cancelled) setCurationSetupError('')
      } catch (error) {
        // A second tab may win the create race. Recheck once before surfacing it.
        try {
          const retry = await lemmaClient.schedules.list({
            scheduleType: ScheduleType.DATASTORE,
            agentName: 'curator',
            limit: 100,
          })
          const ready = retry.items.some(
            (schedule) => schedule.user_id === user!.id
              && schedule.is_active
              && isCurationSchedule(schedule),
          )
          if (ready) {
            if (!cancelled) setCurationSetupError('')
            return
          }
        } catch {
          // Preserve the original setup failure below.
        }
        if (!cancelled) {
          setCurationSetupError(
            'Background filing could not be enabled for this account. Ask a pod admin to check your member role.',
          )
        }
      }
    }

    void ensurePersonalCurationSchedule()
    return () => { cancelled = true }
  }, [user?.id])

  const notes = (notesQuery.records as Rec[]) || []
  const cachedOpenNote = notes.find((note) => str(note, 'id') === openId) || null
  const linkedNoteQuery = useRecord<Rec>({
    client: lemmaClient,
    tableName: 'notes',
    recordId: openId,
    enabled: Boolean(openId && !cachedOpenNote),
  })
  const collections = useMemo(
    () => [...((collQuery.records as Rec[]) || [])].sort((a, b) =>
      (Number(a['sort_order'] || 0) - Number(b['sort_order'] || 0)) || str(a, 'name').localeCompare(str(b, 'name'))),
    [collQuery.records],
  )

  const counts = useMemo(() => {
    const c: Record<string, number> = { __unsorted__: 0 }
    for (const n of notes) {
      if (str(n, 'status') !== 'filed') continue
      const cid = str(n, 'collection_id')
      if (cid) c[cid] = (c[cid] || 0) + 1
      else c['__unsorted__']++
    }
    return c
  }, [notes])

  async function createNote(data: Rec): Promise<string | null> {
    const rec = await createNoteRec(data)
    return rec ? str(rec as Rec, 'id') : null
  }
  async function createCollection(data: Rec) {
    await createCollRec(data)
    void collQuery.refresh()
    setNewColl(false)
  }

  const openNote = cachedOpenNote || linkedNoteQuery.record
  const drafts = (draftsQuery.records as Rec[]) || []

  function applyLocation(nextRoute: Route, noteId: string | null, historyMode: 'push' | 'replace' = 'push') {
    const path = appPath(nextRoute, noteId)
    window.history[historyMode === 'push' ? 'pushState' : 'replaceState']({}, '', path)
    setRoute(nextRoute)
    setOpenId(nextRoute === 'board' ? noteId : null)
    setDevelopNoteId(nextRoute === 'develop' ? noteId : null)
    setMissingNoteId('')
    setNewColl(false)
  }

  function navigate(nextRoute: Route) {
    applyLocation(nextRoute, null)
  }

  function openNoteById(noteId: string) {
    setCollFilter('all')
    setMissingNoteId('')
    applyLocation('board', noteId)
  }

  function openDevelopment(noteId: string) {
    applyLocation('develop', noteId)
  }

  useEffect(() => {
    const onPopState = () => {
      const next = parseAppLocation(window.location.pathname, window.location.search)
      setRoute(next.route as Route)
      setOpenId(next.route === 'board' ? next.noteId : null)
      setDevelopNoteId(next.route === 'develop' ? next.noteId : null)
      setMissingNoteId('')
      setNewColl(false)
    }
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  useEffect(() => {
    document.title = route === 'board' ? 'Chuck · Mind Palace'
      : route === 'develop' ? 'Chuck · Development'
        : `Chuck · ${route[0].toUpperCase()}${route.slice(1)}`
  }, [route])

  useEffect(() => {
    if (!openId || cachedOpenNote || linkedNoteQuery.isLoading || linkedNoteQuery.record) return
    if (!linkedNoteQuery.error && notesQuery.isLoading) return
    setMissingNoteId(openId)
    setOpenId(null)
    window.history.replaceState({}, '', appPath('board'))
  }, [
    openId,
    cachedOpenNote,
    linkedNoteQuery.error,
    linkedNoteQuery.isLoading,
    linkedNoteQuery.record,
    notesQuery.isLoading,
  ])

  if ((notesQuery.isLoading && !notes.length) || (collQuery.isLoading && !collections.length)) {
    return <ChuckSplash detail="Loading the thoughts, links, and scraps you kept." />
  }

  return (
    <div className="shell">
      <Sidebar
        route={route} onRoute={navigate}
        collections={collections} counts={counts}
        collFilter={collFilter} onPickColl={setCollFilter}
        onNewColl={() => setNewColl(true)}
        email={user?.email || ''}
      />
      {route === 'board' ? (
        <Board
          notes={notes} collections={collections}
          collFilter={collFilter}
          loading={notesQuery.isLoading}
          onOpen={openNoteById} onDevelop={openDevelopment} onCreate={createNote}
        />
      ) : route === 'chat' ? (
        <Chat notes={notes} onOpenNote={openNoteById} />
      ) : route === 'develop' ? (
        <DeveloperStudio
          notes={notes}
          drafts={drafts}
          initialNoteId={developNoteId}
          onClearInitial={() => setDevelopNoteId(null)}
          refreshDrafts={() => draftsQuery.refresh()}
          onOpenProfile={() => navigate('profile')}
        />
      ) : route === 'editorial' ? (
        <Editorial />
      ) : (
        <Profile
          email={user?.email || ''}
          collections={collections}
          onCollectionsChanged={() => collQuery.refresh()}
        />
      )}

      {openNote ? (
        <NoteEditor
          key={openId}
          noteId={openId!}
          note={openNote}
          collections={collections}
          onClose={() => applyLocation('board', null)}
          onDevelop={openDevelopment}
          refresh={() => notesQuery.refresh()}
        />
      ) : null}
      {newColl ? (
        <NewCollectionDialog onClose={() => setNewColl(false)} onCreate={createCollection} />
      ) : null}
      {missingNoteId ? (
        <div className="deep-link-notice ui" role="status">
          <ChuckPet state="failed" size={34} loop={false} />
          <span>That saved note is missing or you no longer have access to it.</span>
          <button onClick={() => setMissingNoteId('')} aria-label="Dismiss missing note message"><X size={15} /></button>
        </div>
      ) : null}
      {curationSetupError ? (
        <div className="deep-link-notice ui" role="alert">
          <ChuckPet state="failed" size={34} loop={false} />
          <span>{curationSetupError}</span>
          <button onClick={() => setCurationSetupError('')} aria-label="Dismiss background filing message"><X size={15} /></button>
        </div>
      ) : null}
    </div>
  )
}

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <AccessGate>
        <App />
      </AccessGate>
    </QueryClientProvider>
  </React.StrictMode>,
)

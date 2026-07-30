import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react'
import { useAgentTask } from 'lemma-sdk/react'
import {
  AlignLeft, ArrowUp, BookOpenText, Check, FileText, History, ListChecks,
  Loader2, LockKeyhole, Mail, Megaphone, MessageSquareText, Paperclip, PenLine,
  Plus, Search, Sparkles, Upload, X,
} from 'lucide-react'
import { ChuckIcon, ChuckPet } from './ChuckPet'
import { lemmaClient } from './lemma-client'
import {
  DEVELOPER_STYLES, DEVELOPMENT_TEMPLATES, developerStyleLabel,
  developmentTemplate, normalizeDeveloperStyle, OUTPUT_TYPES,
  type DeveloperStyle, type DevelopmentTemplate, type OutputType, type Rec, snippet, str,
} from './lib'
import { readDraft, useDeveloperReferences, writeDraft } from './developer-files'
import { RichText } from './RichText'

function parsePaths(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String)
  if (typeof value !== 'string' || !value.trim()) return []
  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed.map(String) : []
  } catch {
    return []
  }
}

function outputLabel(value: string) {
  return OUTPUT_TYPES.find((output) => output.slug === value)?.label || 'Draft'
}

function noteLabel(note: Rec) {
  return str(note, 'title') || snippet(str(note, 'body'), 54) || 'Untitled thought'
}

function isOutputType(value: string): value is OutputType {
  return OUTPUT_TYPES.some((output) => output.slug === value)
}

function isDevelopmentTemplate(value: string): value is DevelopmentTemplate {
  return DEVELOPMENT_TEMPLATES.some((template) => template.slug === value)
}

function templateFromLegacyOutput(value: string): DevelopmentTemplate | '' {
  return isDevelopmentTemplate(value) && value !== 'summary' ? value : ''
}

function TemplateIcon({ value }: { value: DevelopmentTemplate }) {
  if (value === 'email') return <Mail size={15} />
  if (value === 'task_list') return <ListChecks size={15} />
  if (value === 'social_post') return <Megaphone size={15} />
  if (value === 'essay') return <BookOpenText size={15} />
  if (value === 'plan') return <AlignLeft size={15} />
  if (value === 'summary') return <FileText size={15} />
  if (value === 'explainer') return <Sparkles size={15} />
  return <MessageSquareText size={15} />
}

export function DeveloperStudio({
  notes,
  drafts,
  initialNoteId,
  onClearInitial,
  refreshDrafts,
  onOpenProfile,
}: {
  notes: Rec[]
  drafts: Rec[]
  initialNoteId: string | null
  onClearInitial: () => void
  refreshDrafts: () => void
  onOpenProfile: () => void
}) {
  const [sourceNoteId, setSourceNoteId] = useState(initialNoteId || '')
  const [selectedDraftId, setSelectedDraftId] = useState('')
  const [selectedTemplate, setSelectedTemplate] = useState<DevelopmentTemplate | ''>('')
  const [style, setStyle] = useState<DeveloperStyle>('none')
  const [instruction, setInstruction] = useState('')
  const [selectedReferences, setSelectedReferences] = useState<string[]>([])
  const [draftContent, setDraftContent] = useState('')
  const [contentLoading, setContentLoading] = useState(false)
  const [runError, setRunError] = useState('')
  const [agentNotice, setAgentNotice] = useState('')
  const [lastPrompt, setLastPrompt] = useState('')
  const [activePicker, setActivePicker] = useState<'thought' | 'style' | null>(null)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [noteQuery, setNoteQuery] = useState('')
  const activeDraftId = useRef('')
  const referenceInput = useRef<HTMLInputElement>(null)
  const {
    references, loading: referencesLoading, uploading, error: referenceError, upload,
  } = useDeveloperReferences()
  const task = useAgentTask({
    client: lemmaClient,
    agentName: 'developer',
    parseOutput: false,
    onError: () => setRunError('Developer stopped before finishing. Your saved thought is unchanged.'),
  })

  const settledNotes = useMemo(
    () => notes
      .filter((note) => str(note, 'status') === 'filed' || str(note, 'status') === 'failed')
      .sort((a, b) => str(b, 'created_at').localeCompare(str(a, 'created_at'))),
    [notes],
  )
  const filteredNotes = useMemo(() => {
    const query = noteQuery.trim().toLowerCase()
    if (!query) return settledNotes
    return settledNotes.filter((note) =>
      `${noteLabel(note)} ${str(note, 'body')}`.toLowerCase().includes(query),
    )
  }, [noteQuery, settledNotes])
  const recentDrafts = useMemo(
    () => [...drafts].sort((a, b) =>
      (str(b, 'updated_at') || str(b, 'created_at'))
        .localeCompare(str(a, 'updated_at') || str(a, 'created_at')),
    ),
    [drafts],
  )
  const sourceNote = notes.find((note) => str(note, 'id') === sourceNoteId) || null
  const selectedDraft = drafts.find((draft) => str(draft, 'id') === selectedDraftId) || null

  useEffect(() => {
    if (!initialNoteId) return
    startNew(initialNoteId)
    onClearInitial()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialNoteId, onClearInitial])

  useEffect(() => {
    const path = str(selectedDraft, 'content_path')
    if (!selectedDraft || !path || str(selectedDraft, 'status') !== 'ready') {
      setDraftContent('')
      return
    }
    let active = true
    setContentLoading(true)
    readDraft(path)
      .then((text) => { if (active) setDraftContent(text) })
      .catch(() => { if (active) setRunError('The draft exists, but its document could not be opened.') })
      .finally(() => { if (active) setContentLoading(false) })
    return () => { active = false }
  }, [
    selectedDraftId,
    str(selectedDraft, 'content_path'),
    str(selectedDraft, 'updated_at'),
    str(selectedDraft, 'status'),
  ])

  useEffect(() => {
    if (!activeDraftId.current || !task.isDone) return
    const notice = (task.outputText || task.streamingText || '').trim()
    setAgentNotice(notice || 'Draft ready.')
    setRunError('')
    refreshDrafts()
    activeDraftId.current = ''
    task.reset()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [task.isDone])

  useEffect(() => {
    if (!task.error || !activeDraftId.current) return
    const id = activeDraftId.current
    activeDraftId.current = ''
    void lemmaClient.records.update('drafts', id, { status: 'failed' }).finally(refreshDrafts)
  }, [task.error, refreshDrafts])

  function startNew(noteId = '') {
    setSourceNoteId(noteId)
    setSelectedDraftId('')
    setSelectedTemplate('')
    setStyle('none')
    setInstruction('')
    setSelectedReferences([])
    setDraftContent('')
    setRunError('')
    setAgentNotice('')
    setLastPrompt('')
    setActivePicker(null)
    setHistoryOpen(false)
  }

  function chooseSource(id: string) {
    setSourceNoteId(id)
    setSelectedDraftId('')
    setDraftContent('')
    setRunError('')
    setAgentNotice('')
    setLastPrompt('')
    setActivePicker(null)
    setHistoryOpen(false)
  }

  function openDraft(draft: Rec) {
    const draftOutput = str(draft, 'output_type')
    const draftTemplate = str(draft, 'template')
    setSelectedDraftId(str(draft, 'id'))
    setSourceNoteId(str(draft, 'source_note_id'))
    setSelectedTemplate(
      isDevelopmentTemplate(draftTemplate)
        ? draftTemplate
        : templateFromLegacyOutput(draftOutput),
    )
    setStyle(normalizeDeveloperStyle(str(draft, 'style') || 'none'))
    setSelectedReferences(parsePaths(draft.reference_paths))
    setInstruction('')
    setLastPrompt(str(draft, 'instruction'))
    setRunError('')
    setAgentNotice('')
    setActivePicker(null)
    setHistoryOpen(false)
  }

  function toggleReference(path: string) {
    setSelectedReferences((current) =>
      current.includes(path) ? current.filter((item) => item !== path) : [...current, path],
    )
  }

  async function pickReference(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    const uploaded = await upload(file)
    if (!uploaded) return
    const files = await lemmaClient.files.list({ directoryPath: '/me/developer/references', limit: 100 })
    const match = files.items.find((item) => item.name === file.name)
    if (match) setSelectedReferences((current) => [...new Set([...current, match.path])])
  }

  async function createDraft() {
    const template = developmentTemplate(selectedTemplate)
    const prompt = instruction.trim()
      || (sourceNote && template ? template.fallbackInstruction : '')
    if (!prompt || task.isRunning) return
    if (style === 'my_writing' && !selectedReferences.length) {
      setRunError('Attach at least one writing sample to use My writing.')
      return
    }

    const resolvedOutput: OutputType = template?.outputType || 'custom'
    const label = template?.label || 'Draft'
    const sourceTitle = sourceNote ? noteLabel(sourceNote) : snippet(prompt, 54)
    const data: Record<string, unknown> = {
      title: `${sourceTitle || 'Raw thought'} — ${label}`,
      output_type: resolvedOutput,
      template: selectedTemplate || null,
      style,
      instruction: prompt,
      reference_paths: selectedReferences,
      status: 'drafting',
      revision: 0,
    }
    if (sourceNote) data.source_note_id = sourceNoteId
    else data.source_text = prompt

    setRunError('')
    setAgentNotice('')
    setLastPrompt(prompt)
    setInstruction('')

    const created = await lemmaClient.records.create('drafts', data) as Rec
    const id = str(created, 'id')
    if (!id) {
      setRunError('The draft could not be started. Nothing was saved to Mind Palace.')
      return
    }

    activeDraftId.current = id
    setSelectedDraftId(id)
    refreshDrafts()
    await task.run({
      action: 'create',
      draft_id: id,
      source_note_id: sourceNoteId || null,
      source_text: sourceNote ? null : prompt,
      template: selectedTemplate || null,
      output_type: resolvedOutput,
      style,
      reference_paths: selectedReferences,
      instruction: prompt,
    })
  }

  async function reviseDraft() {
    const template = developmentTemplate(selectedTemplate)
    const prompt = instruction.trim()
      || (selectedDraft && template ? template.fallbackInstruction : '')
    if (!selectedDraft || !prompt || task.isRunning) return
    if (style === 'my_writing' && !selectedReferences.length) {
      setRunError('Attach at least one writing sample to use My writing.')
      return
    }

    const id = str(selectedDraft, 'id')
    const resolvedOutput: OutputType = template?.outputType
      || (isOutputType(str(selectedDraft, 'output_type'))
        ? str(selectedDraft, 'output_type') as OutputType
        : 'custom')
    setRunError('')
    setAgentNotice('')
    setLastPrompt(prompt)
    setInstruction('')
    activeDraftId.current = id
    await lemmaClient.records.update('drafts', id, {
      status: 'drafting',
      instruction: prompt,
      output_type: resolvedOutput,
      template: selectedTemplate || null,
      style,
      reference_paths: selectedReferences,
    })
    refreshDrafts()
    await task.run({
      action: 'revise',
      draft_id: id,
      source_note_id: str(selectedDraft, 'source_note_id') || null,
      source_text: str(selectedDraft, 'source_text') || null,
      template: selectedTemplate || null,
      output_type: resolvedOutput,
      style,
      reference_paths: selectedReferences,
      instruction: prompt,
    })
  }

  async function sendMessage() {
    if (selectedDraftId) await reviseDraft()
    else await createDraft()
  }

  async function commitContent(markdown: string) {
    if (!selectedDraft || markdown === draftContent) return
    const path = str(selectedDraft, 'content_path')
    if (!path) return
    await writeDraft(path, markdown)
    await lemmaClient.records.update('drafts', str(selectedDraft, 'id'), {
      excerpt: snippet(markdown, 900),
      revision: Number(selectedDraft.revision || 0) + 1,
    })
    setDraftContent(markdown)
    refreshDrafts()
  }

  const busy = task.isRunning || str(selectedDraft, 'status') === 'drafting'
  const canSend = Boolean(
    instruction.trim()
      || ((sourceNote || selectedDraft) && developmentTemplate(selectedTemplate)),
  )
    && !busy
    && (style !== 'my_writing' || selectedReferences.length > 0)
  const rawSource = str(selectedDraft, 'source_text')
  const promptShown = lastPrompt || str(selectedDraft, 'instruction')
  const selectedTemplateInfo = developmentTemplate(selectedTemplate)

  const composeSurface = (
    <div className={`develop-compose-wrap${selectedDraftId ? '' : ' hero'}`}>
      {activePicker === 'thought' ? (
        <div className="develop-picker-panel thought-picker">
          <div className="develop-popover-head">
            <div>
              <b>Select a thought</b>
              <small>Optional. Without one, your message becomes the source.</small>
            </div>
            <button onClick={() => setActivePicker(null)} aria-label="Close thought picker">
              <X size={15} />
            </button>
          </div>
          <section className="develop-context-section">
            <div className="develop-thought-search">
              <Search size={14} />
              <input
                value={noteQuery}
                onChange={(event) => setNoteQuery(event.target.value)}
                placeholder="Search Mind Palace"
                aria-label="Search Mind Palace"
              />
            </div>
            <div className="develop-thought-list">
              <button
                className={!sourceNoteId ? 'on' : ''}
                onClick={() => chooseSource('')}
              >
                <span>
                  <b>Use only my message</b>
                  <small>Nothing new is saved to Mind Palace.</small>
                </span>
                {!sourceNoteId ? <Check size={14} /> : null}
              </button>
              {filteredNotes.map((note) => (
                <button
                  key={str(note, 'id')}
                  className={sourceNoteId === str(note, 'id') ? 'on' : ''}
                  onClick={() => chooseSource(str(note, 'id'))}
                >
                  <span>
                    <b>{noteLabel(note)}</b>
                    <small>{snippet(str(note, 'body'), 72)}</small>
                  </span>
                  {sourceNoteId === str(note, 'id') ? <Check size={14} /> : null}
                </button>
              ))}
            </div>
          </section>
        </div>
      ) : null}

      {activePicker === 'style' ? (
        <div className="develop-picker-panel style-picker">
          <div className="develop-popover-head">
            <div>
              <b>Select a style</b>
              <small>Optional. Skip this to follow your message naturally.</small>
            </div>
            <button onClick={() => setActivePicker(null)} aria-label="Close style picker">
              <X size={15} />
            </button>
          </div>
          <section className="develop-context-section">
            <div className="develop-context-heading">
              <span>Voice</span>
              <small>No style applies unless you choose one.</small>
            </div>
            <div className="develop-style-grid ui">
              {DEVELOPER_STYLES.map((option) => (
                <button
                  key={option.slug}
                  className={style === option.slug ? 'on' : ''}
                  onClick={() => setStyle(option.slug)}
                >
                  <span><b>{option.label}</b><small>{option.blurb}</small></span>
                  {style === option.slug ? <Check size={14} /> : null}
                </button>
              ))}
            </div>
          </section>
          <section className="develop-context-section">
            <div className="develop-context-heading">
              <span><Paperclip size={14} /> Style references</span>
              <button
                className="develop-upload-link"
                onClick={() => referenceInput.current?.click()}
                disabled={uploading}
              >
                {uploading ? <Loader2 size={13} className="spin" /> : <Upload size={13} />}
                Upload
              </button>
            </div>
            <input
              ref={referenceInput}
              className="sr-only"
              type="file"
              accept=".pdf,.doc,.docx,.odt,.rtf,.md,.txt,.html,.epub"
              onChange={pickReference}
            />
            {referencesLoading ? <div className="reference-empty ui">Loading references…</div> : null}
            {!referencesLoading ? (
              <div className="develop-reference-list ui">
                {references.map((reference) => (
                  <button
                    key={reference.path}
                    className={selectedReferences.includes(reference.path) ? 'on' : ''}
                    onClick={() => toggleReference(reference.path)}
                  >
                    <Paperclip size={13} />
                    <span>{reference.name}</span>
                    {selectedReferences.includes(reference.path) ? <Check size={13} /> : null}
                  </button>
                ))}
                {!references.length ? (
                  <button onClick={() => referenceInput.current?.click()}>
                    <Upload size={13} /><span>Upload a style sample or guide</span>
                  </button>
                ) : null}
              </div>
            ) : null}
            <button className="develop-manage-link" onClick={onOpenProfile}>
              Manage reference library
            </button>
          </section>
        </div>
      ) : null}

      <div className="develop-composer">
        <textarea
          value={instruction}
          onChange={(event) => { setInstruction(event.target.value); setRunError('') }}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && (event.metaKey || event.ctrlKey) && canSend) {
              event.preventDefault()
              void sendMessage()
            }
          }}
          maxLength={20000}
          rows={selectedDraftId ? 3 : 4}
          placeholder={
            selectedDraftId
              ? 'Describe what should change in this draft…'
              : sourceNote
                ? 'Tell Developer what this thought should become…'
                : 'Describe the result you want, or paste the thought itself…'
          }
          aria-label={selectedDraftId ? 'Revision instruction' : 'Thought or development instruction'}
        />
        <div className="develop-composer-foot ui">
          <div className="develop-attach-actions">
            <button
              className={`develop-attach-button${sourceNote ? ' attached' : ''}${activePicker === 'thought' ? ' on' : ''}`}
              onClick={() => {
                setActivePicker((picker) => picker === 'thought' ? null : 'thought')
                setHistoryOpen(false)
              }}
              aria-label={sourceNote ? `Change thought: ${noteLabel(sourceNote)}` : 'Select thought'}
              aria-expanded={activePicker === 'thought'}
            >
              <Plus size={15} />
              <FileText size={13} />
              <span>{sourceNote ? noteLabel(sourceNote) : 'Thought'}</span>
            </button>
            <button
              className={`develop-attach-button${style !== 'none' || selectedReferences.length ? ' attached' : ''}${activePicker === 'style' ? ' on' : ''}`}
              onClick={() => {
                setActivePicker((picker) => picker === 'style' ? null : 'style')
                setHistoryOpen(false)
              }}
              aria-label="Select style"
              aria-expanded={activePicker === 'style'}
            >
              <Plus size={15} />
              <Sparkles size={13} />
              <span>
                {style !== 'none'
                  ? developerStyleLabel(style)
                  : selectedReferences.length
                    ? `Style · ${selectedReferences.length}`
                    : 'Style'}
              </span>
            </button>
            <span>{selectedDraftId ? 'Edits this private draft' : 'Text works on its own'}</span>
          </div>
          <button
            className="develop-send"
            disabled={!canSend}
            onClick={() => void sendMessage()}
            aria-label={selectedDraftId ? 'Revise draft' : 'Develop thought'}
          >
            {busy ? <Loader2 size={16} className="spin" /> : <ArrowUp size={16} />}
          </button>
        </div>
      </div>

      {!selectedDraftId ? (
        <div className="develop-template-cues ui" aria-label="Output templates">
          {DEVELOPMENT_TEMPLATES.map((template) => (
            <button
              key={template.slug}
              className={selectedTemplate === template.slug ? 'on' : ''}
              onClick={() => setSelectedTemplate((current) =>
                current === template.slug ? '' : template.slug,
              )}
              title={template.blurb}
            >
              <TemplateIcon value={template.slug} />
              <span>{template.label}</span>
            </button>
          ))}
        </div>
      ) : selectedTemplateInfo ? (
        <div className="develop-compose-template ui">
          <TemplateIcon value={selectedTemplateInfo.slug} />
          {selectedTemplateInfo.label}
        </div>
      ) : null}

      {style === 'my_writing' && !selectedReferences.length ? (
        <div className="develop-compose-hint ui">My writing needs at least one attached sample.</div>
      ) : null}
      {activePicker === 'style' && referenceError ? <div className="inline-error ui">{referenceError}</div> : null}
      {runError ? <div className="inline-error ui" role="alert">{runError}</div> : null}
    </div>
  )

  return (
    <div className="main developer-main">
      <div className={`develop-chat${selectedDraftId ? ' has-draft' : ' is-empty'}`}>
        <header className="develop-topbar">
          <div className="develop-title">
            <span className="section-kicker ui"><ChuckIcon size={16} /> Developer</span>
            <h1>Develop</h1>
            <p>Shape a thought into a separate draft through conversation.</p>
          </div>
          <div className="develop-top-actions ui">
            <span className="private-pill"><LockKeyhole size={12} /> Private</span>
            <button className="ghost develop-new" onClick={() => startNew()}>
              <PenLine size={14} /> New
            </button>
            <div className="develop-history-wrap">
              <button
                className={`ghost develop-history-button${historyOpen ? ' on' : ''}`}
                onClick={() => { setHistoryOpen((open) => !open); setActivePicker(null) }}
                aria-expanded={historyOpen}
              >
                <History size={14} /> History
              </button>
              {historyOpen ? (
                <div className="develop-history-popover">
                  <div className="develop-popover-head">
                    <div><b>Recent drafts</b><small>Continue an earlier development thread.</small></div>
                    <button onClick={() => setHistoryOpen(false)} aria-label="Close history"><X size={15} /></button>
                  </div>
                  <div className="develop-history-list">
                    {recentDrafts.map((draft) => {
                      const source = notes.find((note) => str(note, 'id') === str(draft, 'source_note_id'))
                      return (
                        <button
                          key={str(draft, 'id')}
                          className={selectedDraftId === str(draft, 'id') ? 'on' : ''}
                          onClick={() => openDraft(draft)}
                        >
                          <span>
                            <b>
                              {str(draft, 'title')
                                || developmentTemplate(str(draft, 'template'))?.label
                                || outputLabel(str(draft, 'output_type'))}
                            </b>
                            <small>
                              {source ? noteLabel(source) : snippet(str(draft, 'source_text'), 58) || 'Raw thought'}
                            </small>
                          </span>
                          <em>r{Number(draft.revision || 0)}</em>
                        </button>
                      )
                    })}
                    {!recentDrafts.length ? <p>No developed drafts yet.</p> : null}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </header>

        <main className="develop-thread-scroll">
          <div className="develop-thread">
            {!selectedDraftId ? (
              <div className="develop-welcome">
                <span className="develop-mark"><Sparkles size={22} /></span>
                <h2>What are we shaping today?</h2>
                <p>
                  Start with your message. Add a saved thought or a style only when
                  either one helps.
                </p>
                {composeSurface}
              </div>
            ) : null}

            {(sourceNote || (selectedDraftId && rawSource)) ? (
              <div className="develop-source-card">
                <span className="develop-source-icon"><FileText size={15} /></span>
                <span>
                  <small>{sourceNote ? 'Saved thought · read only' : 'Raw input · not saved to Mind Palace'}</small>
                  <b>{sourceNote ? noteLabel(sourceNote) : snippet(rawSource, 82)}</b>
                  {sourceNote ? <p>{snippet(str(sourceNote, 'body'), 180)}</p> : null}
                </span>
              </div>
            ) : null}

            {selectedDraftId && promptShown ? (
              <div className="develop-message user">
                <div className="develop-message-label ui">You</div>
                <p>{promptShown}</p>
              </div>
            ) : null}

            {selectedDraftId ? (
              <div className="develop-message assistant">
                <div className="develop-message-label ui"><ChuckIcon size={15} /> Developer</div>
                {busy || !selectedDraft ? (
                  <div className="develop-working">
                    <ChuckPet state="running" size={58} />
                    <div>
                      <h2>Developing the draft</h2>
                      <p className="ui">{task.activity || 'Reading the context and shaping a separate document…'}</p>
                    </div>
                  </div>
                ) : contentLoading ? (
                  <div className="reference-empty pet-inline-state ui">
                    <ChuckPet state="review" size={36} />
                    <span>Opening draft…</span>
                  </div>
                ) : str(selectedDraft, 'status') === 'failed' ? (
                  <div className="develop-failed">
                    <ChuckPet state="failed" size={48} loop={false} />
                    <div>
                      <h2>This run stopped</h2>
                      <p>Your source is untouched. Send another message to try again.</p>
                    </div>
                  </div>
                ) : (
                  <div className="draft-paper">
                    <input
                      className="draft-title"
                      key={`${str(selectedDraft, 'id')}:${str(selectedDraft, 'title')}`}
                      defaultValue={str(selectedDraft, 'title')}
                      onBlur={(event) => {
                        const title = event.target.value.trim()
                        if (title && title !== str(selectedDraft, 'title')) {
                          void lemmaClient.records.update('drafts', str(selectedDraft, 'id'), { title }).then(refreshDrafts)
                        }
                      }}
                      aria-label="Draft title"
                    />
                    <RichText
                      key={`${str(selectedDraft, 'id')}:${str(selectedDraft, 'updated_at')}:${draftContent.length}`}
                      value={draftContent}
                      placeholder="Your draft will appear here…"
                      onCommit={(markdown) => void commitContent(markdown)}
                    />
                  </div>
                )}
                {agentNotice ? (
                  <div className="agent-notice ui" role="status">
                    <ChuckPet state="waving" size={28} loop={false} />
                    {agentNotice}
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        </main>

        {selectedDraftId ? (
          <footer className="develop-compose-zone">
            {composeSurface}
          </footer>
        ) : null}
      </div>
    </div>
  )
}

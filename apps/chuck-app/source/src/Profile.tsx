import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import {
  Check, FileText, Loader2, LogOut, Pencil, Plus, Trash2, Upload,
} from 'lucide-react'
import { lemmaClient } from './lemma-client'
import {
  DEVELOPER_STYLES, normalizeDeveloperStyle, Rec, str,
} from './lib'
import { useDeveloperReferences } from './developer-files'
import { NewCollectionDialog } from './NewCollectionDialog'

const DEFAULTS: Rec = {
  default_voice: 'clear_direct',
  developer_style: 'none',
  chat_tone: 'spice',
  tag_density: 'normal',
  autofile_confidence: 'balanced',
}

type ProfileSection = 'account' | 'chuck' | 'developer' | 'collections'

const PROFILE_SECTIONS: { id: ProfileSection; label: string }[] = [
  { id: 'account', label: 'Account' },
  { id: 'chuck', label: 'Chuck' },
  { id: 'developer', label: 'Writing' },
  { id: 'collections', label: 'Collections' },
]

function initialSection(): ProfileSection {
  const match = window.location.hash.match(/^#profile-(account|chuck|developer|collections)$/)
  return (match?.[1] as ProfileSection | undefined) || 'account'
}

function Seg({ label, value, options, onPick }: {
  label: string
  value: string
  options: { v: string; label: string; hint?: string }[]
  onPick: (v: string) => void
}) {
  return (
    <div className="pref-row">
      <div className="pref-label">{label}</div>
      <div className="seg">
        {options.map((option) => (
          <button
            key={option.v}
            className={`seg-btn${value === option.v ? ' on' : ''}`}
            title={option.hint}
            onClick={() => onPick(option.v)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  )
}

function readableBytes(value?: number) {
  if (!value) return ''
  if (value < 1024 * 1024) return `${Math.max(1, Math.round(value / 1024))} KB`
  return `${(value / (1024 * 1024)).toFixed(1)} MB`
}

export function Profile({
  email,
  collections,
  onCollectionsChanged,
}: {
  email: string
  collections: Rec[]
  onCollectionsChanged: () => void
}) {
  const [prefs, setPrefs] = useState<Rec>(DEFAULTS)
  const prefId = useRef<string | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)
  const [editColl, setEditColl] = useState<Rec | null>(null)
  const [newColl, setNewColl] = useState(false)
  const [section, setSection] = useState<ProfileSection>(initialSection)
  const [signingOut, setSigningOut] = useState(false)
  const [signOutError, setSignOutError] = useState('')
  const {
    references, loading: referencesLoading, uploading, error: referenceError, upload, remove,
  } = useDeveloperReferences()

  useEffect(() => {
    ;(async () => {
      try {
        const rows = (await lemmaClient.records.list('preferences', { limit: 1 })).items as Rec[]
        if (rows.length) {
          prefId.current = str(rows[0], 'id')
          setPrefs({ ...DEFAULTS, ...rows[0] })
        } else {
          const record = await lemmaClient.records.create('preferences', DEFAULTS)
          prefId.current = str(record as Rec, 'id')
          setPrefs(record as Rec)
        }
      } catch {
        // The page remains useful with local defaults if preferences are unavailable.
      }
    })()
  }, [])

  async function setPref(field: string, value: string) {
    setPrefs((current) => ({ ...current, [field]: value }))
    if (!prefId.current) return
    try { await lemmaClient.records.update('preferences', prefId.current, { [field]: value }) } catch { /* keep optimistic selection */ }
  }

  async function pickReference(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (file) await upload(file)
  }

  async function saveCollection(data: Rec) {
    if (editColl) {
      try { await lemmaClient.records.update('collections', str(editColl, 'id'), data) } catch { /* */ }
    } else {
      try { await lemmaClient.records.create('collections', data) } catch { /* */ }
    }
    setEditColl(null)
    setNewColl(false)
    onCollectionsChanged()
  }

  async function deleteCollection(id: string) {
    if (!confirm('Delete this collection? Notes in it become Unsorted.')) return
    try { await lemmaClient.records.delete('collections', id) } catch { /* */ }
    onCollectionsChanged()
  }

  async function signOut() {
    setSigningOut(true)
    setSignOutError('')
    try {
      await lemmaClient.auth.redirectToFederatedLogout()
    } catch {
      setSignOutError('Could not sign out. Please try again.')
      setSigningOut(false)
    }
  }

  const selectedStyle = normalizeDeveloperStyle(
    str(prefs, 'developer_style') || str(prefs, 'default_voice'),
  )
  const accountInitial = email.trim().charAt(0).toUpperCase() || 'P'

  function pickSection(next: ProfileSection) {
    setSection(next)
    window.history.replaceState(
      {},
      '',
      `${window.location.pathname}${window.location.search}#profile-${next}`,
    )
  }

  return (
    <div className="main">
      <div className="scroll">
        <div className="wrap profile-wrap">
          <div className="hero-head">
            <div>
              <div className="hero-title">Settings</div>
            </div>
          </div>

          <nav className="profile-map ui" aria-label="Settings sections" role="tablist">
            {PROFILE_SECTIONS.map((item) => (
              <button
                key={item.id}
                id={`profile-tab-${item.id}`}
                className={section === item.id ? 'active' : ''}
                role="tab"
                aria-selected={section === item.id}
                aria-controls={`profile-${item.id}`}
                onClick={() => pickSection(item.id)}
              >
                {item.label}
              </button>
            ))}
          </nav>

          {section === 'account' ? (
            <section
              className="psection account-section"
              id="profile-account"
              role="tabpanel"
              aria-labelledby="profile-tab-account"
            >
              <div className="account-card">
                <div className="account-avatar" aria-hidden="true">{accountInitial}</div>
                <div className="account-identity ui">
                  <span>Signed in as</span>
                  <b>{email || 'Your account'}</b>
                </div>
                <button
                  className="account-logout ui"
                  onClick={() => { void signOut() }}
                  disabled={signingOut}
                >
                  {signingOut
                    ? <><Loader2 size={14} className="spin" /> Signing out…</>
                    : <><LogOut size={14} /> Log out</>}
                </button>
              </div>
              {signOutError ? <div className="account-error ui" role="alert">{signOutError}</div> : null}
            </section>
          ) : null}

          {section === 'chuck' ? (
            <section
              className="psection"
              id="profile-chuck"
              role="tabpanel"
              aria-labelledby="profile-tab-chuck"
            >
              <h2 className="ph2">Chuck</h2>
              <p className="psub">Choose how everyday notes are handled.</p>
              <div className="settings-group">
                <Seg
                  label="Tone"
                  value={str(prefs, 'chat_tone') || 'spice'}
                  options={[
                    { v: 'spice', label: 'Spice', hint: 'dry and a little cheeky' },
                    { v: 'plain', label: 'Plain', hint: 'straight and warm' },
                  ]}
                  onPick={(value) => setPref('chat_tone', value)}
                />
                <Seg
                  label="Tags"
                  value={str(prefs, 'tag_density') || 'normal'}
                  options={[{ v: 'minimal', label: 'Minimal' }, { v: 'normal', label: 'Normal' }]}
                  onPick={(value) => setPref('tag_density', value)}
                />
                <Seg
                  label="Auto-file"
                  value={str(prefs, 'autofile_confidence') || 'balanced'}
                  options={[
                    { v: 'cautious', label: 'Cautious', hint: 'only strong matches' },
                    { v: 'balanced', label: 'Balanced' },
                    { v: 'eager', label: 'Eager', hint: 'file readily' },
                  ]}
                  onPick={(value) => setPref('autofile_confidence', value)}
                />
              </div>
            </section>
          ) : null}

          {section === 'developer' ? (
            <section
              className="psection developer-profile"
              id="profile-developer"
              role="tabpanel"
              aria-labelledby="profile-tab-developer"
            >
              <h2 className="ph2">Writing</h2>
              <p className="psub">Set a default style and add examples for Development.</p>

              <div className="profile-subsection first">
                <div>
                  <h3>Default style</h3>
                  <p>You can change it for any draft.</p>
                </div>
                <div className="style-grid">
                  {DEVELOPER_STYLES.map((style) => (
                    <button
                      key={style.slug}
                      className={`style-choice${selectedStyle === style.slug ? ' on' : ''}`}
                      onClick={() => setPref('developer_style', style.slug)}
                    >
                      <span>{style.label}</span>
                      <small>{style.blurb}</small>
                      {selectedStyle === style.slug ? <Check size={15} /> : null}
                    </button>
                  ))}
                </div>
              </div>

              <div className="profile-subsection reference-section">
                <div className="reference-head">
                  <div>
                    <h3>Writing references</h3>
                    <p>Examples Chuck may learn from in Development only.</p>
                  </div>
                  <button className="ghost" onClick={() => fileInput.current?.click()} disabled={uploading}>
                    {uploading ? <Loader2 size={14} className="spin" /> : <Upload size={14} />}
                    {uploading ? 'Uploading…' : 'Add'}
                  </button>
                  <input
                    ref={fileInput}
                    className="sr-only"
                    type="file"
                    accept=".pdf,.doc,.docx,.odt,.rtf,.md,.txt,.html,.epub"
                    onChange={pickReference}
                  />
                </div>

                {referencesLoading ? <div className="reference-empty ui">Loading references…</div> : null}
                {!referencesLoading && !references.length ? (
                  <button className="upload-empty compact" onClick={() => fileInput.current?.click()}>
                    <span className="upload-icon"><Upload size={18} /></span>
                    <span>
                      <b>Add a writing sample</b>
                      <small>PDF, Word, Markdown, or plain text.</small>
                    </span>
                  </button>
                ) : null}
                {references.length ? (
                  <div className="reference-list">
                    {references.map((reference) => (
                      <div className="reference-item ui" key={reference.path}>
                        <span className="reference-icon"><FileText size={16} /></span>
                        <span className="reference-main">
                          <b>{reference.name}</b>
                          <small>
                            {readableBytes(reference.size_bytes)}
                            {reference.status ? `${reference.size_bytes ? ' · ' : ''}${reference.status.toLowerCase()}` : ''}
                          </small>
                        </span>
                        <button
                          className="icon-ghost danger"
                          onClick={() => { if (confirm(`Remove ${reference.name}?`)) void remove(reference.path) }}
                          aria-label={`Remove ${reference.name}`}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : null}
                {referenceError ? <div className="inline-error ui" role="alert">{referenceError}</div> : null}
              </div>
            </section>
          ) : null}

          {section === 'collections' ? (
            <section
              className="psection"
              id="profile-collections"
              role="tabpanel"
              aria-labelledby="profile-tab-collections"
            >
              <div className="psection-head">
                <div>
                  <h2 className="ph2">Collections</h2>
                  <p className="psub">Define where Chuck should file matching notes.</p>
                </div>
                <button className="ghost" onClick={() => setNewColl(true)}><Plus size={14} /> New</button>
              </div>
              <div className="coll-list">
                {collections.map((collection) => (
                  <div className="coll-item" key={str(collection, 'id')}>
                    <span className="coll-item-emoji">{str(collection, 'emoji') || '•'}</span>
                    <div className="coll-item-main">
                      <div className="coll-item-name">{str(collection, 'name')}</div>
                      <div className="coll-item-rule">
                        {str(collection, 'rule') || <span className="muted">No filing rule yet.</span>}
                      </div>
                    </div>
                    <button className="icon-ghost" onClick={() => setEditColl(collection)} aria-label="Edit collection">
                      <Pencil size={14} />
                    </button>
                    <button className="icon-ghost danger" onClick={() => deleteCollection(str(collection, 'id'))} aria-label="Delete collection">
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
                {!collections.length ? <div className="empty">No collections yet. Create one with a name and a one-line rule.</div> : null}
              </div>
            </section>
          ) : null}
        </div>
      </div>

      {(newColl || editColl) ? (
        <NewCollectionDialog
          initial={editColl || undefined}
          onClose={() => { setNewColl(false); setEditColl(null) }}
          onCreate={saveCollection}
        />
      ) : null}
    </div>
  )
}

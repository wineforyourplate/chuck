import { useState } from 'react'
import { X } from 'lucide-react'
import { Rec } from './lib'

const EMOJI = ['📣', '📦', '✍️', '💡', '🎯', '🧠', '💰', '🔧', '📈', '🎨', '📚', '🌱']

export function NewCollectionDialog({
  onClose, onCreate, initial,
}: {
  onClose: () => void
  onCreate: (data: Rec) => void | Promise<void>
  initial?: Rec
}) {
  const [name, setName] = useState(initial ? String(initial['name'] || '') : '')
  const [emoji, setEmoji] = useState(initial ? String(initial['emoji'] || '📣') : '📣')
  const [rule, setRule] = useState(initial ? String(initial['rule'] || '') : '')
  const [saving, setSaving] = useState(false)

  async function save() {
    if (!name.trim() || saving) return
    setSaving(true)
    await onCreate({ name: name.trim(), emoji, rule: rule.trim() })
    setSaving(false)
  }

  return (
    <div className="dialog-scrim" onClick={onClose}>
      <div className="dialog ui" onClick={(e) => e.stopPropagation()}>
        <div className="dialog-head">
          <h3>{initial ? 'Edit collection' : 'New collection'}</h3>
          <button className="x-btn" onClick={onClose}><X size={18} /></button>
        </div>

        <label className="field-label">Name</label>
        <input className="field" value={name} placeholder="Marketing" autoFocus
          onChange={(e) => setName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') save() }} />

        <label className="field-label">Icon</label>
        <div className="emoji-row">
          {EMOJI.map((e) => (
            <button key={e} className={`emoji-pick${emoji === e ? ' on' : ''}`} onClick={() => setEmoji(e)}>{e}</button>
          ))}
        </div>

        <label className="field-label">Rule — what goes in here?</label>
        <textarea className="field area" value={rule} rows={2}
          placeholder="Research, references, and ideas for the current project."
          onChange={(e) => setRule(e.target.value)} />
        <div className="field-hint">Chuck files a saved note here when it matches this rule — otherwise it stays Unsorted. One clear line works best.</div>

        <div className="dialog-actions">
          <button className="ghost" onClick={onClose}>Cancel</button>
          <button className="primary" onClick={save} disabled={!name.trim() || saving}>{initial ? 'Save' : 'Create'}</button>
        </div>
      </div>
    </div>
  )
}

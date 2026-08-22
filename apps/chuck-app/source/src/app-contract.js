export const APP_ROUTES = ['board', 'chat', 'develop', 'editorial', 'profile']
export const CITATION_PROTOCOL = '[[CHUCK_APP_CITATIONS_V1]]'
export const CURATION_SCHEDULE_PREFIX = 'curate-on-save'

const EVIDENCE_RE = /<!--\s*chuck-evidence\s*:\s*([\s\S]*?)-->/i

/**
 * Add the app-only capability marker. Chuck still receives the user's question
 * verbatim and surfaces that do not send this marker continue to get plain text.
 *
 * @param {string} question
 */
export function prepareCitationQuestion(question) {
  return `${CITATION_PROTOCOL}\n${question.trim()}`
}

/**
 * Remove the app-only capability marker before showing a saved question or
 * auto-generated conversation title back to the user.
 *
 * @param {string | null | undefined} value
 */
export function displayCitationQuestion(value) {
  return String(value || '').replace(CITATION_PROTOCOL, '').trim()
}

/**
 * @typedef {'table' | 'file'} EvidenceSource
 * @typedef {{ noteId: string, reason: string, source: EvidenceSource }} NoteEvidence
 * @typedef {{ answer: string, evidence: NoteEvidence[] }} ParsedAgentAnswer
 */

/**
 * Parse and remove Chuck's hidden app evidence envelope. Invalid or invented
 * shapes fail closed: the answer still renders, but no citation is shown.
 *
 * @param {string} raw
 * @returns {ParsedAgentAnswer}
 */
export function parseAgentAnswer(raw) {
  const text = (raw || '').trim()
  const match = text.match(EVIDENCE_RE)
  const answer = text.replace(EVIDENCE_RE, '').trim()
  if (!match) return { answer, evidence: [] }

  try {
    const parsed = JSON.parse(match[1])
    if (!Array.isArray(parsed)) return { answer, evidence: [] }

    /** @type {NoteEvidence[]} */
    const evidence = []
    const seen = new Set()
    for (const item of parsed) {
      if (!item || typeof item !== 'object') continue
      const noteId = String(item.note_id || '').trim()
      if (!noteId || noteId.length > 100 || seen.has(noteId)) continue
      const reason = String(item.reason || 'Supported this answer.').trim().slice(0, 180)
      const source = item.source === 'file' ? 'file' : 'table'
      seen.add(noteId)
      evidence.push({ noteId, reason, source })
      if (evidence.length === 4) break
    }
    return { answer, evidence }
  } catch {
    return { answer, evidence: [] }
  }
}

/**
 * @param {string} pathname
 * @param {string} search
 */
export function parseAppLocation(pathname, search) {
  const segment = pathname.replace(/\/+$/, '').split('/').pop() || 'board'
  const route = APP_ROUTES.includes(segment) ? segment : 'board'
  const noteId = new URLSearchParams(search).get('note')
  return {
    route,
    noteId: noteId && noteId.trim() ? noteId.trim() : null,
  }
}

/**
 * Stable web route contract. A native WebView can observe these history changes
 * and map the same paths to Universal Links or Android App Links later.
 *
 * @param {string} route
 * @param {string | null} [noteId]
 */
export function appPath(route, noteId = null) {
  const safeRoute = APP_ROUTES.includes(route) ? route : 'board'
  const params = new URLSearchParams()
  if (noteId) params.set('note', noteId)
  const query = params.toString()
  return `/${safeRoute}${query ? `?${query}` : ''}`
}

/**
 * Personal schedule names must be unique across the pod, so include the member
 * id. Keep the imported owner's original `curate-on-save` schedule compatible:
 * schedule matching below recognizes it by behavior rather than only by name.
 *
 * @param {string} userId
 */
export function curationScheduleName(userId) {
  const safeUserId = userId.trim().replace(/[^a-zA-Z0-9_-]/g, '-')
  return `${CURATION_SCHEDULE_PREFIX}-${safeUserId}`
}

/**
 * @param {unknown} value
 * @returns {value is Record<string, unknown>}
 */
function isObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

/**
 * Recognize the one safe curator trigger: notes INSERT only. UPDATE must never
 * be accepted here because the curator updates the same row and would loop.
 *
 * @param {unknown} value
 */
export function isCurationSchedule(value) {
  if (!isObject(value) || !isObject(value.config)) return false
  const operations = value.config.operations
  return value.schedule_type === 'DATASTORE'
    && value.agent_name === 'curator'
    && value.config.table_name === 'notes'
    && Array.isArray(operations)
    && operations.length === 1
    && operations[0] === 'INSERT'
    && value.visibility === 'PERSONAL'
}

/**
 * @param {string} userId
 */
export function curationSchedulePayload(userId) {
  return {
    name: curationScheduleName(userId),
    schedule_type: 'DATASTORE',
    config: {
      table_name: 'notes',
      operations: ['INSERT'],
    },
    agent_name: 'curator',
    visibility: 'PERSONAL',
  }
}

import assert from 'node:assert/strict'
import test from 'node:test'
import {
  CITATION_PROTOCOL,
  appPath,
  curationScheduleName,
  curationSchedulePayload,
  displayCitationQuestion,
  isCurationSchedule,
  parseAgentAnswer,
  parseAppLocation,
  prepareCitationQuestion,
} from '../src/app-contract.js'

test('citation request preserves the user question', () => {
  assert.equal(
    prepareCitationQuestion('  Which repo did I save?  '),
    `${CITATION_PROTOCOL}\nWhich repo did I save?`,
  )
})

test('saved citation questions and titles render without the internal marker', () => {
  assert.equal(
    displayCitationQuestion(`${CITATION_PROTOCOL}\nWhich repo did I save?`),
    'Which repo did I save?',
  )
  assert.equal(
    displayCitationQuestion(`${CITATION_PROTOCOL} Which repo did I save?…`),
    'Which repo did I save?…',
  )
})

test('answer parser strips, normalizes, and deduplicates evidence', () => {
  const parsed = parseAgentAnswer(`The repo was Kokoro.

<!-- chuck-evidence:[
  {"note_id":"note-1","reason":"The saved repo note names Kokoro.","source":"table"},
  {"note_id":"note-1","reason":"duplicate","source":"file"},
  {"note_id":"note-2","reason":"The indexed article explains the choice.","source":"file"}
] -->`)

  assert.equal(parsed.answer, 'The repo was Kokoro.')
  assert.deepEqual(parsed.evidence, [
    { noteId: 'note-1', reason: 'The saved repo note names Kokoro.', source: 'table' },
    { noteId: 'note-2', reason: 'The indexed article explains the choice.', source: 'file' },
  ])
})

test('malformed evidence never blocks the answer', () => {
  const parsed = parseAgentAnswer('Still useful.\n<!-- chuck-evidence:not-json -->')
  assert.equal(parsed.answer, 'Still useful.')
  assert.deepEqual(parsed.evidence, [])
})

test('note deep-links survive parsing and browser history paths', () => {
  assert.equal(appPath('board', '019f-note'), '/board?note=019f-note')
  assert.deepEqual(parseAppLocation('/board', '?note=019f-note'), {
    route: 'board',
    noteId: '019f-note',
  })
  assert.deepEqual(parseAppLocation('/chat', ''), {
    route: 'chat',
    noteId: null,
  })
  assert.equal(appPath('unknown', null), '/board')
})

test('curator schedules are personal, user-specific, and INSERT-only', () => {
  const payload = curationSchedulePayload('019f-user')
  assert.equal(curationScheduleName('019f-user'), 'curate-on-save-019f-user')
  assert.equal(payload.name, 'curate-on-save-019f-user')
  assert.equal(isCurationSchedule({ ...payload, is_active: true }), true)
  assert.equal(
    isCurationSchedule({
      ...payload,
      config: { table_name: 'notes', operations: ['INSERT', 'UPDATE'] },
    }),
    false,
  )
  assert.equal(isCurationSchedule({ ...payload, visibility: 'POD' }), false)
})

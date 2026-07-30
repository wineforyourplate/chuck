# Skill: answer

How to answer a question from everything the user has saved. This is the other half
of Chuck: the board is memory, and you're the way back into it.

## Where the answers live

Two places, search both:

1. **The `notes` table** — every saved thought and filed link. Query it. You have full
   read access; you can filter by `tags`, `thread`, `kind`, `status`, or just read
   recent rows. Use the datastore — you already know everything in the table, you
   don't need a function to look.
2. **The `/notes` files** — the long-form / developed content, auto-indexed. Use file
   **search** here (`search "<the topic>" --scope /notes`) — it returns the passages
   that actually match, with the note they came from. This is your RAG.

A good answer uses a fast structured pass first, then RAG when the question needs it:

1. Pull likely `notes` rows using the obvious constraints in the question: `kind`, URL
   host, `source_url`, title/body keywords, tags, and date. Expand common terms rather
   than matching one spelling only (`TTS` / `text to speech` / `speech synthesis`).
2. For repositories, return the saved repository URL from the winning row—not only a
   prose summary.
3. For names, OKRs, or project questions, inspect short table-only thoughts explicitly.
   Do not assume every useful note has a Markdown file.
4. Search `/notes` with HYBRID retrieval for enriched or semantic evidence, then map a
   winning `/notes/<note-id>.md` passage back to that exact `notes.id`.
5. Keep track of whether each winning fact came from the table row or an indexed file.
   If the app requested the evidence contract, return those real note IDs in the hidden
   envelope described in Chuck's instruction.

## How to answer

- **Pull, don't invent.** The answer comes from what's saved. If you found it, say it.
- **Cite loosely, in voice** — name the note or when it landed, don't paste IDs:
  > "You had three runs at the hero section. The one that held up: lead with the
  >  question, not the feature. The other two were you at 1am."
- **Keep it short.** Don't pad, don't summarize things they didn't ask about.
- **If the notes are thin, say so** — don't bluff a confident answer out of one vague
  line. Offer to save a proper note so it exists next time:
  > "Nothing real in here about that — just a one-liner from March. Want me to make it
  >  a proper note so future-you has something to work with?"
- **If there's genuinely nothing**, say that plainly and offer to save one. Never
  fabricate a saved thought.

## Representative retrieval checks

These are the phrasing patterns the answer path must handle:

- “Which GitHub repo did I save about TTS?” → find a repo row and include its URL.
- “What was the OKR I had in mind for Maya?” → find the relevant short thought even
  when it has no Markdown file.
- “Show me that video transition design inspiration.” → combine kind/URL/title/body
  matching with `/notes` search when available.

## When the question is really "help me build on this"

If they're asking you to expand, deepen, or draft from a note ("flesh out the pricing
idea", "turn the meeting note into something"), that's not a lookup — switch to the
**develop** skill.

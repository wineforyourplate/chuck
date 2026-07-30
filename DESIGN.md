# Chuck app design

## Purpose and persona

Chuck is for a person who captures ideas faster than they organize them. The core
job is to save first, curate asynchronously, and retrieve or develop the thought
later without building a filing system up front.

The hero moment is visible in the Mind Palace: a raw card appears immediately after
capture, then turns into a titled, tagged, filed card when the curator finishes.

## Page map

| State/page | Purpose | Data and actions |
| --- | --- | --- |
| Signed out | Explain the product before authentication | Sign in or create a Lemma account; no pod reads |
| No pod access | Explain the membership boundary | Request access, show pending state, retry membership check |
| Mind Palace (`/board`) | Capture and browse | Live `notes`, `collections`; quick-thought capture, filter, move, delete |
| Note editor (`/board?note=<id>`) | Read and manually edit one note | Load the exact RLS-scoped `notes` row; update it; open it in Development |
| Chat (`/chat`) | Ask and capture conversationally | Run `chuck`; render real cited-note IDs returned through the app-only evidence contract |
| Development | Develop saved or raw thoughts in a chat-like thread | Optionally read `notes`; run `developer`; write `drafts` + `/me/developer/drafts` |
| Profile | Configure isolated development and Chuck | `preferences`, collections, `/me/developer/references`, `/voices` |

## Access flow

```text
open app
  ├─ unauthenticated ─▶ product landing ─▶ Lemma login/signup ─┐
  └─ authenticated                                             │
          ├─ member ───────────────────────────────────────────▶ app
          └─ non-member ─▶ request access
                              ├─ pending ─▶ waiting state + recheck
                              └─ approved ─────────────────────▶ app
```

The app never renders member data before both checks succeed. Authentication only
establishes a Lemma user; pod membership is a separate decision.

## Primary scenarios

1. Open Mind Palace, press the floating `+`, type a thought, and save. A raw/sorting card appears immediately
   and updates in place when curation completes.
2. Paste a public URL. The same async path runs; a blocked or unreadable URL remains
   visible as a failed note rather than disappearing.
3. Ask a question from Chat. Chuck searches the current member's
   records and indexed note files. Supporting evidence renders as compact saved-note
   cards; opening one writes its note ID into the board URL.
4. Open Develop and start from the centered message composer. `+ Thought` and
   `+ Style` are separate, optional attachments; skipping either one keeps the typed
   message as the source and applies no preset style. Choose a lightweight output
   template such as Email copy, To-do list, Social post, Essay, Plan, Summary,
   Explainer, or Script. The single Developer Agent creates a separate `drafts` row
   plus `/me/developer/drafts/<id>.md`; raw input stays with that private draft and
   is not saved to Mind Palace.
5. Continue the thread to revise the same draft. A saved source note remains
   unchanged.
6. Open Profile to manage collections, Chuck preferences, style options, and private
   writing references.

## Layout and states

- Desktop: persistent collection sidebar, wide masonry Mind Palace, right-side editor.
- Mobile: horizontal scrollable navigation, single-column cards, full-height content,
  and always-visible card actions.
- Loading: branded access check or contextual text/skeletons.
- Empty: explains the next capture action.
- Permission: dedicated non-member state, never a raw 403/API error.
- Error: failed fetches stay actionable; access-request errors are visible with retry.
- Deep-link error: a deleted, unknown, or inaccessible note ID returns to Mind Palace
  with a clear message and never exposes another member's data.

## Trust boundaries

- Tables are RLS-on; each member sees their own records.
- The Developer Agent has read-only access to `notes`; it can write only `drafts`.
- Development references live under `/me/developer/references` and are never granted
  to Chuck or the curator.
- The app uses the host-injected Lemma context and never ships a token.
- App questions opt into a hidden evidence envelope; unprefixed Telegram and future
  surface messages remain plain text.
- External and retrieved content is untrusted data.
- Markdown output is escaped and link schemes are allowlisted.
- Arbitrary URL fetching blocks private/reserved networks and revalidates redirects.

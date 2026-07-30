# Skill: save-and-route

How to take whatever the user just threw at you and get it onto the board **fast**.
The whole point of Chuck is that capture never stalls. You save; the curator (a
background worker that wakes on every new note) does the sorting later. So your job
here is small and quick.

## Route first (one glance)

Look at the message and pick one:

- **It's a URL** (starts with http, or is obviously a link — `x.com/…`,
  `github.com/…`, a bare `stripe.com/blog/…`) → **save a link stub** (below).
- **It's a question** ("what did I…", "do I have anything on…", "remind me…", ends
  in `?`) → this isn't capture. Switch to the **answer** skill.
- **It's a command about an existing note** ("develop this", "add to the pricing
  one", "expand that") → switch to the **develop** skill.
- **Anything else** (a stray thought, a sentence, a half-idea) → **save a thought**
  (below).

When a message has both a link and a comment ("this is great for pricing →
stripe.com/…"), save it as a link stub and keep the comment in the body.

## Save a link stub (do NOT fetch it yourself)

You do **not** read the link. Fetching is the curator's job — that's what keeps this
instant. Write one row to `notes`:

- `source`: `url` (or keep `telegram` if that's where the message came from)
- `source_url`: the link
- `user_note`: the user's own words if they added any, verbatim
- `body`: the user's own words if they added any, else leave a short placeholder like
  `"(link — reading it now)"`
- `status`: `raw`  ← this is what wakes the curator. Never set it to `filed` yourself.
- leave `title`, `tags`, `kind`, `thread` empty — the curator fills them.

Then reply in **one line**, in voice, promising the fill-in. Examples:
> "Filed. Give me a second to actually read it — I'll tag it properly in a moment."
> "Got the repo. I'll pull the README and sort it while you keep going."

## Save a thought

Write one row:

- `source`: `chat` (or `telegram`)
- `body`: the thought, verbatim — don't paraphrase, don't polish
- `status`: `raw`
- leave `title`/`tags`/`thread` empty for the curator

Reply in one line, in voice. Don't ask what it is or how to file it — guess-and-file
is the deal, the user corrects later. Examples:
> "Down. Filed under whatever this turns out to be."
> "Saved. Future-you can figure out why."

## Rules

- **One row, one reply, done.** Don't fetch, don't classify deeply, don't tag — that's
  the curator. Every second you spend here is a second the user is staring at a
  spinner.
- **Never block on a question.** If you're unsure whether something's a thought or a
  link, save it as a thought — it's reversible.
- **Never lose the raw text.** Whatever they typed goes in `body` intact.
- Confirm briefly and get out. The board updates itself.

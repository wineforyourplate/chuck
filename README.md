<p align="center">
  <img src="./apps/chuck-app/source/src/assets/chuck-icon.webp" alt="Chuck" width="72" />
</p>

<h1 align="center">Chuck</h1>

<p align="center">
  <strong>Your second memory. With none of the filing.</strong>
</p>

<p align="center">
  Throw Chuck a thought, link, repo, or half-formed idea.<br />
  It lands now, organises itself in the background, and comes back when you ask.
</p>

<p align="center">
  <a href="https://lemma.work/import/github/wineforyourplate/chuck">
    <img src="./docs/install-remix-on-lemma.svg" alt="Install and Remix Chuck on Lemma" height="50" />
  </a>
</p>

<p align="center">
  <a href="https://chuck.apps.asur.work">Live app</a>
  ·
  <a href="#see-chuck-in-action">Watch the demo</a>
  ·
  <a href="#how-chuck-works">Explore the pod</a>
  ·
  <a href="#make-chuck-yours">Remix it</a>
</p>

---

## See Chuck in action

<p align="center">
  <a href="./docs/chuck-repo-video.mp4">
    <img src="./docs/chuck-repo-video.webp" alt="Chuck product demo — capture, curate, recall, and develop a thought" width="100%" />
  </a>
</p>

<p align="center">
  <sub>Click the demo to open the full-quality video.</sub>
</p>

## Save first. Sort later.

Most note apps ask you to organise a thought before you have finished having it:
pick a folder, write a title, add tags, decide what it means.

Chuck separates capture from organisation.

1. **Capture instantly.** Your words are saved before your attention moves on.
2. **Curate quietly.** A background agent reads, titles, tags, and files the note.
3. **Ask your memory.** Chuck answers from what you actually kept and points back to it.
4. **Develop deliberately.** Turn a fragment into an email, plan, essay, script, or
   another useful draft without overwriting the source.

## One memory, several ways back in

<table>
  <tr>
    <td width="50%">
      <img src="./docs/screenshots/01-mind-palace.jpg" alt="Chuck Mind Palace" />
      <br /><strong>Mind Palace</strong><br />
      A calm, visual home for thoughts, links, repos, articles, and collections.
    </td>
    <td width="50%">
      <img src="./docs/screenshots/02-chat.jpg" alt="Chuck Chat" />
      <br /><strong>Ask what you already knew</strong><br />
      Recall saved material naturally, with supporting notes you can reopen.
    </td>
  </tr>
  <tr>
    <td width="50%">
      <img src="./docs/screenshots/03-develop.jpg" alt="Chuck Development workspace" />
      <br /><strong>Develop without destroying</strong><br />
      A separate Developer Agent turns a source into a private draft.
    </td>
    <td width="50%">
      <img src="./docs/screenshots/04-personalisation.jpg" alt="Chuck personalisation" />
      <br /><strong>Make it sound and file like you</strong><br />
      Tune tone, tags, filing confidence, styles, references, and collection rules.
    </td>
  </tr>
</table>

## Private before clever

- Notes, collections, preferences, and drafts use row-level security.
- Every member sees only their own records.
- Personal writing references and developed documents live under that member's `/me`.
- The Developer Agent can read a selected source note but cannot change it.
- Agents and functions receive only the named resources they need.
- Pages and uploaded documents are treated as untrusted reference material.
- The public repository contains no personal notes, records, credentials, tokens, or
  connector accounts.

## Install and Remix 🪄

<p>
  <a href="https://lemma.work/import/github/wineforyourplate/chuck">
    <img src="./docs/install-remix-on-lemma.svg" alt="Install and Remix Chuck on Lemma" height="50" />
  </a>
</p>

The button opens Lemma's import flow for this exact repository:

```text
https://lemma.work/import/github/wineforyourplate/chuck
```

After import, run the included bootstrap script once to upload Chuck's public
playbooks and writing styles:

```bash
bash scripts/bootstrap-files.sh --pod <pod-id>
```

Then open `chuck-app`, save one real thought, and watch its raw card settle into a
titled and tagged memory.

<details>
<summary><strong>Install from the command line</strong></summary>

You need an authenticated Lemma CLI, Node.js 20.19+ with npm, and `jq`.

```bash
git clone https://github.com/wineforyourplate/chuck.git
cd chuck

lemma pods create chuck --org <org-id>
lemma --pod <pod-id> pods import . --dry-run

VITE_LEMMA_API_URL="https://api.<your-lemma-host>" \
VITE_LEMMA_AUTH_URL="https://<your-lemma-host>/auth" \
VITE_LEMMA_POD_ID="<pod-id>" \
lemma --pod <pod-id> pods import .

bash scripts/bootstrap-files.sh --pod <pod-id>
lemma --pod <pod-id> apps open chuck-app
```

</details>

### Optional front doors

Connect Telegram in the target organisation and point its surface at the `chuck`
agent. Connector accounts are environment-specific and intentionally do not travel
with a public repository.

New pod members receive their own personal curator schedule when they first open the
app. Add working members with the `USER` role or higher; a read-only `VIEWER` cannot
save thoughts or create automation.

## How Chuck works

```text
you save a thought or link
            │
            ▼
      private notes row ───────────────▶ appears immediately
            │ INSERT
            ▼
   personal curator schedule
            │
            ▼
      Curator Agent ── fetches a public link when present
            │        ── creates title, tags, kind, and collection
            │        ── writes searchable long-form memory
            ▼
       the same card updates
            │
       ┌────┴─────────┐
       ▼              ▼
 ask Chuck      develop a separate draft
```

This repository is the complete Lemma pod, not merely an app screenshot or prompt:

| Layer | What ships |
| --- | --- |
| App | Mind Palace, chat, note editor, collections, settings, and Development workspace |
| Agents | `chuck` for capture/recall, `curator` for background filing, `developer` for deliberate transformation |
| Tables | Private notes, collections, preferences, and drafts |
| Functions | A safe public URL reader and a portable file-bootstrap utility |
| Automation | An INSERT-only personal schedule that wakes the curator without trigger loops |
| Files | Public playbooks and style templates, plus private runtime paths for each member |

The important design choice is simple: **capture stays fast because filing happens
afterward.** The note itself is durable state; the agents are replaceable workers
around it.

## Make Chuck yours

1. [Fork this repository](https://github.com/wineforyourplate/chuck/fork).
2. Change the agent instructions, filing rules, app, tables, or writing styles.
3. Import your fork at
   `https://lemma.work/import/github/<your-github-name>/<your-repo>`.
4. Keep private records, connector accounts, member IDs, and credentials out of Git.

Useful places to start:

- `agents/chuck/instruction.md` — capture and recall behaviour.
- `agents/curator/instruction.md` — background filing behaviour.
- `agents/developer/instruction.md` — transformation and source-safety rules.
- `files/playbook/` — procedures the agents load on demand.
- `files/voices/` — reusable writing styles.
- `apps/chuck-app/source/` — the complete React app.
- `DESIGN.md` — architecture, access states, and trust boundaries.

## Verify your remix

```bash
cd apps/chuck-app/source
npm ci
npm test
npm run build

cd ../../..
lemma --pod <pod-id> pods import . --dry-run
lemma --pod <pod-id> pods doctor chuck
```

For retrieval evaluation against representative notes, see
[`evals/README.md`](./evals/README.md).

## Share Chuck

<p>
  <a href="https://twitter.com/intent/tweet?text=Chuck%3A%20your%20second%20memory%2C%20with%20none%20of%20the%20filing.&amp;url=https%3A%2F%2Fgithub.com%2Fwineforyourplate%2Fchuck">
    <img alt="Share Chuck on X" src="https://img.shields.io/badge/Share_on_X-1B1B19?style=for-the-badge&amp;logo=x" />
  </a>
  <a href="https://www.linkedin.com/sharing/share-offsite/?url=https%3A%2F%2Fgithub.com%2Fwineforyourplate%2Fchuck">
    <img alt="Share Chuck on LinkedIn" src="https://img.shields.io/badge/Share_on_LinkedIn-0A66C2?style=for-the-badge&amp;logo=linkedin" />
  </a>
</p>

---

<p align="center">
  <strong>Save the thought. Chuck handles the filing.</strong>
</p>

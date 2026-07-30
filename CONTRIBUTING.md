# Contributing to Chuck

Chuck is a complete Lemma pod, so a contribution should preserve the whole loop:
capture, background curation, recall, and deliberate development.

## Before opening a pull request

1. Run `npm ci`, `npm test`, and `npm run build` in
   `apps/chuck-app/source`.
2. Validate the pod bundle with `lemma pods import . --dry-run`.
3. Keep the curator schedule INSERT-only; adding UPDATE creates a trigger loop.
4. Check that every agent and function has only the resources it needs.
5. Keep tokens, member IDs, connector accounts, private notes, and uploaded
   documents out of the commit.
6. Describe the user-visible behaviour that changed.

## Product rule

Saving a thought must remain immediate. Filing and enrichment happen afterward,
and deliberate development must never overwrite the source note.

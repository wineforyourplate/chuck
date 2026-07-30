# Chuck repository guide

This repository is a portable Lemma pod bundle.

- Preserve row-level security on all personal tables.
- Keep `curate-on-save` and all per-member variants INSERT-only.
- Keep source notes read-only to the Developer Agent.
- Never commit `.env.local`, tokens, connector accounts, member identifiers,
  private records, or personal file contents.
- When app source changes, run `npm test` and `npm run build` under
  `apps/chuck-app/source`.
- Before release, run `lemma pods import . --dry-run` from the repository root.
- Public playbook and voice file contents must remain listed in
  `scripts/bootstrap-files.sh`.

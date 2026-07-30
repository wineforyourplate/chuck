# Chuck retrieval evaluation

This evaluation protects the combined retrieval contract:

1. inspect structured `notes` rows first;
2. search `/notes` with Lemma's built-in RAG for enriched material;
3. return the winning real note IDs and whether the table row or indexed file supplied
   the evidence;
4. keep short thoughts searchable without mirroring every row into Markdown.

The cases in `retrieval-cases.json` use the real phrasing from the next-phase plan.
They intentionally do not ship fake expected note IDs or personal seed records.

Run against a pod whose current member has representative notes:

```bash
LEMMA_SERVER=asur bash scripts/run-retrieval-eval.sh <pod-id>
```

The runner performs read-only agent questions and note lookups. It does not create,
update, or delete notes. Each run creates a normal Lemma conversation, checks the app
evidence envelope, verifies every cited ID resolves to a real `notes` row for the
current member, and checks required table/file provenance. Repository and link cases
also fail unless the human-readable answer contains a cited row's saved source URL.

If a member does not have a TTS repository, a Maya OKR, or a transition reference,
replace only the query text with equivalent existing notes before interpreting recall.
An honest "nothing saved" is correct behavior for missing data, not a retrieval pass.

Do not add `entities` or mirror all short notes into `/notes` merely to make this
fixture green. First record a real miss where the relevant row exists.

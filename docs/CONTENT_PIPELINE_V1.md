# Content Pipeline V1

Content Pipeline V1 is an offline-first operator tool for planning reviewed Album batches against the one published catalog authority at `src/data/generated/catalog.json`. It does not create a second catalog or Artist store, and its dry-run command never writes production catalog data or production covers.

## Commands

Create an ignored local batch workspace:

```powershell
node scripts/catalog/content-pipeline/cli.mjs create-batch `
  --batch .local-data/content-pipeline/batches/CONTENT-BATCH-20260815-001 `
  --id CONTENT-BATCH-20260815-001 `
  --discovered-at 2026-08-15T00:00:00.000Z
```

Place provider payloads in `input/payloads/`, local cover sources in `incoming-covers/`, then run:

```powershell
node scripts/catalog/content-pipeline/cli.mjs dry-run `
  --batch .local-data/content-pipeline/batches/CONTENT-BATCH-20260815-001
```

The primary input is UTF-8 CSV with these headers:

```text
album_id,expected_title,expected_artists,core_genres,contexts,cover_file,source_reference,discovered_at,slug_override,refresh
```

`album_id`, `expected_title`, `expected_artists`, and `core_genres` are required. Artist names are assertions only; positive NetEase Artist IDs from the authoritative local payload own identity. `slug_override` and `refresh=true` always require human review.

## Workspace outputs

- `normalized/normalized.json`: normalized rows and proposed Album records;
- `plan/plan.json`: deterministic semantic plan and READY set;
- `candidate/generated/`: complete derived catalog candidate produced by the existing publisher;
- `candidate/assets/covers/`: staged 360 px and 960 px WebP derivatives;
- `report/report.json`: machine-readable dispositions and reason codes;
- `report/report.md`: concise human exception report;
- `report/metrics.json`: non-semantic phase timings;
- `transaction/`: future promotion journal/rollback state.

Rows resolve to `READY`, `SKIPPED_DUPLICATE`, `NEEDS_REVIEW`, `ERROR`, or `FATAL`. A bad row does not terminate other row planning. The plan lists READY IDs but requires a future explicit selection and promotion authorization.

## Determinism and safety

- Existing Album identities and slugs are never recomputed.
- A new unique ASCII base slug is used directly; any existing or same-batch collision uses `<base-slug>-<neteaseAlbumId>` for every colliding new row.
- Non-ASCII titles retain the existing NetEase-ID fallback.
- Cover sources must be local JPEG, PNG, or WebP files. V1 preserves aspect ratio, does not upscale, and stages 360/76 and 960/82 WebP outputs with SHA-256.
- `src/data/generated`, `public/catalog`, package metadata, Git index, and frozen evidence are outside dry-run write scope.
- Reports use fixed batch timestamps for semantic content. Phase durations live only in `metrics.json`.
- Provider cache adapters accept current hash-wrapped sync records and legacy raw NetEase payloads, then expose one normalized payload shape.

## Transaction foundation

`transaction.mjs` records the batch ID, baseline and candidate fingerprints, touched destinations, before existence/hashes, proposed hashes and operation state. Staged inputs must be inside the batch workspace; destinations must be inside explicitly supplied allowed roots. Promotion verifies final hashes and rolls back already-promoted operations after injected or real failure. Git is not used as the rollback engine.

The transaction API is intentionally not exposed as a production import command in CP-V1.1–1.4. A real 10–20 Album Pilot and any production promotion require separate authorization.

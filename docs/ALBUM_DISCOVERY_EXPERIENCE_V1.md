# Album Discovery Experience V1

## Product and architecture decisions

This increment extends the existing homepage selection authority. The data flow remains:

`published local catalog → canonical discovery engine / derived visual snapshot → HomepageAlbumField selectedAlbumId → vinyl, atmosphere, chromatic wall, continuation, relationship view`

There is no second recommendation engine, client store, runtime image analysis, network provider, audio capability, or catalog mutation.

### Relationship view

The relationship view is an alternate presentation of `buildAlbumDiscoveryPresentation`. Its compact homepage payload preserves only target album identity and the engine's short `lens` copy. Selecting a related album updates the same `selectedAlbumId`; the new center then reads its own precomputed one-layer canonical relations. The view shows no more than seven related albums and does not accumulate historical graph nodes.

### Adaptive atmosphere and chromatic discovery

`scripts/catalog/generate-visual-index.mjs` decodes each existing local cover to a fixed 48 × 48 RGB24 sample with local ffmpeg. `visual-color-analysis.mjs` uses HSL-aware quantization and pixel distributions rather than average RGB. The generated snapshot records dominant colors, primary/secondary color, primary hue, saturation, luminance, grayscale ratio, dark ratio, multiple visual tags, one primary visual color, and the exact source-cover SHA-256.

The allowed visual taxonomy is exactly: red, orange, yellow, green, cyan, blue, purple, pink, mono, dark, and multicolor. Representatives are deterministic and ordered by hue, saturation, luminance, then album identity. Visual tags are explicitly cover properties, not music genres.

The selected cover's colors affect only restrained highlights over the black homepage base. Text and focus indicators retain high-contrast neutral ink.

### Homepage ambient flow field

The Album Field uses one presentation-only ambient layer behind covers and the draggable vinyl. It inherits the selected album's existing safe accent pair; it does not sample covers at runtime, store another selected album, or introduce another color authority. A keyed palette layer briefly returns toward black before the next safe accent enters.

The existing homepage scroll runtime remains the only continuous `requestAnimationFrame` loop. On fine pointers it writes restrained edge-energy variables to the ambient layer. During the `DOCK` phase it derives stronger edge influence from the existing vinyl rectangle and drag offset; `RELEASE` drives that influence back to zero. Coarse pointers retain only the slow selected-album atmosphere. Reduced motion disables continuous field animation and all pointer/vinyl distortion while preserving a faint static atmosphere.

The field is `aria-hidden`, has `pointer-events: none`, and sits between the black page background and the existing covers/vinyl. Fragmented radial fields and smooth top-corner suppression avoid a complete border and protect fixed navigation contrast. It adds no image, audio, canvas, WebGL, provider request, dependency, or catalog data.

## Daily Record data gate

Status: **BLOCKED BY RYM COVERAGE**.

- Published albums: 1,330.
- Albums with both RYM rating and rating count: 13.
- Exact identity matches among those records: 13.
- High-confidence pool (`rating >= 3.8`, `ratingCount >= 1,000`, exact match): 12.
- Duplicate title/artist groups in the full catalog: 5; none intersects the rated pool.
- Recommended minimum: 92 eligible albums. This caps a deterministic annual rotation at roughly four appearances per album instead of presenting a 12-record loop as a meaningful daily feature.

No Daily Record UI or fallback ranking is introduced. Future work requires a larger offline, identity-verified RYM enrichment snapshot with both rating and rating-count provenance.

## Metadata enrichment Phase 0 audit

| Field | Status | Current evidence | Required next step |
| --- | --- | --- | --- |
| Album description | PARTIAL / BACKFILL REQUIRED | 6/1,330 albums have local editorial records | Human-reviewed local editorial backfill |
| Artist region | NOT AVAILABLE / BACKFILL REQUIRED | No authoritative region field in the published artist contract | Explicit source-backed artist-region project; never infer from script or market channel |
| Album language | NOT AVAILABLE / BACKFILL REQUIRED | No authoritative language field in the album contract | Explicit source-backed language project; never infer from title script |
| RYM rating | PARTIAL / BACKFILL REQUIRED | 13/1,330 exact offline matches | Identity-verified offline enrichment |
| RYM rating count | PARTIAL / BACKFILL REQUIRED | 13/1,330 exact offline matches | Enrich together with rating and provenance |
| Secondary genres | PARTIAL / BACKFILL REQUIRED | 11/1,330 have `relatedGenres` | Human/offline taxonomy enrichment through the existing authority |
| Original release year | PARTIAL / BACKFILL REQUIRED | All entries have a release year, but the contract does not distinguish original issue from later edition | Add explicit original-release provenance before using it as original-year truth |
| Edition identity | NOT AVAILABLE / BACKFILL REQUIRED | Edition wording may occur in titles, but there is no canonical edition identity field | MusicBrainz-owned release-group/edition reconciliation |
| Label normalization | PARTIAL / BACKFILL REQUIRED | 964/1,330 detail records contain raw `company`; no normalized label authority exists | Separate normalized-label authority with provenance |

This audit does not authorize schema mutation, data acquisition, inference, or backfill.

# Repository guide

## Project

This repository is a Next.js application for album discovery. It uses the App
Router, TypeScript in strict mode, Tailwind CSS, ESLint, Vitest, and pnpm.

## Working conventions

- Use pnpm for dependency and script commands.
- Keep application code under `src/` and route code under `src/app/`.
- Prefer typed, accessible React components and avoid weakening TypeScript
  checks.
- Add or update tests for behavior changes. Tests use Vitest, jsdom, and React
  Testing Library.
- Record durable architecture or product decisions in `docs/`.
- Store repository-specific agent skills as subdirectories of
  `.agents/skills/`, with one `SKILL.md` per skill.

## Planning conventions

- Before an important version plan, cross-file change, or UI-wide change, read
  `docs/ALEKSI_CODEX_PLANNING_METHOD.md` and use
  `.agents/skills/executable-project-planning/SKILL.md`.
- Base plans on the real repository. Do not guess paths, components, data
  structures, interfaces, or existing behavior.
- Plans must include file-by-file requirements, reuse relationships, dependency
  order, requirement-file-test mapping, global regression scope, stop
  conditions, and observable acceptance criteria.
- Do not use a README, summary, or report in place of the requested
  implementation.
- Planning-only work must stop before implementation; never clean, overwrite,
  apply, drop, or rewrite user Git work without explicit authorization.

## Product and data boundaries

- Read `docs/PRODUCT.md`, `docs/DATA_SOURCES.md`, and `docs/ARCHITECTURE.md`
  before changing product behavior or data boundaries.
- The product uses one static real-album catalog. Its primary navigation is
  Home, Discover, For You, Recently Added, My Albums, and Search; do not add
  domestic or foreign catalog sections.
- MusicBrainz owns album identity and release metadata. Cover Art Archive is
  the preferred cover source, and the local editorial layer owns Chinese
  guides, first-party taxonomy, descriptors, and listening contexts.
- NetEase `ALL`, `ZH`, `EA`, `JP`, and `KR` values are request-side new-release
  market channels. Store them only as discovery provenance, never as album or
  artist nationality, jurisdiction, language, or canonical region.
- Do not infer country, region, nationality, or language from names, scripts,
  search order, or market-channel membership. Hide unsupported fields or show
  an explicit unavailable state.
- The frontend must use published local snapshots, never live MusicBrainz,
  Cover Art Archive, NetEase, Apple, or RYM
  requests.
- Do not add accounts, comments, public user ratings, in-app playback,
  popularity ranking, or a trending module unless the
  roadmap and user instruction explicitly change.

## Required checks

Run these commands before considering a change complete:

```text
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

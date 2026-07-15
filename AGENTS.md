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

## Product and data boundaries

- Read `docs/ROADMAP.md` before starting work and do not cross a stage gate
  without an explicit user instruction.
- NetEase Cloud Music owns album catalog, cover, track, and outbound listening
  fields. RYM owns rating, rating count, Primary Genres, Secondary Genres, and
  Descriptors.
- MusicBrainz, Cover Art Archive, ListenBrainz, and Last.fm are not production
  data sources for the first version.
- The frontend must use published local snapshots, never live NetEase or RYM
  requests.
- Do not add accounts, comments, collections, user ratings, in-app playback,
  recommended tracks, popularity ranking, or a trending module unless the
  roadmap and user instruction explicitly change.

## Required checks

Run these commands before considering a change complete:

```text
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

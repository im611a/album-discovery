# Album Discovery

Album Discovery is a no-account catalog for finding albums through recent
releases, community ratings, newly indexed records, and random discovery. It is
currently in the documentation and architecture phase; product pages, database
integration, and production data providers have not been implemented.

## First-version product shape

- Primary navigation: Home, Discover Albums, New Releases, Search.
- Home: Recent Releases, Highly Rated Albums, Recently Added, Random Discovery.
- Discover Albums: year, decade, release type, RYM genres, and descriptors;
  no country, domestic/foreign, language-market, or popularity filters.
- New Releases: may expose NetEase `ALL`, `ZH`, `EA`, `JP`, and `KR` market
  channels with a clear source label. These are not nationality or region data.
- Album detail: catalog facts, RYM community data, tracks, provenance, update
  time, and one outbound NetEase album link.

NetEase Cloud Music is the candidate source for album catalog, cover, tracks,
and the only listening link. Authorized offline RYM files are the source for
rating, rating count, Primary Genres, Secondary Genres, and Descriptors. The
frontend will read published local snapshots and must never query either source
live.

## Local commands

```text
pnpm dev
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

## Current boundary

Stage 0.16 only revises product and data documentation after the bounded 0.15A
and 0.15B feasibility experiments. It does not authorize page development,
database work, new NetEase requests, RYM access, deployment, or a production
catalog provider. See [docs/README.md](./docs/README.md) for the documentation
index and [docs/ROADMAP.md](./docs/ROADMAP.md) for stage gates.

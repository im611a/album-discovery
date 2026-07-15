# Project documentation

Stage 0.1 documentation is split by responsibility:

- [PRODUCT_SPEC.md](./PRODUCT_SPEC.md): first-version product scope and exclusions
- [INFORMATION_ARCHITECTURE.md](./INFORMATION_ARCHITECTURE.md): route and content hierarchy
- [DATA_ARCHITECTURE.md](./DATA_ARCHITECTURE.md): source authority, logical model, and data flow
- [NETEASE_CATALOG_STRATEGY.md](./NETEASE_CATALOG_STRATEGY.md): future catalog ingestion strategy
- [NETEASE_FEASIBILITY_PLAN.md](./NETEASE_FEASIBILITY_PLAN.md): gated 0.15 validation plan
- [NETEASE_FEASIBILITY_REPORT.md](./NETEASE_FEASIBILITY_REPORT.md): bounded 0.15A experiment evidence and risks
- [NETEASE_REGION_TAXONOMY_REPORT.md](./NETEASE_REGION_TAXONOMY_REPORT.md): bounded 0.15B market-channel and region-signal evidence
- [RYM_IMPORT_STRATEGY.md](./RYM_IMPORT_STRATEGY.md): authorized offline import strategy
- [RYM_TAXONOMY.md](./RYM_TAXONOMY.md): rating and taxonomy semantics
- [OPEN_SOURCE_REFERENCES.md](./OPEN_SOURCE_REFERENCES.md): dated public-repository audit
- [ROADMAP.md](./ROADMAP.md): stage gates and current stop point

The product specification owns product scope, while the data architecture owns
field authority. Source-specific documents reference those decisions instead of
redefining them.

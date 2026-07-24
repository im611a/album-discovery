# Repository skills

The repository has ten deliberately separate skills:

- `open-source-reference-audit`: read-only public repository research
- `netease-catalog-ingestion`: authorized future NetEase catalog ingestion
- `rym-data-import`: authorized offline RYM file import
- `minimal-album-ui`: later, explicitly approved album UI work
- `quality-gate`: scope, keyword, test, build, and Git verification
- `executable-project-planning`: file-level plans for versions, cross-file work,
  UI-wide changes, refactors, migrations, and architecture changes; it requires
  reading `docs/ALEKSI_CODEX_PLANNING_METHOD.md` and auditing the real repository
  before naming files or responsibilities, separates planning from authorized
  implementation, and protects existing worktrees, stashes, and branch history
- `editorial-album-art-direction`: evidence-based editorial grids, Songti
  typography, cover hierarchy, and independent mobile composition
- `animejs-react-motion`: scoped Anime.js React integration with cleanup,
  reduced-motion, and visual-test stabilization
- `playwright-visual-regression`: fixed-data browser, responsive, network,
  accessibility, and Chromium visual checks
- `third-party-ui-audit`: license, compatibility, dependency, accessibility,
  and bundle review before any third-party UI is adopted

Each skill lives in its own directory and defines triggers, exclusions,
workflow, safety boundaries, and output requirements. No skill grants permission
to move into a later roadmap stage on its own.

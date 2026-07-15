# NetEase region taxonomy spike

Stage: 0.15B. This is a bounded supplement to the 0.15A feasibility spike,
not a catalog provider, database import, or frontend feature.

## Questions

The experiment separates two questions that must not be conflated:

1. Can anonymous metadata reliably distinguish mainland China, Hong Kong,
   Taiwan, Macao, and foreign markets?
2. Do new-release channels provide only the broader `ZH`, `EA`, `JP`, and `KR`
   market groupings?

`ZH` is treated as a request-channel label, not as "domestic China". `EA` is
treated as a platform channel, not as an artist-nationality field. Manual
control labels in the probe manifest are comparison notes only and are never
written back as API-derived facts.

## Request plan

- Read all 17 normalized 0.15A albums locally; do not request their details
  again.
- Request the first 10 items from `ZH`, `EA`, `JP`, and `KR`, plus `ALL` as a
  control.
- Check artist-search and artist-detail shapes for 14 deduplicated artists:
  12 selected from the 0.15A samples and two boundary controls.
- Check three album-search result shapes, including a multi-artist soundtrack.
- Expected base request count: 36. Hard limit: 40 attempts.

## Safety controls

- Only `https://music.163.com` is allowlisted.
- Requests are sequential and separated by at least two seconds.
- A network error or 5xx response may be retried once. A 401, 403, 429,
  login, captcha, or risk-control response stops that test category.
- No login, Cookie, token, Authorization, browser data, proxy, custom request
  header, playback endpoint, user endpoint, comment endpoint, or paid-content
  endpoint is used.
- Response headers and raw response bodies are never written to disk.
- Logs contain only the test type, public query parameter, time, HTTP status,
  duration, success flag, and error category.

## Files

- `probe-manifest.json`: predeclared artist and album-search probes
- `run.mjs`: dependency-free validator and request runner
- `channel-samples.json`: normalized first-page new-release channel samples
- `artist-area-results.json`: relevant field observations from artist search
  and artist detail
- `album-search-results.json`: relevant field observations from album search
- `duplicate-analysis.json`: cross-channel album and artist overlap
- `request-log.jsonl`: non-sensitive per-attempt log
- `run-summary.json`: aggregate runtime and field evidence

## Commands

Local validation without network access:

```text
node experiments/netease-catalog-spike/region-taxonomy/run.mjs --validate-only
```

Authorized bounded run:

```text
node experiments/netease-catalog-spike/region-taxonomy/run.mjs
```

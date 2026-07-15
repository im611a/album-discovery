# NetEase catalog feasibility spike

Stage: 0.15A. This is a bounded technical experiment, not a production catalog
provider or a data-ingestion pipeline.

## Questions

The spike checks whether anonymous requests can expose enough public album
metadata for search, album detail, artist album lists, new releases, covers,
release dates, artist IDs, album types, companies, tracks, official album links,
and region/language evidence.

The 18-item manifest is deliberately small and is not representative of the
full NetEase catalog.

## Safety controls

- Only `https://music.163.com` is allowed by the script.
- Requests are sequential, with at least two seconds after one attempt
  completes before another begins.
- The hard budget is 60 attempts. Network errors and 5xx responses may be
  retried once; 401, 403, 429, login, captcha, or risk-control signals are not
  retried.
- No login, Cookie, token, proxy, custom request header, playback endpoint, user
  endpoint, comment endpoint, or browser data is used.
- Response headers and raw response bodies are never written to disk.

## Files

- `sample-manifest.json`: the predeclared album sample set
- `src/run.mjs`: dependency-free validation and request runner
- `output/request-log.jsonl`: non-sensitive per-attempt log
- `output/normalized-samples.json`: normalized successful album samples
- `output/run-summary.json`: aggregate request, probe, and coverage evidence

## Commands

Validate the manifest without network access:

```text
node experiments/netease-catalog-spike/src/run.mjs --validate-only
```

Run the authorized spike:

```text
node experiments/netease-catalog-spike/src/run.mjs
```

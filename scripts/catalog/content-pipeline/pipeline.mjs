import { mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validateCatalogData } from "../catalog-validation.mjs";
import { normalizePayload } from "../sync-catalog.mjs";
import { publishCatalog } from "../publish-catalog.mjs";
import { validateAndStageCover } from "./covers.mjs";
import { DISPOSITION, DUPLICATE_STATE, finding, PIPELINE_VERSION, SEVERITY, dispositionFromFindings } from "./contracts.mjs";
import { allocateDeterministicSlugs } from "./identity.mjs";
import { readBatchInput } from "./input.mjs";
import { loadLocalPayload } from "./payload.mjs";
import { buildMachineReport, humanReport } from "./report.mjs";
import { fingerprint, sha256File, stableJson } from "./utils.mjs";
import { knownFrozenArtistDebt, validateProposedAlbum } from "./validation.mjs";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

const now = () => performance.now();
const elapsed = (start) => Number((performance.now() - start).toFixed(3));

async function readJson(file) {
  return JSON.parse(await readFile(file, "utf8"));
}

async function directoryFingerprint(directory) {
  const entries = [];
  async function visit(current) {
    for (const entry of (await readdir(current, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
      const file = path.join(current, entry.name);
      if (entry.isDirectory()) await visit(file);
      else entries.push({ path: path.relative(directory, file).replaceAll("\\", "/"), bytes: (await stat(file)).size, sha256: await sha256File(file) });
    }
  }
  await visit(directory);
  return { entries, fingerprint: fingerprint(entries) };
}

async function verifyCandidatePublication(directory, candidate, baselineCatalog, touchedAlbumIds) {
  const [manifest, indexManifest, artistIndex, publishedCatalog] = await Promise.all([
    readJson(path.join(directory, "catalog.manifest.json")),
    readJson(path.join(directory, "catalog-index.manifest.json")),
    readJson(path.join(directory, "artist-index.json")),
    readJson(path.join(directory, "catalog.json")),
  ]);
  const details = (await readdir(path.join(directory, "album-details"))).filter((name) => name.endsWith(".json"));
  const indexPath = path.join(directory, "catalog-index.json");
  const errors = [];
  if (manifest.albums !== candidate.albums.length || manifest.details !== candidate.albums.length) errors.push("catalog manifest count mismatch");
  if (details.length !== candidate.albums.length) errors.push("album detail count mismatch");
  if (indexManifest.catalogCount !== candidate.albums.length || indexManifest.shards?.[0]?.sha256 !== await sha256File(indexPath)) errors.push("catalog index manifest mismatch");
  if (manifest.artists !== artistIndex.artists?.length) errors.push("artist index count mismatch");
  if (new Set(candidate.albums.map((album) => album.slug)).size !== candidate.albums.length) errors.push("candidate static Album route collision");
  if (new Set(artistIndex.artists.map((artist) => artist.slug)).size !== artistIndex.artists.length) errors.push("candidate static Artist route collision");
  const touched = new Set(touchedAlbumIds.map(String));
  const publishedById = new Map(publishedCatalog.albums.map((album) => [String(album.neteaseAlbumId), album]));
  const untouchedBaselineDrift = baselineCatalog.albums
    .filter((album) => !touched.has(String(album.neteaseAlbumId)))
    .filter((album) => JSON.stringify(publishedById.get(String(album.neteaseAlbumId))) !== JSON.stringify(album))
    .map((album) => String(album.neteaseAlbumId));
  if (untouchedBaselineDrift.length) errors.push(`untouched baseline Album drift: ${untouchedBaselineDrift.join(", ")}`);
  return {
    ok: errors.length === 0,
    errors,
    albums: manifest.albums,
    artists: manifest.artists,
    details: details.length,
    indexSha256: await sha256File(indexPath),
    declaredTouchedAlbumIds: [...touched].sort((a, b) => a.localeCompare(b, "en-US", { numeric: true })),
    untouchedBaselineAlbums: baselineCatalog.albums.length - [...touched].filter((albumId) => baselineCatalog.albums.some((album) => String(album.neteaseAlbumId) === albumId)).length,
    untouchedBaselineDrift,
  };
}

function safeWorkspace(batchRoot, target) {
  const relative = path.relative(path.resolve(batchRoot), path.resolve(target));
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) throw new Error(`Pipeline output must remain inside the batch workspace: ${target}`);
}

export async function runDryRun({
  batchRoot,
  catalogPath = path.join(repositoryRoot, "src", "data", "generated", "catalog.json"),
  identitiesPath = path.join(repositoryRoot, "scripts", "catalog", "netease-identities.json"),
  rymSnapshotPath = path.join(repositoryRoot, "scripts", "catalog", "rym-taxonomy-snapshot.json"),
  cacheRoots = [path.join(repositoryRoot, ".cache", "catalog", "sync", "raw"), path.join(repositoryRoot, ".cache", "catalog", "netease")],
}) {
  const resolvedBatchRoot = path.resolve(batchRoot);
  const batchConfigPath = path.join(resolvedBatchRoot, "batch.json");
  const config = await readJson(batchConfigPath);
  if (!/^CONTENT-BATCH-\d{8}-\d{3}$/.test(String(config.id ?? ""))) throw new Error("batch.json id must match CONTENT-BATCH-YYYYMMDD-NNN.");
  const fixedTimestamp = String(config.discoveredAt ?? "");
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(fixedTimestamp)) throw new Error("batch.json discoveredAt must be a fixed UTC ISO timestamp with milliseconds.");
  const inputPath = path.resolve(resolvedBatchRoot, config.input ?? "input/input.csv");
  safeWorkspace(resolvedBatchRoot, inputPath);
  const incomingRoot = path.join(resolvedBatchRoot, "incoming-covers");
  const normalizedRoot = path.join(resolvedBatchRoot, "normalized");
  const planRoot = path.join(resolvedBatchRoot, "plan");
  const candidateRoot = path.join(resolvedBatchRoot, "candidate");
  const reportRoot = path.join(resolvedBatchRoot, "report");
  for (const target of [normalizedRoot, planRoot, candidateRoot, reportRoot]) safeWorkspace(resolvedBatchRoot, target);
  await Promise.all([normalizedRoot, planRoot, candidateRoot, reportRoot].map(async (directory) => {
    await rm(directory, { recursive: true, force: true });
    await mkdir(directory, { recursive: true });
  }));
  const metrics = {};
  let started = now();
  const [catalog, identities, rymSnapshot, rows] = await Promise.all([readJson(catalogPath), readJson(identitiesPath), readJson(rymSnapshotPath), readBatchInput(inputPath)]);
  metrics.parseAndLoadMs = elapsed(started);
  const baseline = { catalogSha256: await sha256File(catalogPath), catalogFingerprint: fingerprint(catalog), albums: catalog.albums.length };
  const frozenDebt = knownFrozenArtistDebt(catalog);
  if (frozenDebt.state !== "KNOWN_FROZEN_ARTIST_ID_0_DEBT") throw new Error(`Frozen Artist debt no longer matches the approved exception: ${JSON.stringify(frozenDebt)}`);
  const duplicateInputIds = new Set();
  const seenInputIds = new Set();
  for (const row of rows) {
    if (seenInputIds.has(row.albumId)) duplicateInputIds.add(row.albumId);
    seenInputIds.add(row.albumId);
  }
  const working = [];
  started = now();
  for (const row of rows) {
    const findings = [...row.findings];
    if (duplicateInputIds.has(row.albumId)) findings.push(finding(SEVERITY.ERROR, "DUPLICATE_INPUT_ALBUM_ID", `Album ID ${row.albumId} occurs more than once in this input.`, "Remove the duplicate input row."));
    const existing = catalog.albums.find((album) => album.neteaseAlbumId === row.albumId);
    if (existing && !row.refresh) {
      findings.push(finding(SEVERITY.PASS, DUPLICATE_STATE.EXACT_DUPLICATE, `Album ID ${row.albumId} already exists as ${existing.slug}.`, "No action; use a separately authorized refresh only if the existing record must change.", { conflict: { id: existing.neteaseAlbumId, slug: existing.slug, title: existing.title } }));
      working.push({ row, album: existing, findings, duplicate: { state: DUPLICATE_STATE.EXACT_DUPLICATE, conflict: { id: existing.neteaseAlbumId, slug: existing.slug, title: existing.title } }, artistResolution: { states: [], findings: [] }, source: null, assets: null });
      continue;
    }
    if (findings.some((item) => item.level === SEVERITY.ERROR)) {
      working.push({ row, album: null, findings, duplicate: { state: DUPLICATE_STATE.DISTINCT, conflict: null }, artistResolution: { states: [], findings: [] }, source: null, assets: null });
      continue;
    }
    try {
      const payloadRecord = await loadLocalPayload(row.albumId, [path.join(resolvedBatchRoot, "input", "payloads"), ...cacheRoots]);
      const fetchedAt = payloadRecord.fetchedAt && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(payloadRecord.fetchedAt) ? payloadRecord.fetchedAt : fixedTimestamp;
      const album = normalizePayload({ albumId: row.albumId, coreGenres: row.coreGenres, contexts: row.contexts, discoveredAt: row.discoveredAt ?? fixedTimestamp }, payloadRecord.payload, fetchedAt, true);
      const validated = validateProposedAlbum({ row, album, catalog });
      findings.push(...validated.findings.filter((item) => !findings.some((existingFinding) => existingFinding.code === item.code)));
      const cover = await validateAndStageCover({ albumId: row.albumId, coverFile: row.coverFile, incomingRoot, outputRoot: path.join(candidateRoot, "assets", "covers"), productionCoverRoot: path.join(repositoryRoot, "public", "catalog", "covers") });
      findings.push(...cover.findings);
      album.cover = cover.assets ? {
        kind: "local",
        src: `/catalog/covers/detail/${row.albumId}.webp`,
        thumbnailSrc: `/catalog/covers/thumb/${row.albumId}.webp`,
        alt: `《${album.title}》专辑封面`,
        reason: null,
      } : album.cover;
      working.push({ row, album, findings, duplicate: validated.duplicate, artistResolution: validated.artistResolution, source: { adapter: payloadRecord.adapter, payloadSha256: payloadRecord.fileSha256 }, assets: cover.assets });
    } catch (error) {
      findings.push(finding(SEVERITY.ERROR, error.code ?? "PAYLOAD_NORMALIZATION_FAILED", String(error.message), "Repair or provide the authoritative local payload."));
      working.push({ row, album: null, findings, duplicate: { state: DUPLICATE_STATE.DISTINCT, conflict: null }, artistResolution: { states: [], findings: [] }, source: null, assets: null });
    }
  }
  metrics.normalizeValidateResolveAssetsMs = elapsed(started);
  const proposedItems = working.filter((item) => item.album && item.duplicate.state !== DUPLICATE_STATE.EXACT_DUPLICATE);
  const batchArtistNames = new Map();
  for (const item of proposedItems) {
    for (const artist of item.album.artists ?? []) {
      const id = String(artist.neteaseArtistId);
      if (!/^\d+$/.test(id) || BigInt(id) <= 0n) continue;
      if (!batchArtistNames.has(id)) batchArtistNames.set(id, new Set());
      batchArtistNames.get(id).add(artist.name.normalize("NFKC").toLocaleLowerCase("zh-CN"));
    }
  }
  for (const item of proposedItems) {
    for (const artist of item.album.artists ?? []) {
      if ((batchArtistNames.get(String(artist.neteaseArtistId))?.size ?? 0) > 1) {
        item.findings.push(finding(SEVERITY.NEEDS_REVIEW, "ARTIST_ID_NAME_CONFLICT", `Artist ID ${artist.neteaseArtistId} has conflicting names inside this batch.`, "Review all rows using this Artist ID."));
      }
    }
    if (item.duplicate.state === DUPLICATE_STATE.DISTINCT) {
      const batchDuplicate = validateProposedAlbum({ row: item.row, album: item.album, catalog: { ...catalog, albums: proposedItems.filter((other) => other !== item).map((other) => other.album) } }).duplicate;
      if (batchDuplicate.state === DUPLICATE_STATE.LIKELY_DUPLICATE || batchDuplicate.state === DUPLICATE_STATE.POSSIBLE_EDITION) {
        item.duplicate = batchDuplicate;
        item.findings.push(finding(SEVERITY.NEEDS_REVIEW, batchDuplicate.state, batchDuplicate.state === DUPLICATE_STATE.LIKELY_DUPLICATE ? "Another proposed row strongly matches this Album." : "Another proposed row may be an edition of this Album.", "Review both proposed rows; do not merge automatically.", { conflict: batchDuplicate.conflict }));
      }
    }
  }
  const slugPlans = allocateDeterministicSlugs(working.filter((item) => item.album && item.duplicate.state !== DUPLICATE_STATE.EXACT_DUPLICATE).map((item) => ({ albumId: item.row.albumId, title: item.album.title, slugOverride: item.row.slugOverride })), catalog);
  const slugById = new Map(slugPlans.map((item) => [item.albumId, item]));
  const records = working.map((item) => {
    const slug = slugById.get(item.row.albumId);
    const findings = [...item.findings, ...(slug?.findings ?? [])];
    if (item.album && slug) item.album.slug = slug.slug;
    const disposition = dispositionFromFindings(findings, item.duplicate.state);
    return {
      rowNumber: item.row.rowNumber,
      albumId: item.row.albumId,
      expectedTitle: item.row.expectedTitle,
      expectedArtists: item.row.expectedArtists,
      disposition,
      findings,
      duplicate: item.duplicate,
      artistResolution: item.artistResolution.states,
      source: item.source,
      assets: item.assets ? {
        profile: item.assets.profile,
        source: { sha256: item.assets.source.sha256, bytes: item.assets.source.bytes, codec: item.assets.source.codec, width: item.assets.source.width, height: item.assets.source.height },
        thumbnail: { relativePath: item.assets.thumbnail.relativePath, sha256: item.assets.thumbnail.sha256, bytes: item.assets.thumbnail.bytes, width: item.assets.thumbnail.width, height: item.assets.thumbnail.height },
        detail: { relativePath: item.assets.detail.relativePath, sha256: item.assets.detail.sha256, bytes: item.assets.detail.bytes, width: item.assets.detail.width, height: item.assets.detail.height },
      } : null,
      proposed: item.album ? { id: item.album.id, slug: item.album.slug, cover: item.album.cover } : null,
      album: item.album,
    };
  }).sort((a, b) => a.albumId.localeCompare(b.albumId, "en-US", { numeric: true }) || a.rowNumber - b.rowNumber);
  const readyAlbums = records.filter((record) => record.disposition === DISPOSITION.READY).map((record) => record.album);
  const candidate = {
    ...catalog,
    refreshDate: fixedTimestamp.slice(0, 10),
    source: { ...catalog.source, generatedAt: fixedTimestamp, runtimeRequestsAllowed: false },
    albums: [...catalog.albums, ...readyAlbums],
  };
  started = now();
  const catalogValidation = validateCatalogData(candidate, identities, rymSnapshot);
  if (!catalogValidation.ok) {
    for (const record of records.filter((item) => item.disposition === DISPOSITION.READY)) {
      record.findings.push(finding(SEVERITY.FATAL, "CANDIDATE_CATALOG_INVALID", catalogValidation.errors.join("; "), "Fix the candidate before promotion."));
      record.disposition = DISPOSITION.FATAL;
    }
  }
  const candidateGenerated = path.join(candidateRoot, "generated");
  const touchedAlbumIds = records.filter((record) => record.disposition === DISPOSITION.READY).map((record) => record.albumId);
  await publishCatalog(candidate, candidateGenerated, { coverRoot: path.join(candidateRoot, "assets", "covers"), touchedAlbumIds });
  const candidateVerification = await verifyCandidatePublication(candidateGenerated, candidate, catalog, touchedAlbumIds);
  if (!candidateVerification.ok) throw new Error(`Candidate publication verification failed: ${candidateVerification.errors.join("; ")}`);
  const candidateFiles = await directoryFingerprint(candidateRoot);
  metrics.candidateGenerationMs = elapsed(started);
  const normalized = records.map(({ album, ...record }) => ({ ...record, normalizedAlbum: album }));
  const plan = {
    schema: `${PIPELINE_VERSION}/plan/v1`,
    batchId: config.id,
    baseline,
    readyAlbumIds: records.filter((record) => record.disposition === DISPOSITION.READY).map((record) => record.albumId),
    selectionRequiredForPromotion: true,
    records: records.map((record) => ({ albumId: record.albumId, disposition: record.disposition, slug: record.proposed?.slug ?? null, duplicate: record.duplicate.state, destinationAssets: record.assets ? [record.assets.thumbnail.relativePath, record.assets.detail.relativePath] : [], findings: record.findings.map((item) => ({ level: item.level, code: item.code })) })),
    candidate: { albums: candidate.albums.length, generatedDirectory: "candidate/generated", assetDirectory: "candidate/assets/covers", fingerprint: candidateFiles.fingerprint, files: candidateFiles.entries.length, verification: candidateVerification },
  };
  const report = buildMachineReport({
    batch: { id: config.id, discoveredAt: fixedTimestamp, pipelineVersion: PIPELINE_VERSION },
    baseline,
    input: { path: path.relative(resolvedBatchRoot, inputPath).replaceAll("\\", "/"), sha256: await sha256File(inputPath), rows: rows.length },
    records,
    candidate: plan.candidate,
    frozenDebt,
  });
  await Promise.all([
    writeFile(path.join(normalizedRoot, "normalized.json"), stableJson(normalized), "utf8"),
    writeFile(path.join(planRoot, "plan.json"), stableJson(plan), "utf8"),
    writeFile(path.join(reportRoot, "report.json"), stableJson(report), "utf8"),
    writeFile(path.join(reportRoot, "report.md"), humanReport(report), "utf8"),
    writeFile(path.join(reportRoot, "metrics.json"), stableJson({ schema: `${PIPELINE_VERSION}/metrics/v1`, ...metrics }), "utf8"),
  ]);
  return { plan, report, metrics, paths: { normalizedRoot, planRoot, candidateRoot, reportRoot } };
}

export async function createBatchWorkspace(batchRoot, { id, discoveredAt, input = "input/input.csv" }) {
  const root = path.resolve(batchRoot);
  for (const directory of ["input/payloads", "incoming-covers", "normalized", "plan", "candidate", "report", "transaction"]) await mkdir(path.join(root, directory), { recursive: true });
  await writeFile(path.join(root, "batch.json"), stableJson({ id, discoveredAt, input }), { encoding: "utf8", flag: "wx" });
  const inputPath = path.join(root, input);
  await mkdir(path.dirname(inputPath), { recursive: true });
  await writeFile(inputPath, "album_id,expected_title,expected_artists,core_genres,contexts,cover_file,source_reference,discovered_at,slug_override,refresh\n", { encoding: "utf8", flag: "wx" });
  return root;
}

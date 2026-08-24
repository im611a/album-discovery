import path from "node:path";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { readAcquisitionFinalization } from "./quarantine.mjs";
import { fingerprint, sha256File, stableJson, uniqueStable } from "./utils.mjs";

export const TAXONOMY_PROPOSAL_SCHEMA = "content-pipeline-v1/taxonomy-proposal/v1";
export const TAXONOMY_DECISIONS_SCHEMA = "content-pipeline-v1/taxonomy-decisions/v1";

function taxonomyError(code, message) { return Object.assign(new Error(`${code}: ${message}`), { code }); }
const genreSet = (values) => uniqueStable(values ?? []);
const signature = (values) => genreSet(values).join("|");

function productionEvidence(catalog) {
  const byArtist = new Map();
  for (const album of catalog.albums ?? []) for (const artist of album.artists ?? []) {
    const artistId = String(artist.neteaseArtistId ?? "");
    if (!/^\d+$/u.test(artistId) || artistId === "0") continue;
    if (!byArtist.has(artistId)) byArtist.set(artistId, { artistId, artistName: artist.name, albums: [], signatures: new Map() });
    const genres = genreSet(album.coreGenres);
    const evidence = byArtist.get(artistId);
    evidence.albums.push({ albumId: album.neteaseAlbumId, title: album.title, coreGenres: genres });
    if (genres.length) evidence.signatures.set(signature(genres), genres);
  }
  return byArtist;
}

function classifyAlbum(payload, evidenceByArtist) {
  const artists = (payload?.album?.artists ?? []).map((artist) => ({ artistId: String(artist.id ?? ""), artistName: String(artist.name ?? "") }));
  const evidence = artists.map((artist) => {
    const current = evidenceByArtist.get(artist.artistId);
    return { ...artist, productionAlbums: current?.albums ?? [], observedGenreSets: current ? [...current.signatures.values()] : [] };
  });
  const withEvidence = evidence.filter((item) => item.observedGenreSets.length > 0);
  if (!withEvidence.length) return { confidence: "NO_EVIDENCE", proposedCoreGenres: [], artists, evidence };
  const stable = evidence.every((item) => item.observedGenreSets.length === 1);
  const proposals = uniqueStable(evidence.flatMap((item) => item.observedGenreSets.length === 1 ? [signature(item.observedGenreSets[0])] : []));
  if (stable && proposals.length === 1) return { confidence: "HIGH_CONFIDENCE", proposedCoreGenres: proposals[0].split("|"), artists, evidence };
  return { confidence: "AMBIGUOUS", proposedCoreGenres: [], artists, evidence };
}

function groupKey(item) {
  return JSON.stringify({ artistIds: item.artists.map((artist) => artist.artistId).sort(), confidence: item.confidence, proposedCoreGenres: item.proposedCoreGenres });
}

function humanReview(proposal) {
  const lines = ["# Bulk taxonomy grouped review", "", `Batch: ${proposal.batchId}`, `Proposal fingerprint: ${proposal.fingerprint}`, `Albums: ${proposal.counts.albums}`, `Groups: ${proposal.counts.groups}`, "", "All entries are PROPOSED, not human accepted.", ""];
  for (const group of proposal.groups) {
    lines.push(`## ${group.groupId}`, "", `Artists: ${group.artists.map((artist) => `${artist.artistName} (${artist.artistId})`).join(" | ")}`, `Confidence: ${group.confidence}`, `Proposed core genres: ${group.proposedCoreGenres.join(" | ") || "NONE"}`, `Albums (${group.albumIds.length}): ${group.albumIds.join(", ")}`, "", "Production evidence:");
    for (const artist of group.evidence) lines.push(`- ${artist.artistName} (${artist.artistId}): ${artist.observedGenreSets.map((genres) => genres.join("|")).join(" / ") || "NO_EVIDENCE"}; ${artist.productionAlbums.length} Album(s)`);
    lines.push("");
  }
  return `${lines.join("\n")}\n`;
}

export async function readTaxonomyProposal(batchRoot) {
  try { return JSON.parse(await readFile(path.join(batchRoot, "taxonomy", "proposal.json"), "utf8")); }
  catch (error) { if (error?.code === "ENOENT") return null; throw error; }
}

export async function buildTaxonomyProposal({ batchRoot, catalogPath }) {
  const finalization = await readAcquisitionFinalization(batchRoot);
  if (!finalization?.acquisitionUsable || finalization.counts.unresolvedBlocking !== 0) throw taxonomyError("ACQUISITION_NOT_USABLE", "Run finalize-acquisition and resolve blocking failures first.");
  const cleanInputFile = path.join(batchRoot, finalization.cleanInput.path);
  const [cleanInput, catalog] = await Promise.all([readFile(cleanInputFile, "utf8").then(JSON.parse), readFile(catalogPath, "utf8").then(JSON.parse)]);
  const cleanInputFingerprint = fingerprint({ ...cleanInput, fingerprint: undefined });
  if (cleanInput.fingerprint !== finalization.cleanInput.fingerprint || cleanInputFingerprint !== cleanInput.fingerprint) throw taxonomyError("CLEAN_INPUT_FINGERPRINT_DRIFT", cleanInputFile);
  if (cleanInput.records?.length !== finalization.counts.clean) throw taxonomyError("CLEAN_INPUT_COUNT_DRIFT", `${cleanInput.records?.length ?? 0}/${finalization.counts.clean}`);
  const allowedCoreGenres = catalog.taxonomy.filter((item) => item.kind === "core").map((item) => item.key).sort();
  const evidenceByArtist = productionEvidence(catalog);
  const albums = [];
  for (const record of cleanInput.records) {
    const payloadFile = path.join(batchRoot, "input", "payloads", `${record.album_id}.json`);
    const payload = JSON.parse(await readFile(payloadFile, "utf8"));
    const classified = classifyAlbum(payload?.payload ?? payload, evidenceByArtist);
    albums.push({ albumId: String(record.album_id), title: String(payload?.payload?.album?.name ?? payload?.album?.name ?? record.expected_title), ...classified, sourcePayload: { path: path.relative(batchRoot, payloadFile).replaceAll("\\", "/"), sha256: await sha256File(payloadFile) } });
  }
  const grouped = new Map();
  for (const album of albums) {
    const key = groupKey(album);
    if (!grouped.has(key)) grouped.set(key, { groupId: `taxonomy-group-${fingerprint(key).slice(0, 16)}`, confidence: album.confidence, proposedCoreGenres: album.proposedCoreGenres, artists: album.artists, albumIds: [], evidence: album.evidence });
    grouped.get(key).albumIds.push(album.albumId);
  }
  const groups = [...grouped.values()].map((group) => ({ ...group, albumIds: group.albumIds.sort((a, b) => a.localeCompare(b, "en-US", { numeric: true })) })).sort((a, b) => a.groupId.localeCompare(b.groupId));
  const counts = {
    albums: albums.length,
    highConfidenceAlbums: albums.filter((item) => item.confidence === "HIGH_CONFIDENCE").length,
    ambiguousAlbums: albums.filter((item) => item.confidence === "AMBIGUOUS").length,
    noEvidenceAlbums: albums.filter((item) => item.confidence === "NO_EVIDENCE").length,
    groups: groups.length,
    highConfidenceGroups: groups.filter((item) => item.confidence === "HIGH_CONFIDENCE").length,
    ambiguousGroups: groups.filter((item) => item.confidence === "AMBIGUOUS").length,
    noEvidenceGroups: groups.filter((item) => item.confidence === "NO_EVIDENCE").length,
  };
  const proposal = { schema: TAXONOMY_PROPOSAL_SCHEMA, batchId: finalization.batchId, acquisitionFinalizationFingerprint: finalization.fingerprint, productionCatalogSha256: await sha256File(catalogPath), allowedCoreGenres, counts, albums, groups };
  proposal.fingerprint = fingerprint(proposal);
  const template = { schema: TAXONOMY_DECISIONS_SCHEMA, batchId: proposal.batchId, proposalFingerprint: proposal.fingerprint, instructions: "Set decision=ACCEPT only after human review. Every accepted group must name one or more allowed coreGenres; PENDING groups remain blocking.", decisions: groups.map((group) => ({ groupId: group.groupId, decision: "PENDING", coreGenres: group.proposedCoreGenres })) };
  const root = path.join(batchRoot, "taxonomy");
  await mkdir(root, { recursive: true });
  await Promise.all([writeFile(path.join(root, "proposal.json"), stableJson(proposal), "utf8"), writeFile(path.join(root, "review-template.json"), stableJson(template), "utf8"), writeFile(path.join(root, "review.md"), humanReview(proposal), "utf8")]);
  return { proposal, paths: { proposal: path.join(root, "proposal.json"), template: path.join(root, "review-template.json"), review: path.join(root, "review.md") } };
}

export async function applyTaxonomyDecisions({ batchRoot, catalogPath, artifact }) {
  const proposal = await readTaxonomyProposal(batchRoot);
  if (!proposal || artifact?.schema !== TAXONOMY_DECISIONS_SCHEMA) throw taxonomyError("INVALID_TAXONOMY_DECISIONS", "Export a current taxonomy review template first.");
  if (artifact.batchId !== proposal.batchId || artifact.proposalFingerprint !== proposal.fingerprint) throw taxonomyError("TAXONOMY_DECISION_DRIFT", "Decisions do not match the current batch/proposal.");
  if (!Array.isArray(artifact.decisions)) throw taxonomyError("INVALID_TAXONOMY_DECISIONS", "decisions must be an array.");
  if (proposal.productionCatalogSha256 !== await sha256File(catalogPath)) throw taxonomyError("TAXONOMY_BASELINE_DRIFT", "Production taxonomy evidence changed.");
  const groups = new Map(proposal.groups.map((group) => [group.groupId, group]));
  const decisionsFile = path.join(batchRoot, "taxonomy", "decisions.json");
  const prior = await readFile(decisionsFile, "utf8").then(JSON.parse).catch((error) => { if (error?.code === "ENOENT") return null; throw error; });
  if (prior && (prior.batchId !== proposal.batchId || prior.proposalFingerprint !== proposal.fingerprint)) throw taxonomyError("TAXONOMY_DECISION_DRIFT", "Stored decisions do not match the current proposal.");
  const accepted = new Map((prior?.decisions ?? []).map((decision) => [decision.groupId, decision]));
  const suppliedGroups = new Set();
  for (const decision of artifact.decisions) {
    if (decision.decision === "PENDING") continue;
    if (decision.decision !== "ACCEPT" || !groups.has(decision.groupId) || suppliedGroups.has(decision.groupId)) throw taxonomyError("INVALID_TAXONOMY_GROUP_DECISION", String(decision.groupId ?? "(missing)"));
    suppliedGroups.add(decision.groupId);
    const coreGenres = genreSet(decision.coreGenres);
    if (!coreGenres.length || coreGenres.some((genre) => !proposal.allowedCoreGenres.includes(genre))) throw taxonomyError("TAXONOMY_GENRE_NOT_ALLOWED", `${decision.groupId}: ${coreGenres.join(",")}`);
    const existing = accepted.get(decision.groupId);
    if (existing && signature(existing.coreGenres) !== signature(coreGenres)) throw taxonomyError("TAXONOMY_DECISION_CONFLICT", decision.groupId);
    accepted.set(decision.groupId, { groupId: decision.groupId, decision: "ACCEPT", coreGenres });
  }
  const decisions = [...accepted.values()].sort((a, b) => a.groupId.localeCompare(b.groupId));
  const unresolvedGroups = proposal.groups.length - decisions.length;
  const decisionRecord = { schema: TAXONOMY_DECISIONS_SCHEMA, batchId: proposal.batchId, proposalFingerprint: proposal.fingerprint, decisions, unresolvedGroups };
  decisionRecord.fingerprint = fingerprint(decisionRecord);
  const root = path.join(batchRoot, "taxonomy");
  await writeFile(decisionsFile, stableJson(decisionRecord), "utf8");
  let activeInput = null;
  if (unresolvedGroups === 0) {
    const finalization = await readAcquisitionFinalization(batchRoot);
    const cleanInput = JSON.parse(await readFile(path.join(batchRoot, finalization.cleanInput.path), "utf8"));
    const decisionByAlbum = new Map();
    for (const group of proposal.groups) for (const albumId of group.albumIds) decisionByAlbum.set(albumId, accepted.get(group.groupId).coreGenres);
    const applied = { ...cleanInput, schema: "content-pipeline-v1/taxonomy-reviewed-input/v1", taxonomyProposalFingerprint: proposal.fingerprint, taxonomyDecisionFingerprint: decisionRecord.fingerprint, records: cleanInput.records.map((record) => ({ ...record, core_genres: decisionByAlbum.get(String(record.album_id)).join("|") })) };
    applied.fingerprint = fingerprint({ ...applied, fingerprint: undefined });
    activeInput = "taxonomy/applied-input.json";
    await writeFile(path.join(batchRoot, activeInput), stableJson(applied), "utf8");
    const configFile = path.join(batchRoot, "batch.json");
    const config = JSON.parse(await readFile(configFile, "utf8"));
    config.operator = { ...(config.operator ?? {}), activeInput, taxonomy: { proposalFingerprint: proposal.fingerprint, decisionFingerprint: decisionRecord.fingerprint, groups: proposal.groups.length } };
    await writeFile(configFile, stableJson(config), "utf8");
  }
  return { decisions: decisionRecord, activeInput, paths: { decisions: path.join(root, "decisions.json"), activeInput: activeInput ? path.join(batchRoot, activeInput) : null } };
}

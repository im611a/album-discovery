const RYM_FIELDS = [
  "rymRating",
  "rymRatingCount",
  "rymReference",
  "rymObservedAt",
  "rymMatchStatus",
  "relatedGenres",
  "descriptors",
];

export function normalizeSyncSeeds(seeds) {
  const seen = new Set();
  const output = [];
  for (const seed of seeds) {
    const albumId = String(seed?.albumId ?? "").trim();
    if (!/^\d+$/.test(albumId) || seen.has(albumId)) continue;
    seen.add(albumId);
    output.push({ ...seed, albumId });
  }
  return output;
}

export function preserveRymFields(nextAlbum, previousAlbum) {
  if (!previousAlbum) return {
    ...nextAlbum,
    rymRating: null,
    rymRatingCount: null,
    rymReference: null,
    rymObservedAt: null,
    rymMatchStatus: "UNVERIFIED_NO_DATA",
    relatedGenres: [],
    descriptors: [],
  };
  return Object.fromEntries([
    ...Object.entries(nextAlbum),
    ...RYM_FIELDS.map((field) => [field, previousAlbum[field] ?? (field === "relatedGenres" || field === "descriptors" ? [] : field === "rymMatchStatus" ? "UNVERIFIED_NO_DATA" : null)]),
  ]);
}

export function resolveSlugCollision(album, albums) {
  const conflict = albums.find((item) => item.slug === album.slug && item.neteaseAlbumId !== album.neteaseAlbumId);
  return conflict ? { ...album, slug: `${album.slug}-${album.neteaseAlbumId}` } : album;
}

export async function runCatalogSync({
  seeds,
  stableCatalog,
  fetchAlbum,
  validateCatalog,
  publishCatalog,
  checkpoint = { processedAlbumIds: [] },
  resume = false,
  dryRun = false,
  limit = Infinity,
  batchSize = 10,
  onCheckpoint = async () => {},
  onFailure = async () => {},
}) {
  const selected = normalizeSyncSeeds(seeds).slice(0, limit);
  const processed = new Set(resume ? checkpoint.processedAlbumIds ?? [] : []);
  const existing = new Map(stableCatalog.albums.map((album) => [album.neteaseAlbumId, album]));
  const candidateAlbums = [...stableCatalog.albums];
  const failures = [];
  const summary = {
    dryRun,
    resume,
    requestedSeeds: seeds.length,
    selectedSeeds: selected.length,
    processed: 0,
    unchanged: 0,
    added: 0,
    updated: 0,
    failed: 0,
    cacheHits: 0,
    batches: 0,
    published: false,
  };

  for (let offset = 0; offset < selected.length; offset += batchSize) {
    const batch = selected.slice(offset, offset + batchSize);
    summary.batches += 1;
    for (const seed of batch) {
      if (processed.has(seed.albumId)) {
        summary.unchanged += 1;
        continue;
      }
      const previous = existing.get(seed.albumId);
      if (previous && !seed.refresh) {
        processed.add(seed.albumId);
        summary.unchanged += 1;
        summary.processed += 1;
        continue;
      }
      try {
        const result = await fetchAlbum(seed);
        if (result.cacheHit) summary.cacheHits += 1;
        let album = preserveRymFields(result.album, previous);
        album = resolveSlugCollision(album, candidateAlbums);
        const previousIndex = candidateAlbums.findIndex((item) => item.neteaseAlbumId === seed.albumId);
        if (previousIndex >= 0) {
          candidateAlbums[previousIndex] = album;
          summary.updated += 1;
        } else {
          candidateAlbums.push(album);
          summary.added += 1;
        }
        processed.add(seed.albumId);
        summary.processed += 1;
      } catch (error) {
        const failure = {
          albumId: seed.albumId,
          category: error?.code ?? "sync_failed",
          message: String(error?.message ?? error),
        };
        failures.push(failure);
        summary.failed += 1;
        await onFailure(failure);
      }
    }
    await onCheckpoint({ processedAlbumIds: [...processed], lastBatchOffset: offset, updatedAt: new Date().toISOString() });
  }

  const candidate = {
    ...stableCatalog,
    refreshDate: new Date().toISOString().slice(0, 10),
    source: {
      ...stableCatalog.source,
      generatedAt: new Date().toISOString(),
      runtimeRequestsAllowed: false,
    },
    albums: candidateAlbums,
  };
  const validation = await validateCatalog(candidate);
  if (!validation.ok) {
    const error = new Error(`Candidate catalog rejected: ${validation.errors.join("; ")}`);
    error.code = "validation_failed";
    throw error;
  }
  if (!dryRun && failures.length === 0) {
    await publishCatalog(candidate);
    summary.published = true;
  }
  return { candidate, failures, summary, checkpoint: { processedAlbumIds: [...processed] } };
}

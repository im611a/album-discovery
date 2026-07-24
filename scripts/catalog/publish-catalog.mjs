import { access, mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { normalizeListeningScenes } from "./listening-scenes.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const defaultInput = path.join(root, "src", "data", "generated", "catalog.json");
const defaultOutput = path.join(root, "src", "data", "generated");

const hasFile = async (file) => {
  try {
    await access(file);
    return true;
  } catch {
    return false;
  }
};

const releaseYear = (album) => {
  const value = Number(album.releaseDate?.slice(0, 4));
  return Number.isInteger(value) ? value : null;
};

const artistSlug = (artist) => `artist-${artist.neteaseArtistId}`;

function withCurrentContracts(album, thumbnailSrc) {
  const contexts = normalizeListeningScenes(album.contexts);
  const rymMatchStatus = album.rymMatchStatus ?? "UNVERIFIED_NO_DATA";
  const matched = ["MATCHED", "MATCHED_EXACT", "MATCHED_ALIAS", "MATCHED_STRONG"].includes(rymMatchStatus);
  return {
    ...album,
    cover: {
      ...album.cover,
      thumbnailSrc: album.cover?.kind === "local" ? thumbnailSrc : null,
    },
    contexts,
    editorial: album.editorial
      ? { ...album.editorial, bestFor: contexts }
      : null,
    rymRating: matched && Number.isFinite(album.rymRating) ? album.rymRating : null,
    rymRatingCount: matched && Number.isInteger(album.rymRatingCount) && album.rymRatingCount >= 0
      ? album.rymRatingCount
      : null,
    rymReference: matched && typeof album.rymReference === "string" ? album.rymReference : null,
    rymObservedAt: matched && typeof album.rymObservedAt === "string" ? album.rymObservedAt : null,
    rymInputSourceId: matched && typeof album.rymInputSourceId === "string" ? album.rymInputSourceId : null,
    rymMatchStatus,
  };
}

function toSummary(album) {
  return {
    internalId: album.internalId,
    id: album.id,
    neteaseAlbumId: album.neteaseAlbumId,
    slug: album.slug,
    title: album.title,
    aliases: album.aliases,
    artists: album.artists,
    releaseDate: album.releaseDate,
    releaseDatePrecision: album.releaseDatePrecision,
    releaseYear: releaseYear(album),
    albumType: album.albumType,
    cover: album.cover,
    thumbnailPath: album.cover.thumbnailSrc,
    discoveredAt: album.discoveredAt,
    sourceMarketChannels: album.sourceMarketChannels,
    coreGenres: album.coreGenres,
    relatedGenres: album.relatedGenres,
    contexts: album.contexts,
    rymRating: album.rymRating,
    rymRatingCount: album.rymRatingCount,
    editorial: album.editorial,
    searchText: album.searchText,
  };
}

function buildArtistIndex(albums, generatedAt) {
  const artists = new Map();
  for (const album of albums) {
    for (const artist of album.artists) {
      const current = artists.get(artist.id) ?? {
        artistId: artist.id,
        neteaseArtistId: artist.neteaseArtistId,
        slug: artistSlug(artist),
        name: artist.name,
        aliases: [],
        albums: [],
      };
      if (!current.albums.some((item) => item.id === album.id)) current.albums.push(album);
      artists.set(artist.id, current);
    }
  }
  return {
    version: 1,
    generatedAt,
    artists: [...artists.values()].map((artist) => {
      const years = artist.albums.map(releaseYear).filter(Number.isInteger);
      const genreCounts = new Map();
      const albumCountByType = {};
      for (const album of artist.albums) {
        albumCountByType[album.albumType] = (albumCountByType[album.albumType] ?? 0) + 1;
        for (const genre of album.coreGenres) genreCounts.set(genre, (genreCounts.get(genre) ?? 0) + 1);
      }
      return {
        artistId: artist.artistId,
        neteaseArtistId: artist.neteaseArtistId,
        slug: artist.slug,
        name: artist.name,
        aliases: artist.aliases,
        albumCount: artist.albums.length,
        albumCountByType,
        earliestYear: years.length ? Math.min(...years) : null,
        latestYear: years.length ? Math.max(...years) : null,
        commonCoreGenres: [...genreCounts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 4).map(([key]) => key),
        albumIds: artist.albums.map((album) => album.id),
        previewCovers: artist.albums.map((album) => album.cover.thumbnailSrc).filter(Boolean).slice(0, 3),
      };
    }).sort((a, b) => a.name.localeCompare(b.name, "zh-CN")),
  };
}

export async function buildPublication(catalog) {
  const albums = [];
  for (const album of catalog.albums) {
    const thumbnailFile = path.join(root, "public", "catalog", "covers", "thumb", `${album.neteaseAlbumId}.webp`);
    const detailFile = path.join(root, "public", "catalog", "covers", "detail", `${album.neteaseAlbumId}.webp`);
    const thumbnailSrc = await hasFile(thumbnailFile)
      ? `/catalog/covers/thumb/${album.neteaseAlbumId}.webp`
      : album.cover?.src ?? null;
    const detailSrc = await hasFile(detailFile)
      ? `/catalog/covers/detail/${album.neteaseAlbumId}.webp`
      : album.cover?.src ?? null;
    albums.push(withCurrentContracts({ ...album, cover: { ...album.cover, src: detailSrc } }, thumbnailSrc));
  }
  const generatedAt = catalog.source?.generatedAt ?? new Date().toISOString();
  const source = { ...catalog.source, runtimeRequestsAllowed: false };
  const base = { ...catalog, source, albums };
  const index = {
    ...catalog,
    source,
    albums: albums.map(toSummary),
  };
  const artistIndex = buildArtistIndex(albums, generatedAt);
  return { catalog: base, index, artistIndex };
}

async function writePublicationDirectory(directory, publication) {
  await mkdir(path.join(directory, "album-details"), { recursive: true });
  await writeFile(path.join(directory, "catalog.json"), `${JSON.stringify(publication.catalog, null, 2)}\n`, "utf8");
  await writeFile(path.join(directory, "catalog-index.json"), `${JSON.stringify(publication.index, null, 2)}\n`, "utf8");
  await writeFile(path.join(directory, "artist-index.json"), `${JSON.stringify(publication.artistIndex, null, 2)}\n`, "utf8");
  for (const album of publication.catalog.albums) {
    await writeFile(path.join(directory, "album-details", `${album.slug}.json`), `${JSON.stringify(album, null, 2)}\n`, "utf8");
  }
  const manifest = {
    albums: publication.catalog.albums.length,
    artists: publication.artistIndex.artists.length,
    details: publication.catalog.albums.length,
    ratedAlbums: publication.catalog.albums.filter((album) => album.rymRating != null).length,
    relatedGenreAlbums: publication.catalog.albums.filter((album) => album.relatedGenres.length > 0).length,
    explorationVersion: 1,
    generatedAt: publication.catalog.source.generatedAt,
    runtimeRequestsAllowed: false,
  };
  await writeFile(path.join(directory, "catalog.manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
}

export async function publishCatalog(catalog, outputDirectory = defaultOutput) {
  const publication = await buildPublication(catalog);
  const parent = path.dirname(outputDirectory);
  const next = path.join(parent, `.generated-next-${process.pid}-${Date.now()}`);
  const previous = path.join(parent, `.generated-previous-${process.pid}-${Date.now()}`);
  await writePublicationDirectory(next, publication);
  let movedPrevious = false;
  try {
    if (await hasFile(outputDirectory)) {
      await rename(outputDirectory, previous);
      movedPrevious = true;
    }
    await rename(next, outputDirectory);
    if (movedPrevious) await rm(previous, { recursive: true, force: true });
  } catch (error) {
    await rm(next, { recursive: true, force: true });
    if (movedPrevious && !(await hasFile(outputDirectory))) await rename(previous, outputDirectory);
    throw error;
  }
  return publication;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const input = path.resolve(process.argv[2] ?? defaultInput);
  const catalog = JSON.parse(await readFile(input, "utf8"));
  const publication = await publishCatalog(catalog);
  console.log(`Published ${publication.catalog.albums.length} albums and ${publication.artistIndex.artists.length} artists.`);
}

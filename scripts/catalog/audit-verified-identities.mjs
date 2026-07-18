import path from "node:path";
import { CANDIDATES } from "./curation-manifest.mjs";
import { ROOT, fetchJsonCached, normalizeIdentity, readJson } from "./lib/catalog-utils.mjs";

const document = await readJson(path.join(ROOT, "scripts", "catalog", "verified-identities.json"));
const identities = new Map((document?.identities ?? []).map((identity) => [identity.key, identity]));
if (CANDIDATES.length !== 120 || identities.size !== 120) throw new Error("Expected 120 curated candidates and 120 fixed identities.");

const artistNames = (credit = []) => credit.map((item) => item.name || item.artist?.name).filter(Boolean);

for (const [index, candidate] of CANDIDATES.entries()) {
  const identity = identities.get(candidate.key);
  if (!identity) throw new Error(`Missing fixed identity for ${candidate.key}`);
  process.stdout.write(`[${index + 1}/${CANDIDATES.length}] ${candidate.key} ... `);
  const detail = await fetchJsonCached(
    "musicbrainz-verified-identity",
    candidate.key,
    `https://musicbrainz.org/ws/2/release-group/${identity.verifiedReleaseGroupId}?inc=artists&fmt=json`,
  );
  const acceptedTitles = [identity.expectedTitle, ...(identity.acceptedTitleVariants ?? [])].map(normalizeIdentity);
  const expectedArtist = normalizeIdentity(identity.expectedPrimaryArtist);
  const artistMatches = artistNames(detail["artist-credit"]).some((name) => {
    const actual = normalizeIdentity(name);
    return expectedArtist.includes(actual) || actual.includes(expectedArtist);
  });
  if (detail.id !== identity.verifiedReleaseGroupId || !acceptedTitles.includes(normalizeIdentity(detail.title)) || !artistMatches) throw new Error(`Identity mismatch for ${candidate.key}`);
  if (!String(detail["first-release-date"] ?? "").startsWith(identity.expectedFirstReleaseYear)) throw new Error(`First-release year mismatch for ${candidate.key}`);
  if (detail["primary-type"] !== identity.expectedPrimaryType) throw new Error(`Primary type mismatch for ${candidate.key}`);
  console.log("verified");
}

console.log("All 120 fixed MusicBrainz release-group identities still match their reviewed contracts.");

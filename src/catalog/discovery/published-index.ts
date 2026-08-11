import { catalogAlbums, publishedArtists } from "../published-catalog";
import { buildDiscoveryIndex } from "./relation-index";

/**
 * Deterministic discovery foundation derived only from the published local
 * catalog snapshot. No product query or route consumes this index in R13-3A.
 */
export const publishedDiscoveryIndex = buildDiscoveryIndex(catalogAlbums, publishedArtists);

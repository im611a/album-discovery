import type { NormalizedPersonalState, PersonalizationPathContext } from "./types";

const MAX_RECENT_ALBUMS = 20;
const MAX_PATH_ALBUMS = 12;
const MAX_SIGNAL_VALUES = 64;

const objectValue = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};

function strings(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && item.length > 0) : [];
}

function canonical(values: readonly string[], allowed?: ReadonlySet<string>, limit = allowed?.size ?? MAX_SIGNAL_VALUES) {
  const output = new Set<string>();
  for (const value of values) {
    if ((!allowed || allowed.has(value)) && !output.has(value)) output.add(value);
    if (output.size === limit) break;
  }
  return Object.freeze([...output].sort());
}

function recent(values: readonly string[], allowed: ReadonlySet<string>) {
  const seen = new Set<string>();
  const output: string[] = [];
  for (const value of values) {
    if (!allowed.has(value) || seen.has(value)) continue;
    seen.add(value);
    output.push(value);
    if (output.length === MAX_RECENT_ALBUMS) break;
  }
  return Object.freeze(output);
}

export function normalizePersonalState(value: unknown, catalogAlbumIds: ReadonlySet<string>): NormalizedPersonalState {
  const input = objectValue(value);
  const taste = objectValue(input.taste);
  const feedback = objectValue(input.recommendationFeedback);
  const feedbackLiked = Object.entries(feedback).filter(([, status]) => status === "like").map(([id]) => id);
  const feedbackDismissed = Object.entries(feedback).filter(([, status]) => status === "not_for_me").map(([id]) => id);
  const dismissed = new Set(canonical([...strings(input.dismissedAlbumIds), ...feedbackDismissed], catalogAlbumIds));
  const withoutDismissed = (items: readonly string[]) => canonical(items, catalogAlbumIds).filter((id) => !dismissed.has(id));
  const exploration = ["familiar", "balanced", "exploratory"].includes(String(taste.exploration))
    ? taste.exploration as "familiar" | "balanced" | "exploratory"
    : "balanced";
  return Object.freeze({
    taste: Object.freeze({
      genres: canonical(strings(taste.genres)),
      contexts: canonical(strings(taste.contexts)),
      eras: canonical(strings(taste.eras)),
      seedAlbumIds: Object.freeze(withoutDismissed(strings(taste.seedAlbumIds))),
      exploration,
    }),
    likedAlbumIds: Object.freeze(withoutDismissed([...strings(input.likedAlbumIds), ...feedbackLiked])),
    favoriteAlbumIds: Object.freeze(withoutDismissed(strings(input.favoriteAlbumIds))),
    savedAlbumIds: Object.freeze(withoutDismissed(strings(input.savedAlbumIds))),
    listenedAlbumIds: Object.freeze(withoutDismissed(strings(input.listenedAlbumIds))),
    dismissedAlbumIds: Object.freeze([...dismissed].sort()),
    recentAlbumIds: Object.freeze(recent(strings(input.recentAlbumIds), catalogAlbumIds).filter((id) => !dismissed.has(id))),
    onboardingCompleted: input.onboardingCompleted === true,
  });
}

export function normalizePersonalizationPath(value: unknown, catalogAlbumIds: ReadonlySet<string>): PersonalizationPathContext {
  const input = objectValue(value);
  const output: string[] = [];
  for (const albumId of strings(input.visitedAlbumIds)) {
    if (!catalogAlbumIds.has(albumId) || output.at(-1) === albumId) continue;
    output.push(albumId);
  }
  return Object.freeze({
    visitedAlbumIds: Object.freeze(output.slice(-MAX_PATH_ALBUMS)),
    step: Number.isSafeInteger(input.step) && Number(input.step) >= 0 ? Number(input.step) : 0,
  });
}

export function advancePersonalizationPath(path: PersonalizationPathContext, albumId: string, catalogAlbumIds: ReadonlySet<string>) {
  return normalizePersonalizationPath({ visitedAlbumIds: [...path.visitedAlbumIds, albumId], step: path.step + 1 }, catalogAlbumIds);
}

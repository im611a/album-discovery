import type { PublishedAlbumSummary } from "@/catalog/schema";

export interface TasteProfile {
  genres: string[];
  descriptors: string[];
  contexts: string[];
  eras: string[];
  seedAlbumIds: string[];
  exploration: "familiar" | "balanced" | "exploratory";
}

export interface LocalUserStateV1 {
  version: 1;
  taste: TasteProfile;
  favoriteAlbumIds: string[];
  savedAlbumIds: string[];
  listenedAlbumIds: string[];
  dismissedAlbumIds: string[];
  recommendationFeedback: Record<string, "like" | "not_for_me">;
  recentAlbumIds: string[];
  onboardingCompleted: boolean;
  updatedAt: string;
}

export const EMPTY_TASTE: TasteProfile = { genres: [], descriptors: [], contexts: [], eras: [], seedAlbumIds: [], exploration: "balanced" };
export const createInitialUserState = (): LocalUserStateV1 => ({ version: 1, taste: EMPTY_TASTE, favoriteAlbumIds: [], savedAlbumIds: [], listenedAlbumIds: [], dismissedAlbumIds: [], recommendationFeedback: {}, recentAlbumIds: [], onboardingCompleted: false, updatedAt: new Date(0).toISOString() });

const strings = (value: unknown) => Array.isArray(value) && value.every((item) => typeof item === "string");
const legacyDescriptorKeys: Record<string, string> = {
  "层次丰富": "layered", "朦胧": "hazy", "空间感": "spacious", "旋律性": "melodic",
  "叙事性": "narrative", "沉浸": "immersive", "即兴": "improvised", "律动": "groovy",
  "亲密": "intimate", "强劲": "intense", "明亮": "bright", "缓慢": "gradual",
};

function migrateLocalUserState(value: unknown): Partial<LocalUserStateV1> | null {
  if (!value || typeof value !== "object") return null;
  const input = value as Partial<LocalUserStateV1> & { version?: unknown };
  if (input.version === 1) return input;
  if (input.version !== undefined) return null;
  const looksHistorical = "taste" in input || "favoriteAlbumIds" in input || "savedAlbumIds" in input || "recommendationFeedback" in input;
  if (!looksHistorical) return null;
  return {
    ...createInitialUserState(),
    ...input,
    version: 1,
    taste: { ...EMPTY_TASTE, ...(input.taste ?? {}) },
  };
}

export function parseLocalUserState(value: unknown, albumIds: Set<string>): LocalUserStateV1 | null {
  const migrated = migrateLocalUserState(value);
  if (!migrated) return null;
  const input = migrated;
  const taste = input.taste as Partial<TasteProfile> | undefined;
  if (!taste || !strings(taste.genres) || !strings(taste.descriptors) || !strings(taste.contexts) || !strings(taste.eras) || !strings(taste.seedAlbumIds) || !["familiar", "balanced", "exploratory"].includes(String(taste.exploration))) return null;
  if (!strings(input.favoriteAlbumIds) || !strings(input.savedAlbumIds) || !strings(input.listenedAlbumIds) || !strings(input.dismissedAlbumIds) || !strings(input.recentAlbumIds)) return null;
  const feedback = input.recommendationFeedback;
  if (!feedback || typeof feedback !== "object" || Object.values(feedback).some((item) => item !== "like" && item !== "not_for_me")) return null;
  const reconcile = (items: string[] = []) => [...new Set(items.filter((id) => albumIds.has(id)))];
  const recommendationFeedback = Object.fromEntries(Object.entries(feedback).filter(([id]) => albumIds.has(id))) as Record<string, "like" | "not_for_me">;
  const favorites = reconcile(input.favoriteAlbumIds);
  const dismissed = reconcile(input.dismissedAlbumIds);
  const explicitNotForMe = new Set([...dismissed, ...Object.entries(recommendationFeedback).filter(([, item]) => item === "not_for_me").map(([id]) => id)]);
  for (const id of favorites) if (!explicitNotForMe.has(id)) recommendationFeedback[id] = "like";
  for (const id of dismissed) recommendationFeedback[id] = "not_for_me";
  const notForMeIds = new Set(Object.entries(recommendationFeedback).filter(([, item]) => item === "not_for_me").map(([id]) => id));
  const likedIds = new Set(Object.entries(recommendationFeedback).filter(([, item]) => item === "like").map(([id]) => id));
  return {
    version: 1,
    taste: { genres: [...new Set(taste.genres)], descriptors: [...new Set(taste.descriptors.map((item) => legacyDescriptorKeys[item] ?? item))], contexts: [...new Set(taste.contexts)], eras: [...new Set(taste.eras)], seedAlbumIds: reconcile(taste.seedAlbumIds), exploration: taste.exploration as TasteProfile["exploration"] },
    favoriteAlbumIds: [...likedIds].filter((id) => !notForMeIds.has(id)), savedAlbumIds: reconcile(input.savedAlbumIds).filter((id) => !notForMeIds.has(id)), listenedAlbumIds: reconcile(input.listenedAlbumIds), dismissedAlbumIds: [...notForMeIds].filter((id) => !likedIds.has(id)), recentAlbumIds: reconcile(input.recentAlbumIds).slice(0, 20),
    recommendationFeedback,
    onboardingCompleted: Boolean(input.onboardingCompleted),
    updatedAt: typeof input.updatedAt === "string" ? input.updatedAt : new Date(0).toISOString(),
  };
}

export function stateHasAlbum(state: LocalUserStateV1, album: PublishedAlbumSummary, key: "favoriteAlbumIds" | "savedAlbumIds" | "listenedAlbumIds" | "dismissedAlbumIds") {
  return state[key].includes(album.id);
}

import type { PersonalEvidence, PersonalExplanation } from "./types";

export function explanationForEvidence(evidence: PersonalEvidence): PersonalExplanation {
  return Object.freeze({
    key: `personal.${evidence.family.toLowerCase()}` as PersonalExplanation["key"],
    evidence,
  });
}

export const relationFallbackExplanation: PersonalExplanation = Object.freeze({
  key: "relation.fallback",
  evidence: null,
});

export function explanationClaim(explanation: PersonalExplanation) {
  const item = explanation.evidence;
  if (!item) return "来自独立的目录关系后备，不属于个性化证据。";
  if (item.family === "RECENT_VIEW_BRIDGE") return "与最近查看过的专辑保留了可验证的目录重合。";
  if (item.family === "MARKED_LISTENED_BRIDGE") return "与明确标记为听过的专辑保留了可验证的目录重合。";
  if (item.family === "SAVED_ALBUM_BRIDGE") return "与想听清单中的专辑保留了可验证的目录重合。";
  if (item.family === "LIKED_ALBUM_BRIDGE" || item.family === "FAVORITE_ALBUM_BRIDGE" || item.family === "SEED_ALBUM_BRIDGE") return "与明确选择、喜欢或收藏的专辑保留了可验证的目录重合。";
  return "与明确选择的本机口味信号重合。";
}

export const LISTENING_SCENES = [
  ["commute", "通勤"],
  ["night", "夜间"],
  ["solitude", "独处"],
  ["focus", "学习与专注"],
  ["relax", "放松"],
  ["drive", "驾车"],
  ["exercise", "运动"],
  ["social", "聚会"],
] as const;

export type ListeningSceneKey = (typeof LISTENING_SCENES)[number][0];

const labels = new Map<string, string>(LISTENING_SCENES);

export function getListeningSceneLabel(value: string) {
  return labels.get(value) ?? value;
}

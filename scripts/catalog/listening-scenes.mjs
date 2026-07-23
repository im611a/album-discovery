export const LISTENING_SCENES = [
  ["commute", "通勤"],
  ["night", "夜间"],
  ["solitude", "独处"],
  ["focus", "学习与专注"],
  ["relax", "放松"],
  ["drive", "驾车"],
  ["exercise", "运动"],
  ["social", "聚会"],
];

const legacyMap = new Map([
  ["通勤", "commute"],
  ["夜晚", "night"],
  ["深夜", "night"],
  ["独处", "solitude"],
  ["专注聆听", "focus"],
  ["工作", "focus"],
  ["阅读歌词", "focus"],
  ["周末", "relax"],
  ["清晨", "relax"],
  ["放松", "relax"],
  ["运动", "exercise"],
  ["晚餐", "social"],
]);

const valid = new Set(LISTENING_SCENES.map(([key]) => key));

export function normalizeListeningScenes(values) {
  return [...new Set((Array.isArray(values) ? values : [])
    .map((value) => legacyMap.get(String(value)) ?? String(value))
    .filter((value) => valid.has(value)))]
    .slice(0, 3);
}

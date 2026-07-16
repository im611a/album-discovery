export const SITE_NAME = "专辑发现";

/**
 * 仅用于 v0.2 本地 Mock 首页演示低样本过滤。
 * 这不是 RYM 官方规则，也不是未来生产环境的默认值。
 */
export const V0_2_HOME_MOCK_MIN_RYM_RATING_COUNT = 2_500;

/** v0.2 首页固定入口使用来源标签；显示文字统一由 getDisplayLabel 提供。 */
export const V0_2_HOME_PRIMARY_GENRES = [
  "Art Pop",
  "Indie Rock",
  "Electronic",
  "Ambient",
  "Post-Rock",
  "Alternative R&B",
] as const;

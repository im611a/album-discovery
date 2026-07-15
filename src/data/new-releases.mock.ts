/**
 * 阶段 0.2C 静态原型专用的虚构新发行来源上下文。
 * 记录只关联本地虚构专辑，不对应网易云真实接口、专辑或频道结果。
 */

export const MARKET_CHANNEL_VALUES = ["ALL", "ZH", "EA", "JP", "KR"] as const;

export type MarketChannel = (typeof MARKET_CHANNEL_VALUES)[number];

export type MockNewReleaseSourceContext = {
  albumId: string;
  sourceMarketChannel: MarketChannel;
  sourceListEndpoint: string;
  discoveredAt: string;
};

function sourceContext(
  albumId: string,
  sourceMarketChannel: MarketChannel,
  discoveredAt: string,
): MockNewReleaseSourceContext {
  return {
    albumId,
    sourceMarketChannel,
    sourceListEndpoint: `mock:new-releases:${sourceMarketChannel}`,
    discoveredAt,
  };
}

export const newReleaseSourceContextMock: MockNewReleaseSourceContext[] = [
  sourceContext("mock-001", "ALL", "2026-07-16T01:00:00.000Z"),
  sourceContext("mock-002", "ALL", "2026-07-16T01:01:00.000Z"),
  sourceContext("mock-018", "ALL", "2026-07-16T01:02:00.000Z"),
  sourceContext("mock-001", "ZH", "2026-07-16T02:00:00.000Z"),
  sourceContext("mock-003", "ZH", "2026-07-16T02:01:00.000Z"),
  sourceContext("mock-005", "ZH", "2026-07-16T02:02:00.000Z"),
  sourceContext("mock-007", "ZH", "2026-07-16T02:03:00.000Z"),
  sourceContext("mock-008", "ZH", "2026-07-16T02:04:00.000Z"),
  sourceContext("mock-009", "ZH", "2026-07-16T02:05:00.000Z"),
  sourceContext("mock-011", "ZH", "2026-07-16T02:06:00.000Z"),
  sourceContext("mock-018", "ZH", "2026-07-16T02:07:00.000Z"),
  sourceContext("mock-002", "EA", "2026-07-16T03:00:00.000Z"),
  sourceContext("mock-004", "EA", "2026-07-16T03:01:00.000Z"),
  sourceContext("mock-006", "EA", "2026-07-16T03:02:00.000Z"),
  sourceContext("mock-010", "EA", "2026-07-16T03:03:00.000Z"),
  sourceContext("mock-012", "EA", "2026-07-16T03:04:00.000Z"),
  sourceContext("mock-014", "EA", "2026-07-16T03:05:00.000Z"),
  sourceContext("mock-016", "EA", "2026-07-16T03:06:00.000Z"),
  sourceContext("mock-018", "EA", "2026-07-16T03:07:00.000Z"),
  sourceContext("mock-002", "JP", "2026-07-16T04:00:00.000Z"),
  sourceContext("mock-007", "JP", "2026-07-16T04:01:00.000Z"),
  sourceContext("mock-013", "JP", "2026-07-16T04:02:00.000Z"),
  sourceContext("mock-015", "JP", "2026-07-16T04:03:00.000Z"),
  sourceContext("mock-018", "JP", "2026-07-16T04:04:00.000Z"),
  sourceContext("mock-001", "KR", "2026-07-16T05:00:00.000Z"),
  sourceContext("mock-006", "KR", "2026-07-16T05:01:00.000Z"),
  sourceContext("mock-012", "KR", "2026-07-16T05:02:00.000Z"),
  sourceContext("mock-017", "KR", "2026-07-16T05:03:00.000Z"),
];

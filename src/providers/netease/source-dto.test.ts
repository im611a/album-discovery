import { describe, expect, expectTypeOf, it } from "vitest";

import {
  NETEASE_SOURCE_PARSER_VERSION,
  type NeteaseAlbumSourceDto,
  type NeteaseNewReleaseRecordDto,
  type NeteaseParserResult,
} from "@/providers/netease/source-dto";
import type { UtcIsoTimestamp } from "@/domain/sources";

describe("NetEase source DTO contracts", () => {
  it("uses an explicit parser contract version", () => {
    expect(NETEASE_SOURCE_PARSER_VERSION).toBe("0.3A.1");
  });

  it("keeps parser failure separate from a partial DTO", () => {
    expectTypeOf<NeteaseParserResult<NeteaseAlbumSourceDto>["data"]>().toEqualTypeOf<
      NeteaseAlbumSourceDto | null
    >();
  });

  it("models market channel as new-release source context", () => {
    expectTypeOf<NeteaseNewReleaseRecordDto["requestedMarketChannel"]>().toEqualTypeOf<
      "ALL" | "ZH" | "EA" | "JP" | "KR"
    >();
    expectTypeOf<NeteaseAlbumSourceDto>().not.toHaveProperty("requestedMarketChannel");
    expectTypeOf<NeteaseNewReleaseRecordDto["fetchedAt"]>().toEqualTypeOf<UtcIsoTimestamp>();
  });
});

import { describe, expect, it } from "vitest";
import { isSafeExternalUrl, normalizeIdentity, partialDate } from "./lib/catalog-utils.mjs";

describe("catalog build utilities", () => {
  it.each([
    ["2024", "year"],
    ["2024-02", "month"],
    ["2024-02-29", "day"],
  ])("accepts honest partial date %s", (value, precision) => expect(partialDate(value)).toEqual({ value, precision }));

  it.each(["2023-02-29", "2024-13", "2024-00", "2024-04-31", "2024-1", "text", ""])("rejects invalid date %s", (value) => expect(partialDate(value)).toBeNull());
  it("only permits HTTPS external destinations", () => {
    expect(isSafeExternalUrl("https://music.apple.com/album/1")).toBe(true);
    expect(isSafeExternalUrl("http://example.com/album")).toBe(false);
    expect(isSafeExternalUrl("javascript:alert(1)")).toBe(false);
  });
  it("normalizes punctuation and case for identity comparison", () => expect(normalizeIdentity("What’s  Going On")).toBe("what s going on"));
});

import { describe, expect, it } from "vitest";
import { normalizePage, paginate } from "./pagination";

describe("catalog pagination", () => {
  const values = Array.from({ length: 105 }, (_, index) => index + 1);
  it("returns deterministic first and second pages", () => {
    expect(paginate(values, null, 48).items).toEqual(values.slice(0, 48));
    expect(paginate(values, "2", 48).items).toEqual(values.slice(48, 96));
  });
  it("safely normalizes invalid and out-of-range pages", () => {
    expect(normalizePage("bad", 3)).toBe(1);
    expect(normalizePage("-1", 3)).toBe(1);
    expect(normalizePage("99", 3)).toBe(3);
  });
  it("reports full totals without rendering every item", () => {
    const page = paginate(values, "1", 48);
    expect(page).toMatchObject({ total: 105, page: 1, pageCount: 3 });
    expect(page.items).toHaveLength(48);
  });
});

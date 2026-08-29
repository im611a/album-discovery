import { describe, expect, it } from "vitest";
import { analyzeRgbBytes, deriveSafeAccent, rgbToHsl, VISUAL_COLOR_TAGS } from "./visual-color-analysis.mjs";

function pixels(...colors) {
  return Uint8Array.from(colors.flatMap(([red, green, blue, count = 1]) => Array.from({ length: count }, () => [red, green, blue]).flat()));
}

describe("offline visual color analysis", () => {
  it("maps primary RGB hues without average-color collapse", () => {
    expect(rgbToHsl(255, 0, 0).hue).toBe(0);
    expect(analyzeRgbBytes(pixels([230, 25, 20, 8], [10, 10, 10, 2])).primaryVisualColor).toBe("red");
    expect(analyzeRgbBytes(pixels([15, 80, 230, 8], [240, 240, 240, 2])).primaryVisualColor).toBe("blue");
  });

  it("retains multiple visual tags and one deterministic primary", () => {
    const result = analyzeRgbBytes(pixels([230, 20, 20, 3], [20, 210, 70, 3], [20, 90, 230, 3], [235, 190, 20, 3]));
    expect(result.visualColorTags).toContain("multicolor");
    expect(VISUAL_COLOR_TAGS).toContain(result.primaryVisualColor);
    expect(result.dominantColors).toHaveLength(3);
  });

  it("classifies monochrome and dark evidence independently", () => {
    const result = analyzeRgbBytes(pixels([5, 5, 5, 8], [35, 35, 35, 2]));
    expect(result.visualColorTags).toEqual(expect.arrayContaining(["mono", "dark"]));
    expect(result.primaryVisualColor).toBe("mono");
  });

  it("clamps UI accents to the approved saturation and luminance envelope", () => {
    for (const source of ["#ff0000", "#000001", "#ffffff", "#00ff66", "#555577"]) {
      const accent = deriveSafeAccent(source);
      const hsl = rgbToHsl(
        Number.parseInt(accent.slice(1, 3), 16),
        Number.parseInt(accent.slice(3, 5), 16),
        Number.parseInt(accent.slice(5, 7), 16),
      );
      expect(hsl.saturation).toBeGreaterThanOrEqual(0.275);
      expect(hsl.saturation).toBeLessThanOrEqual(0.625);
      expect(hsl.luminance).toBeGreaterThanOrEqual(0.375);
      expect(hsl.luminance).toBeLessThanOrEqual(0.585);
    }
  });

  it("rejects malformed decoder output", () => {
    expect(() => analyzeRgbBytes(new Uint8Array())).toThrow(/RGB24/);
    expect(() => analyzeRgbBytes(Uint8Array.from([1, 2]))).toThrow(/RGB24/);
  });
});

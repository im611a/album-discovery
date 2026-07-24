import { describe, expect, it } from "vitest";
import { getRouteMotionLevel } from "./route-motion";

describe("route motion levels", () => {
  it.each([
    ["/", "A"],
    ["/albums/ok-computer", "B"],
    ["/artists/artist-1", "B"],
    ["/genres/core/pop", "B"],
    ["/discover", "C"],
    ["/search", "C"],
    ["/settings", "D"],
    ["/about", "D"],
  ])("maps %s to level %s", (pathname, level) => {
    expect(getRouteMotionLevel(pathname)).toBe(level);
  });
});

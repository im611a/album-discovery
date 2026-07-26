import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  EditorialMotion,
  getDeckActiveIndex,
  getGalleryItemProgress,
  getScrollProgress,
} from "./editorial-motion";

const revert = vi.fn();
const add = vi.fn((callback: () => (() => void) | void) => {
  callback();
  return { revert };
});

vi.mock("animejs", () => ({
  animate: vi.fn(),
  createScope: vi.fn(() => ({ add })),
}));

describe("EditorialMotion", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: vi.fn(() => ({ matches: false }) as MediaQueryList),
    });
    vi.stubGlobal("requestAnimationFrame", vi.fn((callback: FrameRequestCallback) => {
      callback(0);
      return 1;
    }));
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
  });

  it("scopes Anime.js and reverts it on unmount", () => {
    const { unmount, container } = render(<EditorialMotion><p data-motion-opening-copy>内容</p></EditorialMotion>);
    expect(container.querySelector("[data-editorial-motion]")).toHaveAttribute("data-motion-ready", "true");
    unmount();
    expect(revert).toHaveBeenCalled();
  });

  it("keeps all content visible when reduced motion is active", () => {
    const matchMedia = vi.fn(() => ({ matches: true }) as MediaQueryList);
    Object.defineProperty(window, "matchMedia", { configurable: true, value: matchMedia });
    const { getByText } = render(<EditorialMotion><p>完整内容</p></EditorialMotion>);
    expect(getByText("完整内容")).toBeVisible();
    expect(add).not.toHaveBeenCalled();
  });

  it("computes reversible gallery progress and stable deck indexes", () => {
    expect(getScrollProgress(0, 0, 2300, 1000)).toBe(0);
    expect(getScrollProgress(650, 0, 2300, 1000)).toBe(.5);
    expect(getScrollProgress(1300, 0, 2300, 1000)).toBe(1);
    expect(getGalleryItemProgress(.05, 0, 9)).toBe(0);
    expect(getGalleryItemProgress(.3, 0, 9)).toBeGreaterThan(.9);
    expect(getGalleryItemProgress(.05, 0, 9)).toBeLessThan(getGalleryItemProgress(.3, 0, 9));
    expect(getDeckActiveIndex(0, 3)).toBe(0);
    expect(getDeckActiveIndex(.34, 3)).toBe(1);
    expect(getDeckActiveIndex(.99, 3)).toBe(2);
  });

  it("marks unrevealed gallery links as non-interactive in full motion mode", () => {
    const { container } = render(
      <EditorialMotion>
        <section data-motion-gallery>
          <article data-motion-gallery-item><button type="button">专辑</button></article>
        </section>
      </EditorialMotion>,
    );
    expect(container.querySelector("button")).toHaveAttribute("tabindex", "-1");
  });

  it("keeps an offscreen record stage out of the tab order", () => {
    const { container } = render(
      <EditorialMotion>
        <section data-motion-deck>
          <article data-motion-deck-item><a href="/albums/example">专辑</a></article>
        </section>
      </EditorialMotion>,
    );
    expect(container.querySelector("a")).toHaveAttribute("tabindex", "-1");
  });
});

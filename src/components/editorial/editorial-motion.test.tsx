import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { EditorialMotion } from "./editorial-motion";

const revert = vi.fn();
const add = vi.fn((callback: () => (() => void) | void) => {
  callback();
  return { revert };
});

vi.mock("animejs", () => ({
  animate: vi.fn(),
  stagger: vi.fn(() => 0),
  createScope: vi.fn(() => ({ add })),
}));

describe("EditorialMotion", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: vi.fn(() => ({ matches: false }) as MediaQueryList),
    });
  });

  it("scopes Anime.js and reverts it on unmount", () => {
    const { unmount, container } = render(<EditorialMotion><p data-motion-opening>内容</p></EditorialMotion>);
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
});

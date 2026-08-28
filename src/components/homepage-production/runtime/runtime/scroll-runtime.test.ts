import { afterEach, describe, expect, it, vi } from "vitest";

import { createScrollRuntime } from "./scroll-runtime.js";
import { calculateMarkerState } from "../marker/marker.js";

describe("homepage vinyl dock states", () => {
  it("moves from hero to dock and releases at the gallery boundary", () => {
    expect(calculateMarkerState(800, 3000, 900, 1440)).toMatchObject({ phase: "hero", progress: 0, opacity: 1 });
    const dock = calculateMarkerState(200, 2000, 900, 1440);
    expect(dock.phase).toBe("dock");
    expect(dock.scale).toBeGreaterThanOrEqual(0.4);
    expect(dock.scale).toBeLessThan(0.5);
    expect(dock.opacity).toBe(1);
    expect(calculateMarkerState(100, 100, 900, 1440)).toMatchObject({ phase: "release", opacity: 0 });
  });
});

describe("homepage pointer preservation", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    document.body.replaceChildren();
  });

  it("moves Gallery pointer layers and removes its listener on dispose", () => {
    const requestFrame = vi.fn((callback: FrameRequestCallback) => {
      void callback;
      return 7;
    });
    const cancelFrame = vi.fn();
    vi.stubGlobal("requestAnimationFrame", requestFrame);
    vi.stubGlobal("cancelAnimationFrame", cancelFrame);
    vi.stubGlobal("innerWidth", 1000);
    vi.stubGlobal("innerHeight", 800);
    vi.stubGlobal("matchMedia", vi.fn((query: string) => ({ matches: query === "(pointer: fine)" })));

    document.body.innerHTML = `
      <main data-homepage-root>
        <figure class="ad-poster ad-poster--large">
          <span class="ad-poster__pointer"><span class="ad-poster__par"></span></span>
        </figure>
        <div class="ad-fixed"><div class="ad-marker"><span class="ad-marker__surface"></span></div></div>
        <section class="ad-stage"></section>
        <section class="ad-gallery"></section>
      </main>`;
    const root = document.querySelector<HTMLElement>("[data-homepage-root]")!;
    const stageElement = root.querySelector<HTMLElement>(".ad-stage")!;
    Object.defineProperty(stageElement, "offsetHeight", { configurable: true, value: 1600 });
    vi.spyOn(stageElement, "getBoundingClientRect").mockReturnValue({ top: 0, height: 1600 } as DOMRect);
    const gallery = root.querySelector<HTMLElement>(".ad-gallery")!;
    vi.spyOn(gallery, "getBoundingClientRect").mockReturnValue({ top: 300, bottom: 1200, height: 900 } as DOMRect);
    const marker = root.querySelector<HTMLElement>(".ad-marker")!;
    vi.spyOn(marker, "getBoundingClientRect").mockReturnValue({ left: 350, top: 250, width: 300, height: 300 } as DOMRect);
    const poster = root.querySelector<HTMLElement>(".ad-poster")!;
    vi.spyOn(poster, "getBoundingClientRect").mockReturnValue({ top: 100, height: 300 } as DOMRect);

    const add = vi.spyOn(window, "addEventListener");
    const remove = vi.spyOn(window, "removeEventListener");
    const stage = { setProgress: vi.fn(), update: vi.fn() };
    const runtime = createScrollRuntime(root, stage);

    window.dispatchEvent(new MouseEvent("pointermove", { clientX: 610, clientY: 400 }));
    const scheduledFrame = requestFrame.mock.calls[0]?.[0];
    expect(scheduledFrame).toBeTypeOf("function");
    scheduledFrame?.(16);

    expect(root.querySelector<HTMLElement>(".ad-poster__pointer")!.style.transform).toBe("translate(-3.56px,0.00px)");
    expect(marker.style.getPropertyValue("--ad-marker-opacity")).not.toBe("");
    expect(marker.style.getPropertyValue("--ad-vinyl-tilt-y")).not.toBe("0.00deg");
    expect(add).toHaveBeenCalledWith("pointermove", expect.any(Function), { passive: true });
    expect(stage.setProgress).toHaveBeenCalledWith(expect.any(Number), false);
    expect(stage.update).toHaveBeenCalled();

    runtime.dispose();
    expect(cancelFrame).toHaveBeenCalled();
    expect(remove).toHaveBeenCalledWith("pointermove", expect.any(Function));
  });

  it("suppresses pointer and Gallery parallax motion when reduced motion is requested", () => {
    const requestFrame = vi.fn((callback: FrameRequestCallback) => {
      void callback;
      return 9;
    });
    vi.stubGlobal("requestAnimationFrame", requestFrame);
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
    vi.stubGlobal("innerWidth", 1000);
    vi.stubGlobal("innerHeight", 800);
    vi.stubGlobal("matchMedia", vi.fn().mockReturnValue({ matches: true }));

    document.body.innerHTML = `
      <main data-homepage-root>
        <figure class="ad-poster ad-poster--large">
          <span class="ad-poster__pointer"><span class="ad-poster__par"></span></span>
        </figure>
        <div class="ad-fixed"><div class="ad-marker"><span class="ad-marker__surface"></span></div></div>
        <section class="ad-stage"></section>
        <section class="ad-gallery"></section>
      </main>`;
    const root = document.querySelector<HTMLElement>("[data-homepage-root]")!;
    const stageElement = root.querySelector<HTMLElement>(".ad-stage")!;
    Object.defineProperty(stageElement, "offsetHeight", { configurable: true, value: 1600 });
    vi.spyOn(stageElement, "getBoundingClientRect").mockReturnValue({ top: 0, height: 1600 } as DOMRect);
    const gallery = root.querySelector<HTMLElement>(".ad-gallery")!;
    vi.spyOn(gallery, "getBoundingClientRect").mockReturnValue({ top: 300, bottom: 1200, height: 900 } as DOMRect);
    const poster = root.querySelector<HTMLElement>(".ad-poster")!;
    vi.spyOn(poster, "getBoundingClientRect").mockReturnValue({ top: 100, height: 300 } as DOMRect);

    const add = vi.spyOn(window, "addEventListener");
    const remove = vi.spyOn(window, "removeEventListener");
    const stage = { setProgress: vi.fn(), update: vi.fn() };
    const runtime = createScrollRuntime(root, stage);
    window.dispatchEvent(new MouseEvent("pointermove", { clientX: 0, clientY: 400 }));
    requestFrame.mock.calls[0]?.[0]?.(16);

    expect(root.querySelector<HTMLElement>(".ad-poster__pointer")!.style.transform).toBe("");
    expect(root.querySelector<HTMLElement>(".ad-poster__par")!.style.transform).toBe("none");
    expect(add).not.toHaveBeenCalledWith("pointermove", expect.any(Function), expect.anything());
    expect(stage.setProgress).toHaveBeenCalledWith(expect.any(Number), true);
    expect(stage.update).toHaveBeenCalled();

    runtime.dispose();
    expect(remove).not.toHaveBeenCalledWith("pointermove", expect.any(Function));
  });
});

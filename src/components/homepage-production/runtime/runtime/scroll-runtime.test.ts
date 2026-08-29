import { afterEach, describe, expect, it, vi } from "vitest";

import { createScrollRuntime } from "./scroll-runtime.js";
import { calculateMarkerState, clampDockOffset } from "../marker/marker.js";

function dispatchPointer(target: Element, type: string, init: MouseEventInit & { pointerId: number }) {
  const event = new MouseEvent(type, init);
  Object.defineProperty(event, "pointerId", { value: init.pointerId });
  Object.defineProperty(event, "isPrimary", { value: true });
  target.dispatchEvent(event);
}

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

  it("keeps manual dock offsets inside the navigation and viewport safe area", () => {
    const baseRect = { left: 700, top: 280, width: 180, height: 180 };
    const viewport = { width: 1000, height: 700 };
    expect(clampDockOffset({ x: -900, y: -900 }, baseRect, viewport)).toEqual({ x: -684, y: -176 });
    expect(clampDockOffset({ x: 900, y: 900 }, baseRect, viewport)).toEqual({ x: 104, y: 224 });
    expect(clampDockOffset({ x: 95, y: 215 }, baseRect, viewport, { snapThreshold: 24 })).toEqual({ x: 104, y: 224 });
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

  it("reuses the single runtime frame for edge pointer, docked vinyl, and release recovery", () => {
    const frames: FrameRequestCallback[] = [];
    vi.stubGlobal("requestAnimationFrame", vi.fn((callback: FrameRequestCallback) => {
      frames.push(callback);
      return frames.length;
    }));
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
    vi.stubGlobal("innerWidth", 1000);
    vi.stubGlobal("innerHeight", 800);
    vi.stubGlobal("matchMedia", vi.fn((query: string) => ({ matches: query === "(pointer: fine)" })));
    document.body.innerHTML = `
      <main data-homepage-root>
        <div class="ad-ambient-flow"></div>
        <div class="ad-fixed"><div class="ad-marker"><span class="ad-marker__surface"></span></div></div>
        <section class="ad-stage"></section>
        <section class="ad-gallery"></section>
      </main>`;
    const root = document.querySelector<HTMLElement>("[data-homepage-root]")!;
    const stageElement = root.querySelector<HTMLElement>(".ad-stage")!;
    Object.defineProperty(stageElement, "offsetHeight", { configurable: true, value: 1600 });
    vi.spyOn(stageElement, "getBoundingClientRect").mockReturnValue({ top: 0, height: 1600 } as DOMRect);
    const gallery = root.querySelector<HTMLElement>(".ad-gallery")!;
    const galleryRect = vi.spyOn(gallery, "getBoundingClientRect").mockReturnValue({ top: 200, bottom: 1200, height: 1000 } as DOMRect);
    const marker = root.querySelector<HTMLElement>(".ad-marker")!;
    vi.spyOn(marker, "getBoundingClientRect").mockImplementation(() => {
      const x = Number.parseFloat(marker.style.getPropertyValue("--ad-marker-drag-x")) || 0;
      const y = Number.parseFloat(marker.style.getPropertyValue("--ad-marker-drag-y")) || 0;
      return { left: 350 + x, right: 650 + x, top: 250 + y, bottom: 550 + y, width: 300, height: 300 } as DOMRect;
    });
    const runtime = createScrollRuntime(root, { setProgress: vi.fn(), update: vi.fn() });
    const flow = root.querySelector<HTMLElement>(".ad-ambient-flow")!;
    const runFrames = (count: number) => {
      for (let index = 0; index < count; index += 1) frames.shift()?.(index * 16);
    };

    runFrames(1);
    expect(root.querySelector<HTMLElement>(".ad-fixed")!.dataset.markerPhase).toBe("dock");
    window.dispatchEvent(new MouseEvent("pointermove", { clientX: 0, clientY: 400 }));
    runFrames(24);
    const pointerPeak = Number(flow.dataset.flowPointerEnergy);
    expect(pointerPeak).toBeGreaterThan(0.65);
    expect(flow.style.getPropertyValue("--flow-edge-left")).not.toBe("0.0000");
    root.dispatchEvent(new Event("pointerleave"));
    runFrames(70);
    expect(Number(flow.dataset.flowPointerEnergy)).toBeLessThan(pointerPeak * 0.05);

    dispatchPointer(marker, "pointerdown", { pointerId: 5, button: 0, clientX: 500, clientY: 400, bubbles: true, cancelable: true });
    dispatchPointer(marker, "pointermove", { pointerId: 5, clientX: 1000, clientY: 400, bubbles: true, cancelable: true });
    dispatchPointer(marker, "pointerup", { pointerId: 5, clientX: 1000, clientY: 400, bubbles: true, cancelable: true });
    runFrames(30);
    expect(Number(flow.dataset.flowVinylEnergy)).toBeGreaterThan(0.75);
    expect(Number(flow.style.getPropertyValue("--flow-edge-right")))
      .toBeGreaterThan(Number(flow.style.getPropertyValue("--flow-edge-left")));

    galleryRect.mockReturnValue({ top: 0, bottom: 100, height: 100 } as DOMRect);
    runFrames(90);
    expect(flow.dataset.flowMarkerPhase).toBe("release");
    expect(Number(flow.dataset.flowVinylEnergy)).toBeLessThan(0.005);
    runtime.dispose();
    expect(flow.dataset.flowPointerEnergy).toBe("0.0000");
    expect(flow.dataset.flowVinylEnergy).toBe("0.0000");
    expect(flow.dataset.flowMarkerPhase).toBeUndefined();
  });

  it("drags only the docked desktop vinyl, preserves its release position, and resets on hero return", () => {
    const frames: FrameRequestCallback[] = [];
    vi.stubGlobal("requestAnimationFrame", vi.fn((callback: FrameRequestCallback) => {
      frames.push(callback);
      return frames.length;
    }));
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
    vi.stubGlobal("innerWidth", 1000);
    vi.stubGlobal("innerHeight", 800);
    vi.stubGlobal("matchMedia", vi.fn((query: string) => ({ matches: query === "(pointer: fine)" })));
    document.body.innerHTML = `
      <main data-homepage-root>
        <div class="ad-fixed"><div class="ad-marker"><span class="ad-marker__surface"></span></div></div>
        <section class="ad-stage"></section>
        <section class="ad-gallery"></section>
      </main>`;
    const root = document.querySelector<HTMLElement>("[data-homepage-root]")!;
    const stageElement = root.querySelector<HTMLElement>(".ad-stage")!;
    Object.defineProperty(stageElement, "offsetHeight", { configurable: true, value: 1600 });
    vi.spyOn(stageElement, "getBoundingClientRect").mockReturnValue({ top: 0, height: 1600 } as DOMRect);
    const gallery = root.querySelector<HTMLElement>(".ad-gallery")!;
    const galleryRect = vi.spyOn(gallery, "getBoundingClientRect").mockReturnValue({ top: 300, bottom: 1200, height: 900 } as DOMRect);
    const marker = root.querySelector<HTMLElement>(".ad-marker")!;
    vi.spyOn(marker, "getBoundingClientRect").mockReturnValue({ left: 350, top: 250, width: 300, height: 300 } as DOMRect);
    const runtime = createScrollRuntime(root, { setProgress: vi.fn(), update: vi.fn() });

    frames.shift()?.(16);
    expect(root.querySelector<HTMLElement>(".ad-fixed")!.dataset.markerPhase).toBe("dock");
    expect(marker.dataset.dragEnabled).toBe("true");
    dispatchPointer(marker, "pointerdown", { pointerId: 4, button: 0, clientX: 500, clientY: 400, bubbles: true, cancelable: true });
    dispatchPointer(marker, "pointermove", { pointerId: 4, clientX: 1000, clientY: 800, bubbles: true, cancelable: true });
    dispatchPointer(marker, "pointerup", { pointerId: 4, clientX: 1000, clientY: 800, bubbles: true, cancelable: true });
    expect(marker.style.getPropertyValue("--ad-marker-drag-x")).toBe("334.00px");
    expect(marker.style.getPropertyValue("--ad-marker-drag-y")).toBe("234.00px");
    expect(marker.dataset.dragging).toBeUndefined();

    galleryRect.mockReturnValue({ top: 0, bottom: 100, height: 100 } as DOMRect);
    frames.shift()?.(32);
    expect(root.dataset.markerPhase).toBe("release");
    expect(marker.style.getPropertyValue("--ad-marker-drag-x")).toBe("334.00px");

    galleryRect.mockReturnValue({ top: 800, bottom: 2000, height: 1200 } as DOMRect);
    frames.shift()?.(48);
    expect(root.dataset.markerPhase).toBe("hero");
    expect(marker.style.getPropertyValue("--ad-marker-drag-x")).toBe("0.00px");
    expect(marker.style.getPropertyValue("--ad-marker-drag-y")).toBe("0.00px");
    runtime.dispose();
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

    const marker = root.querySelector<HTMLElement>(".ad-marker")!;
    vi.spyOn(marker, "getBoundingClientRect").mockReturnValue({ left: 350, top: 250, width: 300, height: 300 } as DOMRect);
    expect(marker.dataset.dragEnabled).toBe("true");
    dispatchPointer(marker, "pointerdown", { pointerId: 8, button: 0, clientX: 500, clientY: 400, bubbles: true, cancelable: true });
    dispatchPointer(marker, "pointermove", { pointerId: 8, clientX: 560, clientY: 440, bubbles: true, cancelable: true });
    dispatchPointer(marker, "pointerup", { pointerId: 8, clientX: 560, clientY: 440, bubbles: true, cancelable: true });
    expect(marker.style.getPropertyValue("--ad-marker-drag-x")).toBe("60.00px");
    expect(marker.style.getPropertyValue("--ad-marker-drag-y")).toBe("40.00px");

    runtime.dispose();
    expect(remove).not.toHaveBeenCalledWith("pointermove", expect.any(Function));
  });
});

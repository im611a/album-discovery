import { describe, expect, it } from "vitest";

import {
  applyAmbientFlow,
  approachFlowInfluence,
  calculatePointFlowInfluence,
  calculateRectFlowInfluence,
  createEmptyFlowInfluence,
} from "./ambient-flow.js";

describe("homepage ambient flow field", () => {
  const viewport = { width: 1440, height: 900 };

  it("creates edge-local pointer influence instead of a viewport spotlight", () => {
    const left = calculatePointFlowInfluence({ x: 20, y: 420 }, viewport, 180);
    const center = calculatePointFlowInfluence({ x: 720, y: 450 }, viewport, 180);
    expect(left.left).toBeGreaterThan(0.85);
    expect(left.right).toBe(0);
    expect(left.top).toBe(0);
    expect(center.energy).toBe(0);
  });

  it("uses the vinyl rectangle and gives its edge response more visual weight", () => {
    const pointer = calculatePointFlowInfluence({ x: 10, y: 450 }, viewport, 180);
    const vinyl = calculateRectFlowInfluence({ left: 1220, top: 340, width: 190, height: 190 }, viewport, 240);
    const element = document.createElement("div");
    applyAmbientFlow(element, pointer, vinyl, viewport);
    expect(Number(element.style.getPropertyValue("--flow-edge-right")))
      .toBeGreaterThan(Number(element.style.getPropertyValue("--flow-edge-left")));
    expect(Number(element.dataset.flowVinylEnergy)).toBeGreaterThan(0.8);
    expect(Number.parseFloat(element.style.getPropertyValue("--flow-focus-x"))).toBeGreaterThan(900);
  });

  it("returns smoothly to a zero-energy baseline", () => {
    const active = calculatePointFlowInfluence({ x: 0, y: 450 }, viewport);
    const baseline = createEmptyFlowInfluence(viewport);
    let current = active;
    for (let frame = 0; frame < 90; frame += 1) {
      current = approachFlowInfluence(current, baseline, 0.06);
    }
    expect(current.energy).toBeLessThan(0.004);
    expect(current.x).toBeGreaterThan(710);
  });
});

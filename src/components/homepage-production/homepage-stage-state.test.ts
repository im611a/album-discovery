import { describe, expect, it } from "vitest";
import { homepageContent } from "./homepage-data-adapter";
import {
  getHomepageStageIndex,
  getHomepageStageIndexForCamera,
  getHomepageStageReferencePose,
  getHomepageStageState,
  getHomepageStageTargetX,
  getHomepageVinylLifecycle,
  HOMEPAGE_STAGE_REFERENCE,
  stepHomepageVinylMotion,
} from "./homepage-stage-state";

function simulateVinylMotion(start: number, target: number, durationMs: number) {
  let state = { progress: start, velocity: 0 };
  for (let elapsed = 0; elapsed < durationMs; elapsed += 1000 / 60) {
    state = stepHomepageVinylMotion(
      state.progress,
      target,
      state.velocity,
      Math.min(1000 / 60, durationMs - elapsed),
    );
  }
  return state;
}

describe("homepage reference Stage contract", () => {
  it("preserves /01 through /06 and approved title mappings", () => {
    expect(homepageContent.stage.map((item) => item.displayNumber)).toEqual(["/01", "/02", "/03", "/04", "/05", "/06"]);
    expect(homepageContent.stage.map((_, index) => getHomepageStageState(homepageContent.stage, index)?.current.albumId))
      .toEqual(homepageContent.stage.map((item) => item.albumId));
  });

  it("has no previous at first, no next at last, and does not loop", () => {
    const first = getHomepageStageState(homepageContent.stage, -10);
    const middle = getHomepageStageState(homepageContent.stage, 2);
    const last = getHomepageStageState(homepageContent.stage, 99);
    expect(first?.previous).toBeNull();
    expect(first?.currentIndex).toBe(0);
    expect(middle?.previous?.albumId).toBe(homepageContent.stage[1].albumId);
    expect(middle?.next?.albumId).toBe(homepageContent.stage[3].albumId);
    expect(last?.currentIndex).toBe(5);
    expect(last?.next).toBeNull();
  });

  it("uses the captured 220 lead-in and 280 units per album", () => {
    const count = 6;
    const spacing = 2.5;
    const total = count * HOMEPAGE_STAGE_REFERENCE.itemUnits + HOMEPAGE_STAGE_REFERENCE.leadInUnits;
    expect(getHomepageStageTargetX(0, count, spacing)).toBe(0);
    expect(getHomepageStageTargetX(HOMEPAGE_STAGE_REFERENCE.leadInUnits / total, count, spacing)).toBe(0);
    expect(getHomepageStageTargetX(1, count, spacing)).toBe(spacing * 5);
  });

  it("derives the active release from the moving reference camera", () => {
    expect(getHomepageStageIndexForCamera(0, 6, 2)).toBe(0);
    expect(getHomepageStageIndexForCamera(2.98, 6, 2)).toBe(1);
    expect(getHomepageStageIndexForCamera(3.02, 6, 2)).toBe(2);
    expect(getHomepageStageIndexForCamera(100, 6, 2)).toBe(5);
  });

  it("reproduces the captured previous/current/next perspective geometry", () => {
    const spacing = 2;
    const scale = 1.5;
    const cameraX = spacing * 2;
    const previous = getHomepageStageReferencePose(1, cameraX, spacing, scale);
    const current = getHomepageStageReferencePose(2, cameraX, spacing, scale);
    const next = getHomepageStageReferencePose(3, cameraX, spacing, scale);

    expect(current.relativeX).toBe(0);
    expect(current.z).toBeCloseTo(0);
    expect(current.rotationY).toBeCloseTo(0);
    expect(current.scaleX).toBe(scale);
    expect(previous.worldX).toBe(spacing);
    expect(previous.relativeX).toBe(-spacing);
    expect(previous.rotationY).toBe(0.4);
    expect(previous.scaleX).toBeCloseTo(scale * 0.84);
    expect(next.relativeX).toBe(spacing);
    expect(next.rotationY).toBe(-0.4);
    expect(next.scaleX).toBeCloseTo(scale * 0.84);
  });

  it("keeps objects in world coordinates while camera progress moves", () => {
    const before = getHomepageStageReferencePose(3, 1, 2, 1);
    const after = getHomepageStageReferencePose(3, 2, 2, 1);
    expect(before.worldX).toBe(after.worldX);
    expect(after.relativeX).toBe(before.relativeX - 1);
  });

  it("clamps progress to a valid Stage index without a fixed active anchor", () => {
    expect(getHomepageStageIndex(-1, 6)).toBe(0);
    expect(getHomepageStageIndex(2, 6)).toBe(5);
    expect(getHomepageStageIndex(0.5, 6)).toBeGreaterThanOrEqual(0);
    expect(getHomepageStageIndex(0.5, 6)).toBeLessThan(6);
  });

  it("keeps the exact captured interpolation and vinyl constants", () => {
    expect(HOMEPAGE_STAGE_REFERENCE).toMatchObject({
      cameraEase: 0.085,
      vinylSpinStep: 0.012,
      desktopSpacingRatio: 1.65,
      mobileSpacingRatio: 1.72,
      desktopVinylExposure: 0.58,
      mobileVinylExposure: 0.34,
      firstVinylEjectUnits: 320,
      vinylDiameterRatio: 0.97,
      vinylEmergeSmoothTimeMs: 380,
      vinylRetractSmoothTimeMs: 330,
    });
  });

  it("starts slowly, then settles with more physical weight while retracting slightly faster", () => {
    const emerge100 = simulateVinylMotion(0, 1, 100).progress;
    const emerge300 = simulateVinylMotion(0, 1, 300).progress;
    const emerge800 = simulateVinylMotion(0, 1, 800).progress;
    const retract100 = simulateVinylMotion(1, 0, 100).progress;
    const retract300 = simulateVinylMotion(1, 0, 300).progress;
    const retract800 = simulateVinylMotion(1, 0, 800).progress;

    expect(emerge100).toBeLessThan(.14);
    expect(emerge300).toBeGreaterThan(.4);
    expect(emerge300).toBeLessThan(.56);
    expect(emerge800).toBeGreaterThan(.9);
    expect(emerge800).toBeLessThan(.97);
    expect(retract100).toBeGreaterThan(.82);
    expect(retract300).toBeGreaterThan(.35);
    expect(retract300).toBeLessThan(.52);
    expect(retract800).toBeLessThan(.06);
    expect(1 - retract300).toBeGreaterThan(emerge300);
  });

  it("retargets the current vinyl trajectory without queuing stale destinations", () => {
    const emerging = simulateVinylMotion(0, 1, 240);
    const reversing = stepHomepageVinylMotion(
      emerging.progress,
      0,
      emerging.velocity,
      1000 / 60,
    );
    const latest = stepHomepageVinylMotion(
      reversing.progress,
      .72,
      reversing.velocity,
      1000 / 60,
    );

    expect(emerging.progress).toBeGreaterThan(0);
    expect(reversing.progress).toBeLessThan(emerging.progress);
    expect(reversing.velocity).toBeLessThan(0);
    expect(latest.progress).toBeGreaterThan(reversing.progress);
    expect(latest.velocity).toBeGreaterThan(0);
    expect(latest.progress).toBeLessThan(.72);
  });

  it("snaps vinyl travel to the latest target under reduced motion", () => {
    expect(stepHomepageVinylMotion(.2, 1, .4, 16, true)).toEqual({ progress: 1, velocity: 0 });
    expect(stepHomepageVinylMotion(.8, 0, -.4, 16, true)).toEqual({ progress: 0, velocity: 0 });
  });

  it("uses the expanded lead-in domain to reveal only a small crescent at Stage 3%", () => {
    const early = getHomepageVinylLifecycle(0.03, 0, 6);
    const middle = getHomepageVinylLifecycle(0.06, 0, 6);
    const settled = getHomepageVinylLifecycle(320 / 1900, 0.3, 6);
    expect(early).toMatchObject({ ownerIndex: 0, incomingIndex: 0, ejectProgress: 57 / 320 });
    expect(middle.ejectProgress).toBe(114 / 320);
    expect(settled.ejectProgress).toBe(1);
    expect(early.groupEjectProgress).toEqual([57 / 320, 0, 0, 0, 0, 0]);
  });

  it("keeps the outgoing record after the active camera index has switched", () => {
    const transition = getHomepageVinylLifecycle(0.204, 0.51, 6);
    expect(transition.activeIndex).toBe(1);
    expect(transition.outgoingIndex).toBe(0);
    expect(transition.incomingIndex).toBe(1);
    expect(transition.ownerIndex).toBe(0);
    expect(transition.ejectProgress).toBeGreaterThan(0.5);
    expect(transition.groupEjectProgress[1]).toBe(0);
  });

  it("delays ownership handoff, then lets incoming eject while outgoing finishes retracting", () => {
    const before = getHomepageVinylLifecycle(0.204, 0.51, 6);
    const after = getHomepageVinylLifecycle(0.23, 0.57, 6);
    const incomingSettled = getHomepageVinylLifecycle(0.28, 0.9, 6);
    const settled = getHomepageVinylLifecycle((220 + 1680 / 5) / 1900, 1, 6);
    expect(before.ownerIndex).toBe(0);
    expect(before.groupEjectProgress[1]).toBe(0);
    expect(after.ownerIndex).toBe(1);
    expect(after.groupEjectProgress[0]).toBeGreaterThan(0);
    expect(after.ejectProgress).toBeGreaterThan(0);
    expect(incomingSettled.groupEjectProgress[0]).toBe(0);
    expect(incomingSettled.ejectProgress).toBe(1);
    expect(settled).toMatchObject({ ownerIndex: 1, ejectProgress: 1 });
  });

  it("keeps both record trajectories continuous across the discrete ownership handoff", () => {
    const before = getHomepageVinylLifecycle(0.22, 0.56 - 0.000001, 6);
    const after = getHomepageVinylLifecycle(0.22, 0.56 + 0.000001, 6);

    expect(before.ownerIndex).toBe(0);
    expect(after.ownerIndex).toBe(1);
    expect(after.groupEjectProgress[0]).toBeCloseTo(before.groupEjectProgress[0], 4);
    expect(before.groupEjectProgress[1]).toBe(0);
    expect(after.groupEjectProgress[1]).toBeLessThan(0.000001);
  });

  it("retracts the outgoing record and ejects the incoming record monotonically across the wider handoff", () => {
    const progresses = [0.204, 0.215, 0.225, 0.235, 0.245, 0.255, 0.265, 0.276];
    const positions = progresses.map((progress) =>
      getHomepageStageTargetX(progress, 6, 1));
    const states = progresses.map((progress, index) =>
      getHomepageVinylLifecycle(progress, positions[index], 6));
    const outgoing = states.map((state) => state.groupEjectProgress[0]);
    const incoming = states.map((state) => state.groupEjectProgress[1]);

    expect(states[0].ownerIndex).toBe(0);
    expect(states.at(-1)?.ownerIndex).toBe(1);
    expect(outgoing.every((value, index) => index === 0 || value <= outgoing[index - 1])).toBe(true);
    expect(incoming.every((value, index) => index === 0 || value >= incoming[index - 1])).toBe(true);
    expect(states[0].groupEjectProgress[1]).toBe(0);
    expect(states.at(-1)?.groupEjectProgress[0]).toBe(0);
    expect(states.at(-1)?.groupEjectProgress[1]).toBe(1);
  });

  it("is exactly reversible because lifecycle is derived from scroll and camera state", () => {
    const forward = [0.2, 0.45, 0.67, 0.71, 0.9].map((position) =>
      getHomepageVinylLifecycle(0.24, position, 6));
    const reverse = [0.9, 0.71, 0.67, 0.45, 0.2].map((position) =>
      getHomepageVinylLifecycle(0.24, position, 6));
    expect(reverse).toEqual([...forward].reverse());
  });
});

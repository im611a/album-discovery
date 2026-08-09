import type { HomepageAlbum } from "./homepage-data-adapter";

export const HOMEPAGE_STAGE_REFERENCE = Object.freeze({
  leadInUnits: 220,
  itemUnits: 280,
  cameraEase: 0.085,
  vinylSpinStep: 0.012,
  desktopSpacingRatio: 1.65,
  mobileSpacingRatio: 1.72,
  desktopVinylExposure: 0.58,
  mobileVinylExposure: 0.34,
  firstVinylEjectUnits: 240,
  vinylRetractStart: 0.4,
  vinylOwnershipHandoff: 0.52,
  vinylRetractEnd: 0.68,
  vinylIncomingSettled: 0.7,
  vinylDiameterRatio: 0.97,
  vinylLabelRadiusRatio: 0.3,
});

function clamp(value: number, minimum: number, maximum: number) {
  return Math.max(minimum, Math.min(maximum, value));
}

function smoothstep(value: number) {
  const progress = clamp(value, 0, 1);
  return progress * progress * (3 - 2 * progress);
}

export interface HomepageVinylLifecycle {
  activeIndex: number;
  outgoingIndex: number | null;
  incomingIndex: number | null;
  ownerIndex: number | null;
  ejectProgress: number;
  groupEjectProgress: readonly number[];
}

export function getHomepageVinylLifecycle(
  stageProgress: number,
  cameraAlbumPosition: number,
  count: number,
): HomepageVinylLifecycle {
  if (count <= 0) {
    return {
      activeIndex: -1,
      outgoingIndex: null,
      incomingIndex: null,
      ownerIndex: null,
      ejectProgress: 0,
      groupEjectProgress: [],
    };
  }

  const activeIndex = clamp(Math.round(cameraAlbumPosition), 0, count - 1);
  const groupEjectProgress = Array.from({ length: count }, () => 0);
  const safeStageProgress = clamp(stageProgress, 0, 1);
  const stageUnits = safeStageProgress
    * (count * HOMEPAGE_STAGE_REFERENCE.itemUnits + HOMEPAGE_STAGE_REFERENCE.leadInUnits);

  if (cameraAlbumPosition <= 1e-4) {
    const ejectProgress = clamp(
      stageUnits / HOMEPAGE_STAGE_REFERENCE.firstVinylEjectUnits,
      0,
      1,
    );
    groupEjectProgress[0] = ejectProgress;
    return {
      activeIndex,
      outgoingIndex: null,
      incomingIndex: 0,
      ownerIndex: 0,
      ejectProgress,
      groupEjectProgress,
    };
  }

  const safeCameraPosition = clamp(cameraAlbumPosition, 0, count - 1);
  const outgoingIndex = Math.min(Math.floor(safeCameraPosition), count - 1);
  const incomingIndex = Math.min(outgoingIndex + 1, count - 1);
  const transitionProgress = safeCameraPosition - outgoingIndex;
  if (outgoingIndex === incomingIndex || transitionProgress <= 1e-4) {
    groupEjectProgress[outgoingIndex] = 1;
    return {
      activeIndex,
      outgoingIndex,
      incomingIndex: null,
      ownerIndex: outgoingIndex,
      ejectProgress: 1,
      groupEjectProgress,
    };
  }

  const {
    vinylRetractStart,
    vinylOwnershipHandoff,
    vinylRetractEnd,
    vinylIncomingSettled,
  } = HOMEPAGE_STAGE_REFERENCE;
  const outgoingEjectProgress = 1 - smoothstep(
    (transitionProgress - vinylRetractStart)
      / (vinylRetractEnd - vinylRetractStart),
  );
  if (transitionProgress < vinylOwnershipHandoff) {
    groupEjectProgress[outgoingIndex] = outgoingEjectProgress;
    return {
      activeIndex,
      outgoingIndex,
      incomingIndex,
      ownerIndex: outgoingIndex,
      ejectProgress: outgoingEjectProgress,
      groupEjectProgress,
    };
  }

  const ejectProgress = smoothstep(
    (transitionProgress - vinylOwnershipHandoff)
      / (vinylIncomingSettled - vinylOwnershipHandoff),
  );
  groupEjectProgress[outgoingIndex] = outgoingEjectProgress;
  groupEjectProgress[incomingIndex] = ejectProgress;
  return {
    activeIndex,
    outgoingIndex,
    incomingIndex,
    ownerIndex: incomingIndex,
    ejectProgress,
    groupEjectProgress,
  };
}

export interface HomepageStageReferencePose {
  worldX: number;
  relativeX: number;
  z: number;
  rotationY: number;
  scaleX: number;
}

export function getHomepageStageTargetX(
  progress: number,
  count: number,
  spacing: number,
) {
  if (count <= 1) return 0;
  const safeProgress = clamp(progress, 0, 1);
  const total = count * HOMEPAGE_STAGE_REFERENCE.itemUnits
    + HOMEPAGE_STAGE_REFERENCE.leadInUnits;
  const travelled = Math.max(
    0,
    (safeProgress * total - HOMEPAGE_STAGE_REFERENCE.leadInUnits)
      / (count * HOMEPAGE_STAGE_REFERENCE.itemUnits),
  );
  return travelled * spacing * (count - 1);
}

export function getHomepageStageIndexForCamera(
  cameraX: number,
  count: number,
  spacing: number,
) {
  if (count <= 0 || spacing <= 0) return -1;
  return clamp(Math.round(cameraX / spacing), 0, count - 1);
}

export function getHomepageStageReferencePose(
  index: number,
  cameraX: number,
  spacing: number,
  scale: number,
): HomepageStageReferencePose {
  const worldX = index * spacing;
  const relativeX = worldX - cameraX;
  const distance = spacing > 0 ? Math.min(Math.abs(relativeX) / spacing, 1) : 0;
  return {
    worldX,
    relativeX,
    z: -Math.min(Math.abs(relativeX) * 0.3, 2.2),
    rotationY: clamp(-relativeX * 0.2, -0.6, 0.6),
    scaleX: scale * (1 - distance * 0.16),
  };
}

export function getHomepageStageIndex(progress: number, count: number) {
  if (count <= 0) return -1;
  const spacing = 1;
  return getHomepageStageIndexForCamera(
    getHomepageStageTargetX(progress, count, spacing),
    count,
    spacing,
  );
}

export function getHomepageStageState(items: readonly HomepageAlbum[], requestedIndex: number) {
  if (!items.length) return null;
  const currentIndex = Math.max(0, Math.min(items.length - 1, requestedIndex));
  const current = items[currentIndex];
  return {
    currentIndex,
    previous: currentIndex > 0 ? items[currentIndex - 1] : null,
    current,
    next: currentIndex < items.length - 1 ? items[currentIndex + 1] : null,
    displayNumber: current.displayNumber ?? `/${String(currentIndex + 1).padStart(2, "0")}`,
    title: `${current.artists.join("、")} – ${current.title}`,
  };
}

export function calculateMarkerState(contentTop, contentBottom, viewportHeight, viewportWidth = 1440) {
  const start = viewportHeight * 0.78;
  const end = viewportHeight * 0.18;
  const dockProgress = Math.max(0, Math.min(1, (start - contentTop) / (start - end)));
  const releaseProgress = Math.max(0, Math.min(1, (viewportHeight * .82 - contentBottom) / (viewportHeight * .62)));
  const mobile = viewportWidth <= 768;
  return {
    progress: dockProgress,
    phase: releaseProgress > .04 ? "release" : dockProgress > .22 ? "dock" : "hero",
    x: dockProgress * viewportWidth * (mobile ? .3 : .36),
    y: dockProgress * viewportHeight * (mobile ? .08 : .12),
    scale: 1 - dockProgress * (mobile ? .5 : .6),
    opacity: 1 - releaseProgress,
  };
}

export function updateMarker(root, contentTop, contentBottom) {
  const state = calculateMarkerState(contentTop, contentBottom, window.innerHeight, window.innerWidth);
  const marker = root.querySelector(".ad-marker");
  const fixed = root.querySelector(".ad-fixed");
  if (marker) {
    marker.style.setProperty("--ad-marker-x", `${state.x.toFixed(2)}px`);
    marker.style.setProperty("--ad-marker-y", `${state.y.toFixed(2)}px`);
    marker.style.setProperty("--ad-marker-scale", state.scale.toFixed(4));
    marker.style.setProperty("--ad-marker-opacity", state.opacity.toFixed(4));
  }
  if (fixed) fixed.dataset.markerPhase = state.phase;
  return state;
}

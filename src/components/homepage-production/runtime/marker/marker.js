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

export function clampDockOffset(offset, baseRect, viewport, options = {}) {
  const safe = {
    left: options.left ?? 16,
    right: options.right ?? 16,
    top: options.top ?? 104,
    bottom: options.bottom ?? 16,
  };
  const minimumX = safe.left - baseRect.left;
  const maximumX = viewport.width - safe.right - baseRect.width - baseRect.left;
  const minimumY = safe.top - baseRect.top;
  const maximumY = viewport.height - safe.bottom - baseRect.height - baseRect.top;
  let x = Math.max(minimumX, Math.min(maximumX, offset.x));
  let y = Math.max(minimumY, Math.min(maximumY, offset.y));
  const snapThreshold = options.snapThreshold ?? 0;
  if (snapThreshold > 0) {
    const left = baseRect.left + x;
    const right = left + baseRect.width;
    const top = baseRect.top + y;
    const bottom = top + baseRect.height;
    if (Math.abs(left - safe.left) <= snapThreshold) x = minimumX;
    else if (Math.abs(viewport.width - safe.right - right) <= snapThreshold) x = maximumX;
    if (Math.abs(top - safe.top) <= snapThreshold) y = minimumY;
    else if (Math.abs(viewport.height - safe.bottom - bottom) <= snapThreshold) y = maximumY;
  }
  return { x, y };
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

export function calculateMarkerState(contentTop, viewportHeight) {
  const start = viewportHeight * 0.78;
  const end = viewportHeight * 0.18;
  const progress = Math.max(0, Math.min(1, (start - contentTop) / (start - end)));
  return {
    progress,
    y: -progress * viewportHeight * 0.12,
    scale: 1 - progress * 0.28,
    opacity: 1 - progress * 0.72,
  };
}

export function updateMarker(root, contentTop) {
  const state = calculateMarkerState(contentTop, window.innerHeight);
  const marker = root.querySelector(".ad-marker");
  const fixed = root.querySelector(".ad-fixed");
  if (marker) {
    marker.style.setProperty("--ad-marker-y", `${state.y.toFixed(2)}px`);
    marker.style.setProperty("--ad-marker-scale", state.scale.toFixed(4));
    marker.style.setProperty("--ad-marker-opacity", state.opacity.toFixed(4));
  }
  if (fixed) fixed.classList.toggle("is-back", state.progress >= 0.28);
  return state;
}

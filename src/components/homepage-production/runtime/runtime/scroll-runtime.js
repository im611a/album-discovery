import { updateMarker } from "../marker/marker.js";
import { updateTransition } from "../transition/transition.js";

export function createScrollRuntime(root, stage) {
  let raf = 0;
  let disposed = false;
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const pointerCapable = matchMedia("(pointer: fine)").matches;
  const pointer = { tx: 0, ty: 0, x: 0, y: 0 };
  const vinylPointer = { tx: 0, ty: 0, x: 0, y: 0 };
  const marker = root.querySelector(".ad-marker");
  const amplitudes = {
    large: { x: 180, y: 60 },
    medium: { x: 100, y: 30 },
    small: { x: 65, y: 20 },
  };
  const galleryGroups = {
    large: [...root.querySelectorAll(".ad-poster--large .ad-poster__pointer")],
    medium: [...root.querySelectorAll(".ad-poster--medium .ad-poster__pointer")],
    small: [...root.querySelectorAll(".ad-poster--small .ad-poster__pointer")],
  };

  function onPointer(event) {
    pointer.tx = 1 - event.clientX / innerWidth * 2;
    pointer.ty = 1 - event.clientY / innerHeight * 2;
    if (!pointerCapable || !marker) return;
    const rect = marker.getBoundingClientRect();
    const dx = (event.clientX - (rect.left + rect.width / 2)) / Math.max(1, rect.width);
    const dy = (event.clientY - (rect.top + rect.height / 2)) / Math.max(1, rect.height);
    const proximity = Math.max(0, 1 - Math.hypot(dx, dy) / 1.35);
    vinylPointer.tx = Math.max(-1, Math.min(1, dx * 1.7)) * proximity;
    vinylPointer.ty = Math.max(-1, Math.min(1, dy * 1.7)) * proximity;
  }
  function updateGallery() {
    const mobile = innerWidth <= 768;
    root.querySelectorAll(".ad-poster").forEach((figure) => {
      const par = figure.querySelector(".ad-poster__par");
      if (reducedMotion) {
        par.style.transform = "none";
        return;
      }
      const rect = figure.getBoundingClientRect();
      const progress = Math.max(0, Math.min(1, (innerHeight - rect.top) / (innerHeight + rect.height)));
      let distance = 0;
      if (mobile) distance = figure.classList.contains("ad-poster--small") ? 40 : figure.classList.contains("ad-poster--medium") ? 22 : 10;
      else distance = figure.classList.contains("ad-poster--small") ? innerHeight * 0.25 : figure.classList.contains("ad-poster--medium") ? innerHeight * 0.15 : 0;
      par.style.transform = `translateY(${-distance + progress * distance * 2}px)`;
    });
  }
  function tick() {
    if (disposed) return;
    const stageElement = root.querySelector(".ad-stage");
    const galleryElement = root.querySelector(".ad-gallery");
    if (!stageElement || !galleryElement) return;
    const rect = stageElement.getBoundingClientRect();
    const galleryRect = galleryElement.getBoundingClientRect();
    const travel = Math.max(1, stageElement.offsetHeight - innerHeight);
    const progress = Math.max(0, Math.min(1, -rect.top / travel));
    const markerState = updateMarker(root, galleryRect.top, galleryRect.bottom);
    root.dataset.markerProgress = String(markerState.progress);
    root.dataset.markerPhase = markerState.phase;
    root.dataset.transitionProgress = String(updateTransition(root, rect.top));
    updateGallery();
    if (!reducedMotion) {
      pointer.x += (pointer.tx - pointer.x) * 0.09;
      pointer.y += (pointer.ty - pointer.y) * 0.09;
      vinylPointer.x += (vinylPointer.tx - vinylPointer.x) * 0.12;
      vinylPointer.y += (vinylPointer.ty - vinylPointer.y) * 0.12;
      if (marker && pointerCapable) {
        marker.style.setProperty("--ad-vinyl-tilt-x", `${(-vinylPointer.y * 2.2).toFixed(2)}deg`);
        marker.style.setProperty("--ad-vinyl-tilt-y", `${(vinylPointer.x * 2.2).toFixed(2)}deg`);
        marker.style.setProperty("--ad-vinyl-light-x", `${(50 + vinylPointer.x * 13).toFixed(2)}%`);
        marker.style.setProperty("--ad-vinyl-light-y", `${(50 + vinylPointer.y * 13).toFixed(2)}%`);
      }
      for (const size of Object.keys(galleryGroups)) {
        for (const node of galleryGroups[size]) {
          node.style.transform = `translate(${(amplitudes[size].x * pointer.x).toFixed(2)}px,${(amplitudes[size].y * pointer.y).toFixed(2)}px)`;
        }
      }
    }
    stage.setProgress(progress, reducedMotion);
    stage.update();
    raf = requestAnimationFrame(tick);
  }
  if (!reducedMotion) addEventListener("pointermove", onPointer, { passive: true });
  raf = requestAnimationFrame(tick);
  return {
    dispose() {
      if (disposed) return;
      disposed = true;
      cancelAnimationFrame(raf);
      if (!reducedMotion) removeEventListener("pointermove", onPointer);
    },
  };
}

import { clampDockOffset, updateMarker } from "../marker/marker.js";
import { updateTransition } from "../transition/transition.js";
import {
  applyAmbientFlow,
  approachFlowInfluence,
  calculatePointFlowInfluence,
  calculateRectFlowInfluence,
  createEmptyFlowInfluence,
} from "../ambient-flow/ambient-flow.js";

export function createScrollRuntime(root, stage) {
  let raf = 0;
  let disposed = false;
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const pointerCapable = matchMedia("(pointer: fine)").matches;
  const pointer = { tx: 0, ty: 0, x: 0, y: 0 };
  const vinylPointer = { tx: 0, ty: 0, x: 0, y: 0 };
  const marker = root.querySelector(".ad-marker");
  const fixed = root.querySelector(".ad-fixed");
  const ambientFlow = root.querySelector(".ad-ambient-flow");
  const viewport = () => ({ width: innerWidth, height: innerHeight });
  const flowPointer = {
    target: createEmptyFlowInfluence(viewport()),
    current: createEmptyFlowInfluence(viewport()),
  };
  const flowVinyl = {
    target: createEmptyFlowInfluence(viewport()),
    current: createEmptyFlowInfluence(viewport()),
  };
  const drag = { pointerId: null, startX: 0, startY: 0, offset: { x: 0, y: 0 }, startOffset: { x: 0, y: 0 }, baseRect: null };
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

  function applyDragOffset(offset) {
    drag.offset = offset;
    if (!marker) return;
    marker.style.setProperty("--ad-marker-drag-x", `${offset.x.toFixed(2)}px`);
    marker.style.setProperty("--ad-marker-drag-y", `${offset.y.toFixed(2)}px`);
  }

  function finishDrag({ snap = false, reset = false } = {}) {
    if (!marker) return;
    if (drag.pointerId !== null && marker.hasPointerCapture?.(drag.pointerId)) marker.releasePointerCapture?.(drag.pointerId);
    if (snap && drag.baseRect) {
      applyDragOffset(clampDockOffset(drag.offset, drag.baseRect, { width: innerWidth, height: innerHeight }, { snapThreshold: 24 }));
    }
    if (reset) applyDragOffset({ x: 0, y: 0 });
    drag.pointerId = null;
    drag.baseRect = null;
    delete marker.dataset.dragging;
  }

  function onMarkerPointerDown(event) {
    if (!pointerCapable || !marker || fixed?.dataset.markerPhase !== "dock" || event.button !== 0 || event.isPrimary === false) return;
    const rect = marker.getBoundingClientRect();
    drag.pointerId = event.pointerId;
    drag.startX = event.clientX;
    drag.startY = event.clientY;
    drag.startOffset = { ...drag.offset };
    drag.baseRect = {
      left: rect.left - drag.offset.x,
      top: rect.top - drag.offset.y,
      width: rect.width,
      height: rect.height,
    };
    marker.dataset.dragging = "true";
    marker.setPointerCapture?.(event.pointerId);
    event.preventDefault();
  }

  function onMarkerPointerMove(event) {
    if (drag.pointerId !== event.pointerId || !drag.baseRect) return;
    const desired = {
      x: drag.startOffset.x + event.clientX - drag.startX,
      y: drag.startOffset.y + event.clientY - drag.startY,
    };
    applyDragOffset(clampDockOffset(desired, drag.baseRect, { width: innerWidth, height: innerHeight }));
    event.preventDefault();
  }

  function onMarkerPointerUp(event) {
    if (drag.pointerId !== event.pointerId) return;
    finishDrag({ snap: true });
  }

  function onPointer(event) {
    pointer.tx = 1 - event.clientX / innerWidth * 2;
    pointer.ty = 1 - event.clientY / innerHeight * 2;
    flowPointer.target = calculatePointFlowInfluence({ x: event.clientX, y: event.clientY }, viewport());
    if (!pointerCapable || !marker) return;
    const rect = marker.getBoundingClientRect();
    const dx = (event.clientX - (rect.left + rect.width / 2)) / Math.max(1, rect.width);
    const dy = (event.clientY - (rect.top + rect.height / 2)) / Math.max(1, rect.height);
    const proximity = Math.max(0, 1 - Math.hypot(dx, dy) / 1.35);
    vinylPointer.tx = Math.max(-1, Math.min(1, dx * 1.7)) * proximity;
    vinylPointer.ty = Math.max(-1, Math.min(1, dy * 1.7)) * proximity;
  }
  function onPointerLeave() {
    flowPointer.target = createEmptyFlowInfluence(viewport());
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
    if (markerState.phase !== "dock" && drag.pointerId !== null) finishDrag();
    if (markerState.phase === "hero" && (drag.offset.x || drag.offset.y)) finishDrag({ reset: true });
    if (ambientFlow) {
      flowVinyl.target = !reducedMotion && pointerCapable && markerState.phase === "dock" && marker
        ? calculateRectFlowInfluence(marker.getBoundingClientRect(), viewport())
        : createEmptyFlowInfluence(viewport());
      flowPointer.current = approachFlowInfluence(flowPointer.current, flowPointer.target, reducedMotion ? 1 : 0.05);
      flowVinyl.current = approachFlowInfluence(flowVinyl.current, flowVinyl.target, reducedMotion ? 1 : 0.06);
      applyAmbientFlow(ambientFlow, flowPointer.current, flowVinyl.current, viewport());
      ambientFlow.dataset.flowMarkerPhase = markerState.phase;
    }
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
  if (marker) {
    marker.dataset.dragEnabled = pointerCapable ? "true" : "false";
    applyDragOffset(drag.offset);
    if (pointerCapable) {
      marker.addEventListener("pointerdown", onMarkerPointerDown);
      marker.addEventListener("pointermove", onMarkerPointerMove);
      marker.addEventListener("pointerup", onMarkerPointerUp);
      marker.addEventListener("pointercancel", onMarkerPointerUp);
    }
  }
  if (!reducedMotion && pointerCapable) {
    addEventListener("pointermove", onPointer, { passive: true });
    root.addEventListener("pointerleave", onPointerLeave);
  }
  raf = requestAnimationFrame(tick);
  return {
    dispose() {
      if (disposed) return;
      disposed = true;
      cancelAnimationFrame(raf);
      finishDrag();
      if (marker && pointerCapable) {
        marker.removeEventListener("pointerdown", onMarkerPointerDown);
        marker.removeEventListener("pointermove", onMarkerPointerMove);
        marker.removeEventListener("pointerup", onMarkerPointerUp);
        marker.removeEventListener("pointercancel", onMarkerPointerUp);
      }
      if (!reducedMotion && pointerCapable) {
        removeEventListener("pointermove", onPointer);
        root.removeEventListener("pointerleave", onPointerLeave);
      }
      if (ambientFlow) {
        applyAmbientFlow(
          ambientFlow,
          createEmptyFlowInfluence(viewport()),
          createEmptyFlowInfluence(viewport()),
          viewport(),
        );
        delete ambientFlow.dataset.flowMarkerPhase;
      }
    },
  };
}

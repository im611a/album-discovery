const clamp = (value, minimum = 0, maximum = 1) => Math.max(minimum, Math.min(maximum, value));

export function createEmptyFlowInfluence(viewport = { width: 1, height: 1 }) {
  return {
    x: viewport.width / 2,
    y: viewport.height / 2,
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    energy: 0,
  };
}

function edgeEnergy(distance, range) {
  return clamp(1 - Math.max(0, distance) / Math.max(1, range));
}

export function calculatePointFlowInfluence(point, viewport, range = 180) {
  const influence = {
    x: clamp(point.x, 0, viewport.width),
    y: clamp(point.y, 0, viewport.height),
    left: edgeEnergy(point.x, range),
    right: edgeEnergy(viewport.width - point.x, range),
    top: edgeEnergy(point.y, range),
    bottom: edgeEnergy(viewport.height - point.y, range),
  };
  return { ...influence, energy: Math.max(influence.left, influence.right, influence.top, influence.bottom) };
}

export function calculateRectFlowInfluence(rect, viewport, range = 240) {
  const influence = {
    x: clamp(rect.left + rect.width / 2, 0, viewport.width),
    y: clamp(rect.top + rect.height / 2, 0, viewport.height),
    left: edgeEnergy(rect.left, range),
    right: edgeEnergy(viewport.width - (rect.left + rect.width), range),
    top: edgeEnergy(rect.top, range),
    bottom: edgeEnergy(viewport.height - (rect.top + rect.height), range),
  };
  return { ...influence, energy: Math.max(influence.left, influence.right, influence.top, influence.bottom) };
}

export function approachFlowInfluence(current, target, amount) {
  return {
    x: current.x + (target.x - current.x) * amount,
    y: current.y + (target.y - current.y) * amount,
    left: current.left + (target.left - current.left) * amount,
    right: current.right + (target.right - current.right) * amount,
    top: current.top + (target.top - current.top) * amount,
    bottom: current.bottom + (target.bottom - current.bottom) * amount,
    energy: current.energy + (target.energy - current.energy) * amount,
  };
}

export function applyAmbientFlow(element, pointer, vinyl, viewport) {
  if (!element) return;
  const pointerWeight = pointer.energy * 0.35;
  const vinylWeight = vinyl.energy;
  const totalWeight = pointerWeight + vinylWeight;
  const focusX = totalWeight > 0
    ? (pointer.x * pointerWeight + vinyl.x * vinylWeight) / totalWeight
    : viewport.width / 2;
  const focusY = totalWeight > 0
    ? (pointer.y * pointerWeight + vinyl.y * vinylWeight) / totalWeight
    : viewport.height / 2;
  const set = (name, value) => element.style.setProperty(name, value);
  set("--flow-focus-x", `${focusX.toFixed(2)}px`);
  set("--flow-focus-y", `${focusY.toFixed(2)}px`);
  set("--flow-edge-left", Math.min(0.38, pointer.left * 0.2 + vinyl.left * 0.36).toFixed(4));
  set("--flow-edge-right", Math.min(0.38, pointer.right * 0.2 + vinyl.right * 0.36).toFixed(4));
  set("--flow-edge-top", Math.min(0.28, pointer.top * 0.12 + vinyl.top * 0.23).toFixed(4));
  set("--flow-edge-bottom", Math.min(0.34, pointer.bottom * 0.16 + vinyl.bottom * 0.29).toFixed(4));
  element.dataset.flowPointerEnergy = pointer.energy.toFixed(4);
  element.dataset.flowVinylEnergy = vinyl.energy.toFixed(4);
}

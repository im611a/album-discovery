import { createStageScene } from "./stage-scene.js";
import {
  getHomepageStageIndexForCamera,
  getHomepageStageReferencePose,
  getHomepageStageTargetX,
  getHomepageVinylLifecycle,
  HOMEPAGE_STAGE_REFERENCE,
} from "../../homepage-stage-state";

function projectToCanvas(state, canvas, object, x, y) {
  const point = object.localToWorld(new state.THREE.Vector3(x, y, 0)).project(state.camera);
  return {
    x: (point.x + 1) * 0.5 * canvas.clientWidth,
    y: (1 - point.y) * 0.5 * canvas.clientHeight,
  };
}

function getProjectedBounds(state, canvas, object, points) {
  const projected = points.map(([x, y]) => projectToCanvas(state, canvas, object, x, y));
  return {
    minX: Math.min(...projected.map((point) => point.x)),
    maxX: Math.max(...projected.map((point) => point.x)),
    minY: Math.min(...projected.map((point) => point.y)),
    maxY: Math.max(...projected.map((point) => point.y)),
  };
}

function circlePoints(radius, count = 32) {
  return Array.from({ length: count }, (_, index) => {
    const angle = index / count * Math.PI * 2;
    return [Math.cos(angle) * radius, Math.sin(angle) * radius];
  });
}

export async function mountStage(root, items) {
  const canvas = root.querySelector("#homepageStageCanvas");
  const title = root.querySelector("#homepageStageTitle");
  const number = root.querySelector("#homepageStageNumber");
  if (!canvas || !title || !number) throw new Error("Homepage stage DOM is incomplete.");

  const state = await createStageScene(canvas, items);
  let scale = 1;
  let spacing = 1;
  let vinylExposure = HOMEPAGE_STAGE_REFERENCE.desktopVinylExposure;
  let targetX = 0;
  let cameraX = 0;
  let stageProgress = 0;
  let current = -1;
  let reducedMotion = false;
  let dirty = true;
  let active = false;
  let disposed = false;
  let lastVinylLifecycle = getHomepageVinylLifecycle(0, 0, items.length);

  function resize() {
    if (disposed) return;
    const width = canvas.clientWidth || innerWidth;
    const height = canvas.clientHeight || innerHeight;
    state.renderer.setPixelRatio(Math.min(devicePixelRatio, width <= 768 ? 1.5 : 2));
    state.renderer.setSize(width, height, false);
    state.camera.aspect = width / height;
    state.camera.updateProjectionMatrix();
    const viewHeight = 2 * Math.tan(state.THREE.MathUtils.degToRad(state.camera.fov / 2)) * state.camera.position.z;
    const viewWidth = viewHeight * state.camera.aspect;
    const mobile = width <= 768;
    state.camera.position.y = mobile ? viewHeight * 0.08 : 0;
    scale = Math.min(viewHeight * (mobile ? 0.42 : 0.52), viewWidth * (mobile ? 0.7 : 0.42));
    spacing = scale * (mobile
      ? HOMEPAGE_STAGE_REFERENCE.mobileSpacingRatio
      : HOMEPAGE_STAGE_REFERENCE.desktopSpacingRatio);
    vinylExposure = mobile
      ? HOMEPAGE_STAGE_REFERENCE.mobileVinylExposure
      : HOMEPAGE_STAGE_REFERENCE.desktopVinylExposure;
    state.groups.forEach((group, index) => {
      group.userData.x = index * spacing;
    });
    dirty = true;
  }

  function setProgress(progress, nextReducedMotion = false) {
    stageProgress = Math.max(0, Math.min(1, progress));
    targetX = getHomepageStageTargetX(progress, items.length, spacing);
    reducedMotion = nextReducedMotion;
    active = true;
    dirty = true;
  }

  function update() {
    if (disposed || !active) return;
    const before = cameraX;
    if (reducedMotion) cameraX = targetX;
    else cameraX += (targetX - cameraX) * HOMEPAGE_STAGE_REFERENCE.cameraEase;
    if (Math.abs(targetX - cameraX) < 2e-4) cameraX = targetX;
    state.camera.position.x = cameraX;

    let moving = Math.abs(cameraX - before) > 5e-5;
    const selected = getHomepageStageIndexForCamera(cameraX, items.length, spacing);
    const lifecycleAlbumPosition = spacing > 0 ? targetX / spacing : 0;
    const vinylLifecycle = getHomepageVinylLifecycle(stageProgress, lifecycleAlbumPosition, items.length);
    lastVinylLifecycle = vinylLifecycle;
    const diagnostics = [];
    state.groups.forEach((group, index) => {
      const pose = getHomepageStageReferencePose(index, cameraX, spacing, scale);
      group.position.x = pose.worldX;
      group.position.z = pose.z;
      group.rotation.y = pose.rotationY;
      group.scale.set(scale, scale, 1);
      group.scale.x = pose.scaleX;

      group.userData.out = vinylLifecycle.groupEjectProgress[index] ?? 0;
      if (!reducedMotion && group.userData.out > 0.01) {
        group.userData.spin += group.userData.out * HOMEPAGE_STAGE_REFERENCE.vinylSpinStep;
        moving = true;
      }
      const exposure = group.userData.out * vinylExposure;
      group.userData.holder.position.x = exposure;
      group.userData.vinyl.rotation.z = reducedMotion
        ? -(exposure / 0.5)
        : -(exposure / 0.5) - group.userData.spin;
      diagnostics.push({
        index,
        worldX: Number(pose.worldX.toFixed(4)),
        relativeX: Number(pose.relativeX.toFixed(4)),
        z: Number(pose.z.toFixed(4)),
        rotationY: Number(pose.rotationY.toFixed(4)),
        scaleX: Number(pose.scaleX.toFixed(4)),
        vinylOwner: vinylLifecycle.ownerIndex === index,
        vinylEjectProgress: Number(group.userData.out.toFixed(4)),
        vinylExposure: Number(exposure.toFixed(4)),
        vinylRotationZ: Number(group.userData.vinyl.rotation.z.toFixed(4)),
      });
    });

    state.scene.updateMatrixWorld(true);
    state.camera.updateMatrixWorld(true);
    diagnostics.forEach((diagnostic, index) => {
      const { cover, vinyl } = state.groups[index].userData;
      const coverBounds = getProjectedBounds(state, canvas, cover, [
        [-0.5, -0.5],
        [-0.5, 0.5],
        [0.5, -0.5],
        [0.5, 0.5],
      ]);
      const vinylBounds = getProjectedBounds(state, canvas, vinyl, circlePoints(0.5));
      const vinylCenter = projectToCanvas(state, canvas, vinyl, 0, 0);
      const labelBounds = getProjectedBounds(
        state,
        canvas,
        vinyl,
        circlePoints(0.5 * HOMEPAGE_STAGE_REFERENCE.vinylLabelRadiusRatio),
      );
      const projectedLabelWidth = labelBounds.maxX - labelBounds.minX;
      diagnostic.projectedSleeveHeight = Number((coverBounds.maxY - coverBounds.minY).toFixed(2));
      diagnostic.projectedVinylDiameter = Number((vinylBounds.maxY - vinylBounds.minY).toFixed(2));
      diagnostic.vinylCenterX = Number(vinylCenter.x.toFixed(2));
      diagnostic.vinylCenterY = Number(vinylCenter.y.toFixed(2));
      diagnostic.vinylSleeveRatio = Number(
        (diagnostic.projectedVinylDiameter / diagnostic.projectedSleeveHeight).toFixed(4),
      );
      diagnostic.visibleVinylWidth = Number(Math.max(0, vinylBounds.maxX - coverBounds.maxX).toFixed(2));
      diagnostic.centerLabelVisibility = Number(Math.max(
        0,
        Math.min(1, (labelBounds.maxX - coverBounds.maxX) / Math.max(projectedLabelWidth, 0.001)),
      ).toFixed(4));
    });

    canvas.dataset.currentIndex = String(selected);
    canvas.dataset.cameraX = cameraX.toFixed(4);
    canvas.dataset.targetX = targetX.toFixed(4);
    canvas.dataset.outgoingIndex = String(vinylLifecycle.outgoingIndex ?? -1);
    canvas.dataset.incomingIndex = String(vinylLifecycle.incomingIndex ?? -1);
    canvas.dataset.vinylOwnerIndex = String(vinylLifecycle.ownerIndex ?? -1);
    canvas.dataset.vinylEjectProgress = vinylLifecycle.ejectProgress.toFixed(4);
    canvas.dataset.vinylDiameterRatio = String(HOMEPAGE_STAGE_REFERENCE.vinylDiameterRatio);
    canvas.dataset.vinylLabelRadiusRatio = String(HOMEPAGE_STAGE_REFERENCE.vinylLabelRadiusRatio);
    canvas.dataset.stageGroups = JSON.stringify(diagnostics);

    if (selected !== current) {
      current = selected;
      title.textContent = `${items[current].artists.join("、")} – ${items[current].title}`;
      title.dataset.albumId = items[current].albumId;
      title.href = `/albums/${items[current].slug}`;
      number.textContent = items[current].displayNumber || `/${String(current + 1).padStart(2, "0")}`;
      dirty = true;
    }
    if (moving || dirty) {
      state.renderer.render(state.scene, state.camera);
      dirty = false;
    }
  }

  resize();
  addEventListener("resize", resize);
  return {
    setProgress,
    update,
    getDiagnostics() {
      return {
        revision: state.THREE.REVISION,
        currentIndex: current,
        outgoingIndex: lastVinylLifecycle.outgoingIndex,
        incomingIndex: lastVinylLifecycle.incomingIndex,
        vinylOwnerIndex: lastVinylLifecycle.ownerIndex,
        vinylEjectProgress: lastVinylLifecycle.ejectProgress,
        previous: current > 0 ? current - 1 : null,
        next: current < items.length - 1 ? current + 1 : null,
        cameraX,
        targetX,
        scale,
        spacing,
        groupCount: state.groups.length,
        vinylExposure,
      };
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      removeEventListener("resize", resize);
      state.dispose();
    },
  };
}

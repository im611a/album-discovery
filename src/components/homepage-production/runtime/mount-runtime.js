import { mountStage } from "./stage/stage.js";
import { createScrollRuntime } from "./runtime/scroll-runtime.js";

let activeRuntime = null;

export async function mountHomepageRuntime(root, stageAlbums) {
  activeRuntime?.();
  root.dataset.runtimeState = "mounting";
  const stage = await mountStage(root, stageAlbums);
  const scroll = createScrollRuntime(root, stage);
  let disposed = false;
  root.dataset.runtimeState = "ready";
  root.dataset.threeRevision = String(stage.getDiagnostics().revision);
  root.dataset.galleryCount = String(root.querySelectorAll(".ad-poster").length);
  root.dataset.stageCount = String(stageAlbums.length);

  const dispose = () => {
    if (disposed) return;
    disposed = true;
    scroll.dispose();
    stage.dispose();
    root.dataset.runtimeState = "disposed";
    if (activeRuntime === dispose) activeRuntime = null;
  };
  activeRuntime = dispose;
  return dispose;
}

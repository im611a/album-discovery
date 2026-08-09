import { createAlbumVinylTexture, createMaterial, loadTexture } from "./stage-materials.js";

let threePromise;

async function loadLocalThree() {
  if (!threePromise) {
    threePromise = fetch("/homepage-production/vendor/three.module.min.txt")
      .then((response) => {
        if (!response.ok) throw new Error(`Unable to load local Three.js vendor (${response.status}).`);
        return response.text();
      })
      .then(async (source) => {
        const objectUrl = URL.createObjectURL(new Blob([source], { type: "text/javascript" }));
        try {
          return await import(/* webpackIgnore: true */ objectUrl);
        } finally {
          URL.revokeObjectURL(objectUrl);
        }
      });
  }
  return threePromise;
}

export async function createStageScene(canvas, items) {
  const THREE = await loadLocalThree();
  const renderer = new THREE.WebGLRenderer({
    canvas,
    alpha: true,
    antialias: true,
    powerPreference: "high-performance",
  });
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
  camera.position.z = 5;
  const loader = new THREE.TextureLoader();
  const anisotropy = renderer.capabilities.getMaxAnisotropy();
  const coverGeometry = new THREE.PlaneGeometry(1, 1);
  const vinylGeometry = new THREE.PlaneGeometry(1, 1);
  const groups = items.map((item, index) => {
    const group = new THREE.Group();
    group.name = `album-group-${index + 1}`;
    const coverMaterial = createMaterial(THREE, loadTexture(THREE, loader, item.cover, renderer, anisotropy));
    const cover = new THREE.Mesh(coverGeometry, coverMaterial);
    const holder = new THREE.Group();
    const vinyl = new THREE.Mesh(
      vinylGeometry,
      createMaterial(
        THREE,
        createAlbumVinylTexture(THREE, item.vinylPalette, renderer, anisotropy),
        true,
      ),
    );
    holder.add(vinyl);
    holder.position.z = -0.16;
    holder.scale.set(0.97, 0.97, 1);
    group.add(holder, cover);
    group.userData = { index, x: 0, cover, coverMaterial, holder, vinyl, out: 0, spin: 0 };
    scene.add(group);
    return group;
  });
  return {
    THREE,
    renderer,
    scene,
    camera,
    groups,
    dispose() {
      for (const group of groups) {
        group.userData.coverMaterial.map?.dispose();
        group.userData.coverMaterial.dispose();
        group.userData.vinyl.material.map?.dispose();
        group.userData.vinyl.material.dispose();
      }
      coverGeometry.dispose();
      vinylGeometry.dispose();
      renderer.dispose();
    },
  };
}

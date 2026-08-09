export function loadTexture(THREE, loader, url, renderer, anisotropy) {
  const texture = loader.load(url, () => renderer.initTexture(texture));
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = Math.min(8, anisotropy);
  return texture;
}

export function createMaterial(THREE, texture, transparent = false) {
  return new THREE.MeshBasicMaterial({ map: texture, transparent });
}

export function createAlbumVinylTexture(THREE, palette, renderer, anisotropy) {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 512;
  const context = canvas.getContext("2d");
  const center = 256;

  const body = context.createRadialGradient(center - 38, center - 52, 18, center, center, 252);
  body.addColorStop(0, "#24272a");
  body.addColorStop(0.58, "#111315");
  body.addColorStop(0.94, "#090a0b");
  body.addColorStop(1, "#030404");
  context.fillStyle = body;
  context.beginPath();
  context.arc(center, center, 250, 0, Math.PI * 2);
  context.fill();

  // Keep the record black while separating its physical rim from the black Stage.
  // These are material cues only: they do not alter eject geometry or label visibility.
  context.strokeStyle = "rgba(206, 216, 222, 0.2)";
  context.lineWidth = 2;
  context.beginPath();
  context.arc(center, center, 248, 0, Math.PI * 2);
  context.stroke();

  for (const radius of [242, 246]) {
    context.strokeStyle = "rgba(190, 201, 207, 0.11)";
    context.lineWidth = 1;
    context.beginPath();
    context.arc(center, center, radius, 0, Math.PI * 2);
    context.stroke();
  }

  context.strokeStyle = `${palette.light}30`;
  context.lineWidth = 2;
  context.beginPath();
  context.arc(center, center, 244, -1.16, -0.18);
  context.stroke();

  for (let radius = 92; radius <= 238; radius += 7) {
    context.strokeStyle = radius % 14 === 0 ? "rgba(185, 194, 200, 0.13)" : "rgba(185, 194, 200, 0.07)";
    context.lineWidth = 1;
    context.beginPath();
    context.arc(center, center, radius, 0, Math.PI * 2);
    context.stroke();
  }

  context.strokeStyle = `${palette.secondary}66`;
  context.lineWidth = 4;
  context.beginPath();
  context.arc(center, center, 206, -0.52, 0.12);
  context.stroke();

  const label = context.createRadialGradient(center - 20, center - 22, 5, center, center, 76);
  label.addColorStop(0, palette.light);
  label.addColorStop(0.46, palette.dominant);
  label.addColorStop(1, palette.secondary);
  context.fillStyle = label;
  context.beginPath();
  context.arc(center, center, 75, 0, Math.PI * 2);
  context.fill();

  context.strokeStyle = "rgba(5, 7, 8, 0.48)";
  context.lineWidth = 2;
  context.beginPath();
  context.arc(center, center, 58, 0, Math.PI * 2);
  context.stroke();

  context.strokeStyle = palette.light;
  context.lineWidth = 7;
  context.lineCap = "round";
  context.beginPath();
  context.moveTo(center + 31, center - 28);
  context.lineTo(center + 52, center - 47);
  context.stroke();
  context.fillStyle = palette.light;
  context.beginPath();
  context.arc(center - 39, center + 26, 5, 0, Math.PI * 2);
  context.fill();

  context.fillStyle = "#050607";
  context.beginPath();
  context.arc(center, center, 8, 0, Math.PI * 2);
  context.fill();

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = Math.min(8, anisotropy);
  renderer.initTexture(texture);
  return texture;
}

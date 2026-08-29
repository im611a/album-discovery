const HUE_TAGS = Object.freeze([
  ["red", 345, 360],
  ["red", 0, 15],
  ["orange", 15, 45],
  ["yellow", 45, 75],
  ["green", 75, 165],
  ["cyan", 165, 200],
  ["blue", 200, 255],
  ["purple", 255, 295],
  ["pink", 295, 345],
]);

export const VISUAL_COLOR_TAGS = Object.freeze([
  "red", "orange", "yellow", "green", "cyan", "blue", "purple", "pink",
  "mono", "dark", "multicolor",
]);

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value));
}

export function rgbToHsl(red, green, blue) {
  const r = red / 255;
  const g = green / 255;
  const b = blue / 255;
  const maximum = Math.max(r, g, b);
  const minimum = Math.min(r, g, b);
  const delta = maximum - minimum;
  const luminance = (maximum + minimum) / 2;
  const saturation = delta === 0 ? 0 : delta / (1 - Math.abs(2 * luminance - 1));
  let hue = 0;
  if (delta !== 0) {
    if (maximum === r) hue = 60 * (((g - b) / delta) % 6);
    else if (maximum === g) hue = 60 * ((b - r) / delta + 2);
    else hue = 60 * ((r - g) / delta + 4);
  }
  if (hue < 0) hue += 360;
  return { hue, saturation, luminance };
}

function hueTag(hue) {
  return HUE_TAGS.find(([, start, end]) => hue >= start && hue < end)?.[0] ?? "red";
}

function hex(value) {
  return Math.round(clamp(value, 0, 255)).toString(16).padStart(2, "0");
}

function averageColor(bucket) {
  return `#${hex(bucket.red / bucket.count)}${hex(bucket.green / bucket.count)}${hex(bucket.blue / bucket.count)}`;
}

function hslToHex(hue, saturation, luminance) {
  const chroma = (1 - Math.abs(2 * luminance - 1)) * saturation;
  const sector = hue / 60;
  const intermediate = chroma * (1 - Math.abs((sector % 2) - 1));
  const [red, green, blue] = sector < 1 ? [chroma, intermediate, 0]
    : sector < 2 ? [intermediate, chroma, 0]
      : sector < 3 ? [0, chroma, intermediate]
        : sector < 4 ? [0, intermediate, chroma]
          : sector < 5 ? [intermediate, 0, chroma]
            : [chroma, 0, intermediate];
  const match = luminance - chroma / 2;
  return `#${hex((red + match) * 255)}${hex((green + match) * 255)}${hex((blue + match) * 255)}`;
}

export function deriveSafeAccent(color) {
  if (!/^#[0-9a-f]{6}$/i.test(color)) throw new Error(`Invalid accent source color: ${color}`);
  const hsl = rgbToHsl(
    Number.parseInt(color.slice(1, 3), 16),
    Number.parseInt(color.slice(3, 5), 16),
    Number.parseInt(color.slice(5, 7), 16),
  );
  return hslToHex(hsl.hue, clamp(hsl.saturation, 0.28, 0.62), clamp(hsl.luminance, 0.38, 0.58));
}

export function analyzeRgbBytes(bytes) {
  if (!(bytes instanceof Uint8Array) || bytes.length < 3 || bytes.length % 3 !== 0) {
    throw new Error("Visual analysis requires non-empty RGB24 bytes.");
  }
  const histogram = new Map();
  const hueWeights = Object.fromEntries(VISUAL_COLOR_TAGS.slice(0, 8).map((tag) => [tag, 0]));
  let saturationTotal = 0;
  let luminanceTotal = 0;
  let grayscale = 0;
  let dark = 0;
  let colorful = 0;
  let hueVectorX = 0;
  let hueVectorY = 0;
  for (let offset = 0; offset < bytes.length; offset += 3) {
    const red = bytes[offset];
    const green = bytes[offset + 1];
    const blue = bytes[offset + 2];
    const hsl = rgbToHsl(red, green, blue);
    saturationTotal += hsl.saturation;
    luminanceTotal += hsl.luminance;
    if (hsl.saturation < 0.14) grayscale += 1;
    if (hsl.luminance < 0.2) dark += 1;
    if (hsl.saturation >= 0.14 && hsl.luminance >= 0.08 && hsl.luminance <= 0.92) {
      colorful += 1;
      const hueWeight = 0.35 + hsl.saturation;
      hueWeights[hueTag(hsl.hue)] += hueWeight;
      hueVectorX += Math.cos(hsl.hue * Math.PI / 180) * hueWeight;
      hueVectorY += Math.sin(hsl.hue * Math.PI / 180) * hueWeight;
    }
    const hueBucket = Math.floor(hsl.hue / 15);
    const saturationBucket = Math.floor(hsl.saturation * 4);
    const luminanceBucket = Math.floor(hsl.luminance * 4);
    const key = `${hueBucket}:${saturationBucket}:${luminanceBucket}`;
    const bucket = histogram.get(key) ?? { count: 0, red: 0, green: 0, blue: 0, score: 0 };
    bucket.count += 1;
    bucket.red += red;
    bucket.green += green;
    bucket.blue += blue;
    bucket.score += 0.25 + hsl.saturation * (1 - Math.abs(hsl.luminance - 0.5));
    histogram.set(key, bucket);
  }
  const pixelCount = bytes.length / 3;
  const grayscaleRatio = grayscale / pixelCount;
  const darkRatio = dark / pixelCount;
  const rankedColors = [...histogram.values()].sort((left, right) => right.score - left.score || right.count - left.count);
  const dominantColors = [];
  for (const bucket of rankedColors) {
    const color = averageColor(bucket);
    if (!dominantColors.includes(color)) dominantColors.push(color);
    if (dominantColors.length === 3) break;
  }
  const rankedHues = Object.entries(hueWeights).sort((left, right) => right[1] - left[1]);
  const totalHueWeight = rankedHues.reduce((sum, [, weight]) => sum + weight, 0);
  const hueTags = rankedHues.filter(([, weight]) => totalHueWeight > 0 && weight / totalHueWeight >= 0.12).map(([tag]) => tag);
  const significantHueCount = rankedHues.filter(([, weight]) => totalHueWeight > 0 && weight / totalHueWeight >= 0.09).length;
  const visualColorTags = [...hueTags];
  if (grayscaleRatio >= 0.62) visualColorTags.push("mono");
  if (darkRatio >= 0.45) visualColorTags.push("dark");
  if (significantHueCount >= 4 && colorful / pixelCount >= 0.34) visualColorTags.push("multicolor");
  if (!visualColorTags.length) visualColorTags.push(grayscaleRatio >= 0.5 ? "mono" : darkRatio >= 0.45 ? "dark" : rankedHues[0][0]);
  const primaryVisualColor = grayscaleRatio >= 0.78
    ? "mono"
    : darkRatio >= 0.72 && totalHueWeight < pixelCount * 0.22
      ? "dark"
      : rankedHues[0][1] > 0
        ? rankedHues[0][0]
        : grayscaleRatio >= 0.5 ? "mono" : "dark";
  const primaryHue = rankedHues[0][1] > 0
    ? (Math.atan2(hueVectorY, hueVectorX) * 180 / Math.PI + 360) % 360
    : 0;
  return Object.freeze({
    dominantColors: Object.freeze(dominantColors),
    primaryColor: dominantColors[0] ?? "#777777",
    secondaryColor: dominantColors[1] ?? dominantColors[0] ?? "#555555",
    accentColor: deriveSafeAccent(dominantColors[0] ?? "#777777"),
    accentSecondaryColor: deriveSafeAccent(dominantColors[1] ?? dominantColors[0] ?? "#555555"),
    primaryHue: Number(primaryHue.toFixed(2)),
    saturation: Number((saturationTotal / pixelCount).toFixed(4)),
    luminance: Number((luminanceTotal / pixelCount).toFixed(4)),
    grayscaleRatio: Number(grayscaleRatio.toFixed(4)),
    darkRatio: Number(darkRatio.toFixed(4)),
    visualColorTags: Object.freeze([...new Set(visualColorTags)]),
    primaryVisualColor,
  });
}

const AMBIENT_MIN_RELATIVE_LUMINANCE = 0.16;
const AMBIENT_ILLUMINATION_NEUTRAL = [184, 180, 190] as const;

function srgbToLinear(channel: number) {
  const value = channel / 255;
  return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}

function linearToSrgb(channel: number) {
  const value = channel <= 0.0031308
    ? channel * 12.92
    : 1.055 * channel ** (1 / 2.4) - 0.055;
  return Math.round(Math.max(0, Math.min(1, value)) * 255);
}

export function getHomepageAmbientPaintColor(color: string) {
  const match = /^#([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i.exec(color);
  if (!match) return color;

  const source = match.slice(1).map((channel) => srgbToLinear(Number.parseInt(channel, 16)));
  const luminance = 0.2126 * source[0] + 0.7152 * source[1] + 0.0722 * source[2];
  if (luminance >= AMBIENT_MIN_RELATIVE_LUMINANCE) return color;

  const neutral = AMBIENT_ILLUMINATION_NEUTRAL.map(srgbToLinear);
  const neutralLuminance = 0.2126 * neutral[0] + 0.7152 * neutral[1] + 0.0722 * neutral[2];
  const mix = (AMBIENT_MIN_RELATIVE_LUMINANCE - luminance)
    / Math.max(0.001, neutralLuminance - luminance);
  const painted = source.map((channel, index) =>
    linearToSrgb(channel + (neutral[index] - channel) * mix));
  return `rgb(${painted.join(" ")})`;
}

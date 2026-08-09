export const HOMEPAGE_BREAKPOINT = 768;
export const REFERENCE_POSTER_ASPECT_RATIO = 1.414;
export const SQUARE_MEDIA_SCALE = Math.sqrt(REFERENCE_POSTER_ASPECT_RATIO);

const DESKTOP_LAYOUT = [
  { column: "1 / span 4", size: "large", shiftPercent: 0 },
  { column: "6 / span 2", size: "small", shiftPercent: 48 },
  { column: "9 / span 3", size: "medium", shiftPercent: -16 },
  { column: "2 / span 3", size: "medium", shiftPercent: 30 },
  { column: "6 / span 4", size: "large", shiftPercent: -6 },
  { column: "11 / span 2", size: "small", shiftPercent: 42 },
  { column: "1 / span 2", size: "small", shiftPercent: -28 },
  { column: "4 / span 3", size: "medium", shiftPercent: 18 },
  { column: "8 / span 4", size: "large", shiftPercent: -2 },
] as const;

const MOBILE_LAYOUT = [
  { row: 1, column: 1, span: 3, marginLeft: 1.4 },
  { row: 1, column: 5, span: 2 },
  { row: 2, column: 3, span: 1, translateY: 0.25 },
  { row: 3, column: 4, span: 3, translateX: 0.5 },
  { row: 3, column: 1, span: 2, translateY: 0.45 },
  { row: 4, column: 5, span: 1, translateY: -0.15 },
  { row: 5, column: 2, span: 2, marginLeft: 0.7 },
  { row: 5, column: 5, span: 1, translateY: 0.5 },
] as const;

export type HomepagePosterSize = "large" | "medium" | "small";

export function getHomepageGalleryGeometry(index: number, viewportWidth: number, itemCount = 24) {
  if (!Number.isInteger(index) || index < 0 || index >= itemCount) {
    throw new RangeError(`Invalid homepage gallery index: ${index}`);
  }
  if (viewportWidth <= HOMEPAGE_BREAKPOINT) {
    const entry = MOBILE_LAYOUT[index % MOBILE_LAYOUT.length];
    const cycle = Math.floor(index / MOBILE_LAYOUT.length);
    const size = ({ 1: "small", 2: "medium", 3: "large" } as const)[entry.span];
    const translateX = "translateX" in entry ? entry.translateX / entry.span * 100 : 0;
    let translateY = "translateY" in entry ? entry.translateY : 0;
    if (index === 1) translateY += 0.6;
    return {
      size,
      gridColumn: `${entry.column} / span ${entry.span}`,
      gridRow: String(entry.row + cycle * 5),
      marginLeft: "marginLeft" in entry ? `${(-entry.marginLeft / 6 * 100).toFixed(2)}%` : undefined,
      squareMediaScale: SQUARE_MEDIA_SCALE,
      transform: translateX || translateY
        ? `translate(${translateX.toFixed(2)}%, ${(translateY * 100).toFixed(2)}%)`
        : undefined,
    };
  }
  const entry = DESKTOP_LAYOUT[index % DESKTOP_LAYOUT.length];
  const lastLarge = index >= itemCount - 3 && entry.size === "large";
  return {
    size: entry.size,
    gridColumn: lastLarge ? "7 / span 4" : entry.column,
    gridRow: String(Math.floor(index / 3) + 1),
    marginLeft: undefined,
    squareMediaScale: SQUARE_MEDIA_SCALE,
    transform: `translateY(${entry.shiftPercent}%)`,
  };
}

export function clampHomepageProgress(value: number) {
  return Math.max(0, Math.min(1, value));
}

export function getMarkerState(stageTop: number, viewportHeight: number, viewportWidth: number) {
  const start = viewportHeight * 0.62;
  const end = viewportHeight * 0.18;
  const progress = clampHomepageProgress((start - stageTop) / (start - end));
  const dockTop = viewportWidth <= HOMEPAGE_BREAKPOINT
    ? 150
    : Math.round(72 + Math.max(0, Math.min(viewportWidth, viewportHeight) - 982) * 0.0537);
  const y = progress * -(viewportHeight / 2 - dockTop);
  return { progress, y, dockTop, transform: `translate(-50%, calc(-50% + ${y}px))` };
}

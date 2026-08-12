import { expect, type Page, type PageScreenshotOptions } from "@playwright/test";

type SettledVisualOptions = {
  route: string | RegExp;
  readySelector: string;
  readyAttribute?: { name: string; value: string | RegExp };
  imageRoot?: string;
};

export type SettledImageRecord = {
  src: string;
  currentSrc: string;
  alt: string;
  complete: boolean;
  naturalWidth: number;
  naturalHeight: number;
  loading: string;
  decoding: string;
  display: string;
  visibility: string;
  opacity: string;
  background: string;
  nearestHref: string | null;
  clippedBy: string[];
};

export async function inspectSettledImages(page: Page, root = "main"): Promise<SettledImageRecord[]> {
  return page.locator(`${root} img`).evaluateAll((images) => images.map((node) => {
    const image = node as HTMLImageElement;
    const style = getComputedStyle(image);
    const clippedBy: string[] = [];
    let ancestor = image.parentElement;
    while (ancestor && ancestor !== document.body) {
      const ancestorStyle = getComputedStyle(ancestor);
      if ([ancestorStyle.overflow, ancestorStyle.overflowX, ancestorStyle.overflowY].some((value) => value === "hidden" || value === "clip")) {
        clippedBy.push(ancestor.className || ancestor.tagName.toLowerCase());
      }
      ancestor = ancestor.parentElement;
    }
    return {
      src: image.getAttribute("src") ?? "",
      currentSrc: image.currentSrc,
      alt: image.alt,
      complete: image.complete,
      naturalWidth: image.naturalWidth,
      naturalHeight: image.naturalHeight,
      loading: image.loading,
      decoding: image.decoding,
      display: style.display,
      visibility: style.visibility,
      opacity: style.opacity,
      background: style.background,
      nearestHref: image.closest("a")?.getAttribute("href") ?? null,
      clippedBy,
    };
  }));
}

export async function settleVisual(page: Page, options: SettledVisualOptions) {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.waitForLoadState("domcontentloaded");
  await expect.poll(() => new URL(page.url()).pathname).toMatch(options.route);
  const ready = page.locator(options.readySelector);
  await expect(ready).toBeVisible();
  if (options.readyAttribute) await expect(ready).toHaveAttribute(options.readyAttribute.name, options.readyAttribute.value);
  await page.evaluate(async () => { await document.fonts.ready; });

  await page.evaluate(async () => {
    const initialY = window.scrollY;
    const viewport = Math.max(window.innerHeight, 1);
    const height = document.documentElement.scrollHeight;
    for (let y = 0; y < height; y += Math.max(320, Math.floor(viewport * 0.8))) {
      window.scrollTo(0, y);
      await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
    }
    window.scrollTo(0, initialY);
    await Promise.all([...document.images].map(async (image) => {
      if (!image.complete) await new Promise<void>((resolve) => {
        image.addEventListener("load", () => resolve(), { once: true });
        image.addEventListener("error", () => resolve(), { once: true });
      });
      try { await image.decode(); } catch { /* surfaced by the natural-size assertion below */ }
    }));
  });

  const images = await inspectSettledImages(page, options.imageRoot ?? "main");
  const broken = images.filter((image) => !image.complete || image.naturalWidth <= 0 || image.naturalHeight <= 0);
  expect(broken, "all local artwork in the capture region must decode").toEqual([]);

  const layoutStable = await page.evaluate(async () => {
    let prior = "";
    let stableFrames = 0;
    for (let frame = 0; frame < 30; frame += 1) {
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      const current = `${document.documentElement.scrollWidth}:${document.documentElement.scrollHeight}:${document.body.getBoundingClientRect().height}`;
      stableFrames = current === prior ? stableFrames + 1 : 0;
      if (stableFrames >= 2) return true;
      prior = current;
    }
    return false;
  });
  expect(layoutStable, "layout dimensions must remain stable for three animation frames").toBe(true);
  return images;
}

export async function captureSettledVisual(page: Page, options: SettledVisualOptions, screenshot: PageScreenshotOptions) {
  const images = await settleVisual(page, options);
  await page.screenshot({ animations: "disabled", ...screenshot });
  return images;
}

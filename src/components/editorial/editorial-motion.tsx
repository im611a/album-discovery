"use client";

import { animate, createScope } from "animejs";
import { useEffect, useRef, type ReactNode } from "react";

const clamp = (value: number) => Math.min(1, Math.max(0, value));
const HOME_SCROLL_KEY = "album-discovery:v1.1-home-scroll";

export function getScrollProgress(
  scrollY: number,
  sectionTop: number,
  sectionHeight: number,
  viewportHeight: number,
) {
  return clamp((scrollY - sectionTop) / Math.max(1, sectionHeight - viewportHeight));
}

export function getGalleryItemProgress(progress: number, index: number, total: number) {
  const entryStart = 0.08 + (index / Math.max(1, total - 1)) * 0.48;
  const entry = clamp((progress - entryStart) / 0.15);
  const exitStart = 0.78 + (index % 3) * 0.035;
  const exit = clamp((progress - exitStart) / 0.16);
  return clamp(entry * (1 - exit * 0.82));
}

export function getDeckActiveIndex(progress: number, count: number) {
  if (count <= 1) return 0;
  return Math.min(count - 1, Math.max(0, Math.floor(clamp(progress) * count)));
}

function setInteractiveState(container: HTMLElement, interactive: boolean) {
  if (!interactive && container.contains(document.activeElement)) return;
  container.setAttribute("aria-hidden", interactive ? "false" : "true");
  container.querySelectorAll<HTMLElement>("a, button, input, select, textarea, [tabindex]")
    .forEach((element) => {
      if (interactive) {
        if (element.dataset.motionTabindex === "none") element.removeAttribute("tabindex");
        else if (element.dataset.motionTabindex) element.setAttribute("tabindex", element.dataset.motionTabindex);
        delete element.dataset.motionTabindex;
      } else {
        if (!element.dataset.motionTabindex) {
          element.dataset.motionTabindex = element.hasAttribute("tabindex")
            ? element.getAttribute("tabindex") ?? "none"
            : "none";
        }
        element.setAttribute("tabindex", "-1");
      }
    });
}

function motionIsReduced() {
  return (typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches) ||
    new URLSearchParams(window.location.search).get("visualTest") === "1";
}

export function EditorialMotion({ children, className }: { children: ReactNode; className?: string }) {
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = root.current;
    if (!element) return;

    const reduced = motionIsReduced();
    const coarsePointer = typeof window.matchMedia === "function" &&
      window.matchMedia("(pointer: coarse)").matches;
    const gallery = element.querySelector<HTMLElement>("[data-motion-gallery]");
    const galleryItems = [...element.querySelectorAll<HTMLElement>("[data-motion-gallery-item]")];
    const deck = element.querySelector<HTMLElement>("[data-motion-deck]");
    const deckItems = [...element.querySelectorAll<HTMLElement>("[data-motion-deck-item]")];
    const pointerTarget = { x: 0, y: 0 };
    const pointerCurrent = { x: 0, y: 0 };
    let frameId = 0;
    let scrollDirty = true;
    let pointerDirty = false;
    let navigationSaved = false;

    const saveNavigationPosition = () => {
      try {
        window.sessionStorage.setItem(HOME_SCROLL_KEY, JSON.stringify({
          y: window.scrollY,
          savedAt: Date.now(),
        }));
        navigationSaved = true;
      } catch {
        // Session storage is an optional enhancement; native navigation remains usable.
      }
    };

    const updateScroll = () => {
      if (!scrollDirty) return;
      scrollDirty = false;
      if (gallery) {
        const bounds = gallery.getBoundingClientRect();
        const progress = getScrollProgress(
          window.scrollY,
          window.scrollY + bounds.top,
          gallery.offsetHeight,
          window.innerHeight,
        );
        element.style.setProperty("--gallery-scroll", progress.toFixed(4));
        element.dataset.galleryStage = String(Math.min(4, Math.floor(progress * 5)));
        galleryItems.forEach((item, index) => {
          const itemProgress = getGalleryItemProgress(progress, index, galleryItems.length);
          item.style.setProperty("--gallery-item-progress", itemProgress.toFixed(4));
          item.dataset.revealed = itemProgress > 0.08 ? "true" : "false";
          setInteractiveState(item, itemProgress > 0.08);
        });
      }

      if (deck) {
        const bounds = deck.getBoundingClientRect();
        element.dataset.deckVisible = bounds.bottom > 0 && bounds.top < window.innerHeight
          ? "true"
          : "false";
        const progress = getScrollProgress(
          window.scrollY,
          window.scrollY + bounds.top,
          deck.offsetHeight,
          window.innerHeight,
        );
        const activeIndex = getDeckActiveIndex(progress, deckItems.length);
        element.style.setProperty("--deck-scroll", progress.toFixed(4));
        element.dataset.deckIndex = String(activeIndex);
        deckItems.forEach((item, index) => {
          const active = index === activeIndex;
          item.dataset.active = active ? "true" : "false";
          setInteractiveState(item, active);
        });
      }
    };

    const updatePointer = () => {
      if (!pointerDirty) return;
      pointerCurrent.x += (pointerTarget.x - pointerCurrent.x) * 0.16;
      pointerCurrent.y += (pointerTarget.y - pointerCurrent.y) * 0.16;
      element.style.setProperty("--pointer-x", pointerCurrent.x.toFixed(4));
      element.style.setProperty("--pointer-y", pointerCurrent.y.toFixed(4));
      const settled = Math.abs(pointerTarget.x - pointerCurrent.x) < 0.002 &&
        Math.abs(pointerTarget.y - pointerCurrent.y) < 0.002;
      pointerDirty = !settled;
      if (settled) {
        pointerCurrent.x = pointerTarget.x;
        pointerCurrent.y = pointerTarget.y;
      }
    };

    const runFrame = () => {
      frameId = 0;
      updateScroll();
      updatePointer();
      if (scrollDirty || pointerDirty) frameId = window.requestAnimationFrame(runFrame);
      else element.dataset.rafActive = "false";
    };

    const requestFrame = () => {
      if (frameId) return;
      element.dataset.rafActive = "true";
      frameId = window.requestAnimationFrame(runFrame);
    };

    const onScroll = () => {
      scrollDirty = true;
      requestFrame();
    };
    const onResize = () => {
      scrollDirty = true;
      requestFrame();
    };
    const onPointerMove = (event: PointerEvent) => {
      if (!gallery || reduced || coarsePointer) return;
      const rect = gallery.getBoundingClientRect();
      pointerTarget.x = clamp((event.clientX - rect.left) / Math.max(1, rect.width)) * 2 - 1;
      pointerTarget.y = clamp((event.clientY - rect.top) / Math.max(1, rect.height)) * 2 - 1;
      pointerDirty = true;
      requestFrame();
    };
    const onPointerLeave = () => {
      pointerTarget.x = 0;
      pointerTarget.y = 0;
      pointerDirty = true;
      requestFrame();
    };
    const onVisibility = () => {
      element.dataset.documentHidden = document.hidden ? "true" : "false";
    };
    const onInternalNavigation = (event: MouseEvent) => {
      const target = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>("a[href]") : null;
      if (target?.href.startsWith(window.location.origin)) saveNavigationPosition();
    };

    element.dataset.motionReady = "true";
    element.dataset.motionMode = reduced ? "reduced" : "full";
    onVisibility();

    if (!reduced) {
      try {
        const saved = JSON.parse(window.sessionStorage.getItem(HOME_SCROLL_KEY) ?? "null") as
          | { y: number; savedAt: number }
          | null;
        window.sessionStorage.removeItem(HOME_SCROLL_KEY);
        if (saved && saved.y > 0 && Date.now() - saved.savedAt < 5 * 60_000) {
          window.requestAnimationFrame(() => window.requestAnimationFrame(() => window.scrollTo(0, saved.y)));
          window.setTimeout(() => window.scrollTo(0, saved.y), 120);
        }
      } catch {
        // Session storage is an optional enhancement; native navigation remains usable.
      }
    }

    if (reduced) {
      galleryItems.forEach((item) => setInteractiveState(item, true));
      deckItems.forEach((item) => setInteractiveState(item, true));
    } else {
      const scope = createScope({ root: element }).add(() => {
        animate(element.querySelectorAll("[data-motion-opening-copy]"), {
          opacity: { from: 0 },
          y: { from: 18 },
          duration: 700,
          ease: "out(3)",
        });
      });
      window.addEventListener("scroll", onScroll, { passive: true });
      window.addEventListener("resize", onResize, { passive: true });
      gallery?.addEventListener("pointermove", onPointerMove, { passive: true });
      gallery?.addEventListener("pointerleave", onPointerLeave, { passive: true });
      document.addEventListener("visibilitychange", onVisibility);
      element.addEventListener("click", onInternalNavigation, true);
      requestFrame();

      return () => {
        if (!navigationSaved) saveNavigationPosition();
        if (frameId) window.cancelAnimationFrame(frameId);
        window.removeEventListener("scroll", onScroll);
        window.removeEventListener("resize", onResize);
        gallery?.removeEventListener("pointermove", onPointerMove);
        gallery?.removeEventListener("pointerleave", onPointerLeave);
        document.removeEventListener("visibilitychange", onVisibility);
        element.removeEventListener("click", onInternalNavigation, true);
        galleryItems.forEach((item) => setInteractiveState(item, true));
        deckItems.forEach((item) => setInteractiveState(item, true));
        scope.revert();
        delete element.dataset.motionReady;
      };
    }
  }, []);

  return <div ref={root} className={className} data-editorial-motion>{children}</div>;
}

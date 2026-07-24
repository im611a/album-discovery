"use client";

import { animate, createScope, stagger } from "animejs";
import { useEffect, useRef, type ReactNode } from "react";

function motionIsReduced() {
  return (typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches) ||
    new URLSearchParams(window.location.search).get("visualTest") === "1";
}

export function EditorialMotion({ children, className }: { children: ReactNode; className?: string }) {
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!root.current) return;
    root.current.dataset.motionReady = "true";
    if (motionIsReduced()) return;

    const scope = createScope({ root: root.current }).add(() => {
      const openingItems = root.current?.querySelectorAll<HTMLElement>("[data-motion-opening]") ?? [];
      animate(openingItems, {
        opacity: { from: 0 },
        y: { from: 26 },
        duration: 720,
        delay: stagger(70),
        ease: "out(3)",
      });

      if (typeof IntersectionObserver !== "function") return;
      const observer = new IntersectionObserver((entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          observer.unobserve(entry.target);
          animate(entry.target, {
            opacity: { from: 0 },
            y: { from: 30 },
            duration: 680,
            ease: "out(3)",
          });
        }
      }, { rootMargin: "0px 0px -10% 0px", threshold: 0.08 });
      root.current?.querySelectorAll("[data-motion-reveal]").forEach((element) => observer.observe(element));
      return () => observer.disconnect();
    });

    return () => scope.revert();
  }, []);

  return <div ref={root} className={className} data-editorial-motion>{children}</div>;
}

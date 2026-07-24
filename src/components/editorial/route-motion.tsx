"use client";

import { animate, createScope } from "animejs";
import { usePathname } from "next/navigation";
import { useEffect } from "react";

export type RouteMotionLevel = "A" | "B" | "C" | "D";

export function getRouteMotionLevel(pathname: string): RouteMotionLevel {
  if (pathname === "/") return "A";
  if (
    pathname.startsWith("/albums/") ||
    pathname.startsWith("/artists/artist-") ||
    pathname.startsWith("/genres/core/") ||
    pathname.startsWith("/genres/related/") ||
    pathname.startsWith("/scenes/") ||
    pathname.startsWith("/decades/")
  ) return "B";
  if (pathname === "/settings" || pathname === "/about" || pathname.includes("not-found")) return "D";
  return "C";
}

export function RouteMotion() {
  const pathname = usePathname();

  useEffect(() => {
    const body = document.body;
    const level = document.querySelector(".not-found-main") ? "D" : getRouteMotionLevel(pathname);
    body.dataset.routeMotion = level;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
      new URLSearchParams(window.location.search).get("visualTest") === "1";
    if (reduced || level === "D" || pathname === "/") return;

    const scope = createScope({ root: body }).add(() => {
      const targets = document.querySelectorAll(
        level === "B"
          ? "main h1, main .breadcrumbs, main .album-detail__cover"
          : "main .page-intro, main .search-form, main .filter-panel",
      );
      animate(targets, {
        opacity: { from: 0 },
        y: { from: level === "B" ? 22 : 12 },
        duration: level === "B" ? 720 : 460,
        delay: (_target: unknown, index = 0) => index * 55,
        ease: "out(3)",
      });
    });
    return () => scope.revert();
  }, [pathname]);

  return null;
}

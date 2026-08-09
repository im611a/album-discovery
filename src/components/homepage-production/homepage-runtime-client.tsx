"use client";

import { useEffect, useRef } from "react";
import type { HomepageStageAlbum } from "./homepage-data-adapter";

export function HomepageRuntimeClient({
  stageAlbums,
  children,
}: {
  stageAlbums: readonly HomepageStageAlbum[];
  children: React.ReactNode;
}) {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    let cancelled = false;
    let dispose: (() => void) | undefined;
    void import("./runtime/mount-runtime.js").then(async ({ mountHomepageRuntime }) => {
      const controller = await mountHomepageRuntime(root, stageAlbums);
      if (cancelled) {
        controller();
        return;
      }
      dispose = controller;
    });
    return () => {
      cancelled = true;
      dispose?.();
    };
  }, [stageAlbums]);

  return <div ref={rootRef} className="ad-home" data-homepage-production>{children}</div>;
}

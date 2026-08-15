"use client";

import Link from "next/link";
import { Suspense, useMemo, type ComponentProps, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import {
  appendNavigationOrigin,
} from "@/catalog/navigation-origin";
import { buildRecentReturnContext } from "@/catalog/recent-return-navigation";
import { catalogAlbums } from "@/catalog/published-catalog";

type ReturnContextLinkProps = Omit<ComponentProps<typeof Link>, "href"> & {
  readonly href: string;
  readonly children?: ReactNode;
};

function ContextLink({ href, ...props }: ReturnContextLinkProps) {
  const params = useSearchParams();
  const query = params?.toString() ?? "";
  const contextualHref = useMemo(() => appendNavigationOrigin(href, query), [href, query]);
  return <Link href={contextualHref} {...props} />;
}

export function ReturnContextLink(props: ReturnContextLinkProps) {
  return <Suspense fallback={<Link {...props} />}><ContextLink {...props} /></Suspense>;
}

function Affordance() {
  const params = useSearchParams();
  const context = buildRecentReturnContext(params?.toString() ?? "", catalogAlbums);
  if (!context) return null;
  return (
    <nav className="r15-return-journey r17-return-journey" aria-label="返回此前浏览位置" data-navigation-origin={context.origin.toLowerCase()}>
      <Link href={context.href}>{context.label} <span aria-hidden="true">↩</span></Link>
      <span>{context.detail}</span>
    </nav>
  );
}

export function ReturnJourneyAffordance() {
  return <Suspense fallback={null}><Affordance /></Suspense>;
}

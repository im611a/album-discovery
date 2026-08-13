"use client";

import Link from "next/link";
import { Suspense, useMemo, type ComponentProps, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import {
  appendNavigationOrigin,
  buildNavigationReturnHref,
  parseNavigationOrigin,
} from "@/catalog/navigation-origin";

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
  const origin = parseNavigationOrigin(params?.toString() ?? "");
  const href = buildNavigationReturnHref(origin);
  if (!href) return null;
  const library = origin.kind === "LIBRARY";
  const context = library
    ? origin.query ? `保留筛选“${origin.query}”` : origin.view === "overview" ? "回到馆藏概览" : "回到原馆藏分类"
    : origin.kind === "SEARCH" && origin.query ? `回到“${origin.query}”的结果` : "回到搜索";
  return (
    <nav className="r15-return-journey" aria-label="返回此前浏览位置" data-navigation-origin={origin.kind.toLowerCase()}>
      <Link href={href}>{library ? "返回我的专辑" : "返回搜索结果"} <span aria-hidden="true">↩</span></Link>
      <span>{context}</span>
    </nav>
  );
}

export function ReturnJourneyAffordance() {
  return <Suspense fallback={null}><Affordance /></Suspense>;
}

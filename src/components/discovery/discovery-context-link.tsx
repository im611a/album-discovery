"use client";

import Link from "next/link";
import { Suspense, useMemo, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import { buildCrossProductEntityHref } from "@/catalog/contextual-navigation";
import { catalogAlbums } from "@/catalog/published-catalog";

interface DiscoveryContextLinkProps {
  readonly href: string;
  readonly currentAlbumSlug: string;
  readonly children: ReactNode;
  readonly className?: string;
  readonly ariaLabel?: string;
}

function ContextLink({
  href,
  currentAlbumSlug,
  children,
  className,
  ariaLabel,
}: DiscoveryContextLinkProps) {
  const searchParams = useSearchParams();
  const query = searchParams.toString();
  const contextualHref = useMemo(
    () => buildCrossProductEntityHref({
      pathname: href,
      currentAlbumSlug,
      searchParams: query,
      catalog: catalogAlbums,
    }),
    [currentAlbumSlug, href, query],
  );
  return <Link href={contextualHref} className={className} aria-label={ariaLabel}>{children}</Link>;
}

export function DiscoveryContextLink(props: DiscoveryContextLinkProps) {
  return (
    <Suspense fallback={<Link href={props.href} className={props.className} aria-label={props.ariaLabel}>{props.children}</Link>}>
      <ContextLink {...props} />
    </Suspense>
  );
}

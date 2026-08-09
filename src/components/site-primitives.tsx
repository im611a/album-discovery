import type { ReactNode } from "react";

import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { cn } from "@/lib/utils";

export function SiteShell({
  children,
  mainClassName,
}: {
  children: ReactNode;
  mainClassName?: string;
}) {
  return (
    <div className="site-shell">
      <SiteHeader />
      <main className={cn("page-main page-container", mainClassName)} id="main-content">
        {children}
      </main>
      <SiteFooter />
    </div>
  );
}

export function PageHeader({
  eyebrow,
  title,
  children,
  className,
  family = "discovery",
}: {
  eyebrow: string;
  title: string;
  children: ReactNode;
  className?: string;
  family?: "discovery" | "utility" | "personal";
}) {
  return (
    <div className={cn("page-intro", className)} data-page-family={family}>
      <p className="eyebrow">{eyebrow}</p>
      <h1>{title}</h1>
      <p>{children}</p>
    </div>
  );
}

export function PageSection({
  children,
  className,
  labelledBy,
}: {
  children: ReactNode;
  className?: string;
  labelledBy?: string;
}) {
  return (
    <section className={cn("page-section", className)} aria-labelledby={labelledBy}>
      {children}
    </section>
  );
}

export function PageGrid({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={cn("page-grid", className)}>{children}</div>;
}

export function EmptyState({
  title,
  children,
  actions,
}: {
  title: string;
  children: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <h2>{title}</h2>
      <p>{children}</p>
      {actions ? <div className="empty-state__actions">{actions}</div> : null}
    </div>
  );
}

export function ErrorState({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="error-state" role="alert">
      <h2>{title}</h2>
      <p>{children}</p>
    </div>
  );
}

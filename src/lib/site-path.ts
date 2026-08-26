const configuredBasePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export const SITE_BASE_PATH = configuredBasePath;

export function withBasePath(pathname: string) {
  if (!SITE_BASE_PATH || !pathname.startsWith("/") || pathname.startsWith("//")) return pathname;
  if (pathname === SITE_BASE_PATH || pathname.startsWith(`${SITE_BASE_PATH}/`)) return pathname;
  return `${SITE_BASE_PATH}${pathname}`;
}

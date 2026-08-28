export const siteNavigationGroups = [
  { label: "发现", items: [{ kind: "link", href: "/discover", label: "目录" }] },
  { label: "个人", items: [{ kind: "link", href: "/for-you", label: "推荐" }, { kind: "link", href: "/library", label: "我的专辑" }] },
  { label: "档案", items: [{ kind: "link", href: "/artists", label: "艺人" }, { kind: "search", label: "搜索" }, { kind: "link", href: "/settings", label: "设置" }] },
] as const;

export function isNavigationItemActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

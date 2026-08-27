export const siteNavigationGroups = [
  { label: "发现", items: [["/discover", "目录"], ["/decades", "年代"]] },
  { label: "个人", items: [["/for-you", "推荐"], ["/library", "我的专辑"]] },
  { label: "档案", items: [["/new-releases", "最近收录"], ["/artists", "艺人"], ["/search", "搜索"], ["/settings", "设置"]] },
] as const;

export function isNavigationItemActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

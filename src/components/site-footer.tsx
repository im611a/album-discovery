import { SITE_NAME } from "@/lib/site";

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="page-container site-footer__inner">
        <p>{SITE_NAME} · 静态界面原型</p>
        <p>当前内容均为本地虚构数据，不代表真实专辑或评分。</p>
      </div>
    </footer>
  );
}

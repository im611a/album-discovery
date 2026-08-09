import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { Breadcrumb, ExternalLink, FilterGroup, SearchInput, Select } from "./control-primitives";
import { EmptyState, PageHeader, SiteShell } from "./site-primitives";

vi.mock("next/navigation", () => ({ usePathname: () => "/discover" }));

describe("R9 shared page primitives", () => {
  it("renders one shared header, main region and footer for inner routes", () => {
    render(<SiteShell><PageHeader eyebrow="目录" title="测试页面">页面说明</PageHeader></SiteShell>);
    expect(screen.getAllByRole("banner")).toHaveLength(1);
    expect(screen.getByRole("main")).toHaveAttribute("id", "main-content");
    expect(screen.getByRole("contentinfo")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1, name: "测试页面" })).toBeInTheDocument();
  });

  it("keeps shared empty, form, breadcrumb and external-link semantics accessible", () => {
    render(<>
      <FilterGroup label="分类"><Select aria-label="分类" defaultValue=""><option value="">全部</option></Select></FilterGroup>
      <SearchInput aria-label="搜索" />
      <Breadcrumb items={[{ label: "发现", href: "/discover" }, { label: "当前页" }]} />
      <ExternalLink href="https://music.163.com/#/album?id=1">网易云音乐</ExternalLink>
      <EmptyState title="没有结果">调整筛选后重试。</EmptyState>
    </>);
    expect(screen.getByLabelText("分类")).toHaveDisplayValue("全部");
    expect(screen.getByRole("searchbox", { name: "搜索" })).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "面包屑" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "网易云音乐" })).toHaveAttribute("rel", "noopener noreferrer");
    expect(screen.getByRole("heading", { name: "没有结果" })).toBeInTheDocument();
  });
});

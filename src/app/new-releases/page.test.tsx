import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import NewReleasesPage from "./page";

vi.mock("next/navigation", () => ({
  usePathname: () => "/new-releases",
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

describe("NewReleasesPage", () => {
  it("renders the static new-release page and its source limitation", () => {
    render(<NewReleasesPage />);

    expect(screen.getByRole("heading", { name: "新发行", level: 1 })).toBeInTheDocument();
    expect(screen.getByText(/当前内容均为本地虚构原型数据/)).toBeInTheDocument();
    expect(screen.getByText(/不表示任何国籍、语言、法域或真实地区分类/)).toBeInTheDocument();
  });
});

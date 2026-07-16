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
    expect(screen.getByText(/当前为本地虚构数据/)).toBeInTheDocument();
    expect(screen.getByText(/网易云新发行列表/)).toBeInTheDocument();
    expect(screen.getByText(/仅用于浏览新碟/)).toBeInTheDocument();
  });
});

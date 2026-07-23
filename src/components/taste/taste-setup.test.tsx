import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PersonalStateProvider } from "@/features/personal-state/personal-state-provider";
import { TasteSetup } from "./taste-setup";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

describe("TasteSetup", () => {
  beforeEach(() => { localStorage.clear(); push.mockClear(); });
  it("requires two signals and completes with standard navigation", async () => {
    render(<PersonalStateProvider><TasteSetup /></PersonalStateProvider>);
    const submit = await screen.findByRole("button", { name: "查看我的推荐" });
    expect(submit).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "艺术流行（Art Pop）" }));
    fireEvent.click(screen.getByRole("button", { name: "朦胧（Hazy）" }));
    expect(submit).toBeEnabled(); fireEvent.click(submit);
    expect(push).toHaveBeenCalledWith("/for-you");
  });
  it("supports a useful skip path", async () => {
    render(<PersonalStateProvider><TasteSetup /></PersonalStateProvider>);
    fireEvent.click(await screen.findByRole("button", { name: "跳过设置" }));
    expect(push).toHaveBeenCalledWith("/for-you");
  });
  it("can save edits in place from settings", async () => {
    render(<PersonalStateProvider><TasteSetup redirectTo={null} /></PersonalStateProvider>);
    await screen.findByRole("button", { name: "保存口味" });
    expect(screen.queryByRole("button", { name: "跳过设置" })).not.toBeInTheDocument();
  });
});

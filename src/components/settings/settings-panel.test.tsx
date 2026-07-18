import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SettingsPanel } from "./settings-panel";

const importJson = vi.fn(() => ({ ok: true as const }));
const reset = vi.fn();
vi.mock("@/features/personal-state/personal-state-provider", () => ({
  usePersonalState: () => ({ exportJson: () => "{}", importJson, reset, storageAvailable: true }),
}));
vi.mock("@/components/taste/taste-setup", () => ({ TasteSetup: () => <div>口味设置</div> }));

describe("SettingsPanel import, export, and reset", () => {
  beforeEach(() => { importJson.mockClear(); reset.mockClear(); vi.restoreAllMocks(); });

  it("labels the hidden file input and keeps it out of the tab order", () => {
    render(<SettingsPanel />);
    const input = screen.getByLabelText("选择要导入的 JSON 文件");
    expect(input).toHaveAttribute("tabindex", "-1");
    expect(input).toHaveAttribute("accept", "application/json,.json");
  });

  it("rejects a file over 100KB before reading its text", async () => {
    render(<SettingsPanel />);
    const text = vi.fn(async () => "{}");
    const file = { name: "huge.json", size: 100_001, text } as unknown as File;
    fireEvent.change(screen.getByLabelText("选择要导入的 JSON 文件"), { target: { files: [file] } });
    expect(await screen.findByText("导入文件过大。")).toBeInTheDocument();
    expect(text).not.toHaveBeenCalled();
    expect(importJson).not.toHaveBeenCalled();
  });

  it("reads and validates an allowed JSON file", async () => {
    render(<SettingsPanel />);
    const file = new File(["{}"], "state.json", { type: "application/json" });
    fireEvent.change(screen.getByLabelText("选择要导入的 JSON 文件"), { target: { files: [file] } });
    await waitFor(() => expect(importJson).toHaveBeenCalledWith("{}"));
    expect(screen.getByRole("status")).toHaveTextContent("state.json");
  });

  it("requires confirmation before reset and respects cancel", () => {
    vi.spyOn(window, "confirm").mockReturnValueOnce(false).mockReturnValueOnce(true);
    render(<SettingsPanel />);
    fireEvent.click(screen.getByRole("button", { name: "重置全部" }));
    expect(reset).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "重置全部" }));
    expect(reset).toHaveBeenCalledTimes(1);
  });
});

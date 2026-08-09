import { act, render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { homepageContent } from "./homepage-data-adapter";
import { HomepageRuntimeClient } from "./homepage-runtime-client";
import { mountHomepageRuntime } from "./runtime/mount-runtime.js";

vi.mock("./runtime/mount-runtime.js", () => ({ mountHomepageRuntime: vi.fn() }));

describe("homepage runtime lifecycle boundary", () => {
  beforeEach(() => vi.mocked(mountHomepageRuntime).mockReset());

  it("mounts once and disposes on unmount", async () => {
    const dispose = vi.fn();
    vi.mocked(mountHomepageRuntime).mockResolvedValue(dispose);
    const view = render(<HomepageRuntimeClient stageAlbums={homepageContent.stage}><canvas /></HomepageRuntimeClient>);
    await act(async () => { await Promise.resolve(); });
    expect(mountHomepageRuntime).toHaveBeenCalledTimes(1);
    view.unmount();
    expect(dispose).toHaveBeenCalledTimes(1);
  });

  it("survives five route-style remounts without retaining controllers", async () => {
    const disposers = Array.from({ length: 5 }, () => vi.fn());
    disposers.forEach((dispose) => vi.mocked(mountHomepageRuntime).mockResolvedValueOnce(dispose));
    for (let index = 0; index < 5; index += 1) {
      const view = render(<HomepageRuntimeClient stageAlbums={homepageContent.stage}><canvas /></HomepageRuntimeClient>);
      await act(async () => { await Promise.resolve(); });
      view.unmount();
    }
    expect(mountHomepageRuntime).toHaveBeenCalledTimes(5);
    expect(disposers.every((dispose) => dispose.mock.calls.length === 1)).toBe(true);
  });
});

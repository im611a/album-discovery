import { describe, expect, it } from "vitest";

import { cn } from "./utils";

describe("cn", () => {
  it("combines conditional classes and resolves Tailwind conflicts", () => {
    expect(cn("px-2", "px-4", { block: true, hidden: false })).toBe(
      "px-4 block",
    );
  });
});

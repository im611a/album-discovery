import path from "node:path";

import { describe, expect, it } from "vitest";

import { ACCEPTED_EVIDENCE_ROOTS, assertDisposableEvidenceRoot, resolveRegressionEvidenceRoot } from "../tests/e2e/helpers/evidence-output.ts";

describe("accepted-evidence capture isolation", () => {
  const repoRoot = path.resolve("D:/Projects/album-discovery");

  it("defaults ordinary regression to process-isolated scratch", () => {
    const result = resolveRegressionEvidenceRoot({ phase: "r15-2c", repoRoot });
    expect(result).toContain(path.join(".local-data", "regression-capture-scratch", "r15-2c", String(process.pid)));
  });

  it("is deterministic within one process", () => {
    expect(resolveRegressionEvidenceRoot({ phase: "r15-2c", repoRoot })).toBe(resolveRegressionEvidenceRoot({ phase: "r15-2c", repoRoot }));
  });

  it("keeps R15 and R16 namespaces separate", () => {
    expect(resolveRegressionEvidenceRoot({ phase: "r15-2c", repoRoot })).not.toBe(resolveRegressionEvidenceRoot({ phase: "r16-2c", repoRoot }));
  });

  it("chooses scratch when the optional environment value is omitted", () => {
    expect(resolveRegressionEvidenceRoot({ phase: "r15-2g", environmentValue: undefined, repoRoot })).toContain("regression-capture-scratch");
  });

  it.each(ACCEPTED_EVIDENCE_ROOTS)("rejects accepted root %s", (accepted) => {
    expect(() => assertDisposableEvidenceRoot(path.join(repoRoot, accepted), repoRoot)).toThrow(/read-only/);
  });

  it("rejects descendants of an accepted root", () => {
    expect(() => assertDisposableEvidenceRoot(path.join(repoRoot, ACCEPTED_EVIDENCE_ROOTS[4], "screenshots"), repoRoot)).toThrow(/read-only/);
  });

  it("allows explicit disposable process namespaces", () => {
    expect(() => assertDisposableEvidenceRoot(path.join(repoRoot, ".local-data/regression-capture-scratch/parallel/worker-2"), repoRoot)).not.toThrow();
  });

  it("does not treat a similarly prefixed sibling as protected", () => {
    expect(() => assertDisposableEvidenceRoot(path.join(repoRoot, `${ACCEPTED_EVIDENCE_ROOTS[4]}-scratch`), repoRoot)).not.toThrow();
  });
});

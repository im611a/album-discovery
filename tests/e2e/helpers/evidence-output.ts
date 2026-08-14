import path from "node:path";

export const ACCEPTED_EVIDENCE_ROOTS = [
  ".local-data/r13-product-evolution/r13-3c-album-discovery",
  ".local-data/r13-product-evolution/r13-3d-visible-activation",
  ".local-data/r13-product-evolution/r13-3e-visible-activation",
  ".local-data/r13-product-evolution/r13-3f-final-acceptance",
  ".local-data/r15-product-evolution/r15-2c-visible-library",
  ".local-data/r15-product-evolution/r15-2g-return-journey",
  ".local-data/r16-product-evolution/r16-2c-visible-artist-collection",
] as const;

function contains(root: string, candidate: string) {
  const relative = path.relative(root, candidate);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

export function assertDisposableEvidenceRoot(candidate: string, repoRoot = path.resolve(".")) {
  const resolved = path.resolve(candidate);
  for (const protectedPath of ACCEPTED_EVIDENCE_ROOTS) {
    const protectedRoot = path.resolve(repoRoot, protectedPath);
    if (contains(protectedRoot, resolved)) {
      throw new Error(`Accepted evidence is read-only: ${protectedPath}`);
    }
  }
  return resolved;
}

export function resolveRegressionEvidenceRoot(input: {
  phase: string;
  environmentValue?: string;
  repoRoot?: string;
}) {
  const repoRoot = path.resolve(input.repoRoot ?? ".");
  const fallback = path.join(repoRoot, ".local-data", "regression-capture-scratch", input.phase, String(process.pid));
  return assertDisposableEvidenceRoot(input.environmentValue ? path.resolve(repoRoot, input.environmentValue) : fallback, repoRoot);
}

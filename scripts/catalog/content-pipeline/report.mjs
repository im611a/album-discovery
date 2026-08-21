import { DISPOSITION, PIPELINE_VERSION } from "./contracts.mjs";
import { fingerprint } from "./utils.mjs";

export function buildMachineReport({ batch, baseline, input, records, candidate, frozenDebt, review }) {
  const counts = Object.fromEntries(Object.values(DISPOSITION).map((value) => [value, records.filter((record) => record.disposition === value).length]));
  const report = {
    schema: `${PIPELINE_VERSION}/dry-run-report/v1`,
    mode: "DRY_RUN",
    batch,
    baseline,
    input,
    frozenDebt,
    review,
    counts: { rowsTotal: records.length, ...counts },
    records: records.map((record) => ({
      row: record.rowNumber,
      albumId: record.albumId,
      expectedTitle: record.expectedTitle,
      expectedArtists: record.expectedArtists,
      disposition: record.disposition,
      duplicate: record.duplicate,
      artistResolution: record.artistResolution,
      proposed: record.proposed,
      source: record.source,
      assets: record.assets,
      findings: record.findings,
    })),
    candidate,
    productionMutation: false,
  };
  const semanticReport = { ...report, records: report.records.map((record) => Object.fromEntries(Object.entries(record).filter(([key]) => key !== "row"))) };
  return { ...report, resultFingerprint: fingerprint(semanticReport) };
}

export function humanReport(report) {
  const exceptions = report.records.filter((record) => record.disposition !== DISPOSITION.READY);
  const lines = [
    `# Content Pipeline V1 Dry-Run — ${report.batch.id}`,
    "",
    `Baseline: \`${report.baseline.catalogSha256}\``,
    `Input: \`${report.input.sha256}\``,
    `Result fingerprint: \`${report.resultFingerprint}\``,
    "",
    "## Summary",
    "",
    `- Rows: ${report.counts.rowsTotal}`,
    `- READY: ${report.counts.READY}`,
    `- SKIPPED_DUPLICATE: ${report.counts.SKIPPED_DUPLICATE}`,
    `- NEEDS_REVIEW: ${report.counts.NEEDS_REVIEW}`,
    `- ERROR: ${report.counts.ERROR}`,
    `- FATAL: ${report.counts.FATAL}`,
    "- Production mutation: NO",
    "",
    "## Exceptions",
    "",
  ];
  if (!exceptions.length) lines.push("None.");
  for (const record of exceptions) {
    lines.push(`### Row ${record.row} — ${record.albumId || "invalid Album ID"} — ${record.disposition}`, "");
    lines.push(`Expected: ${record.expectedTitle || "(missing)"} / ${record.expectedArtists.join(" | ") || "(missing)"}`, "");
    if (record.duplicate?.conflict) lines.push(`Existing conflict: ${record.duplicate.conflict.id} / ${record.duplicate.conflict.slug} / ${record.duplicate.conflict.title}`, "");
    for (const item of record.findings) lines.push(`- [${item.level}] ${item.code}: ${item.message}${item.nextAction ? ` Next: ${item.nextAction}` : ""}`);
    lines.push("");
  }
  return `${lines.join("\n")}\n`;
}

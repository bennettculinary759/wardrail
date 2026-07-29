import { builtinRules } from "../rules/builtin.js";
import { builtinProjectRules } from "../rules/project.js";
import type { ScanReport, Severity } from "../types/index.js";

const sarifLevel: Record<Severity, "error" | "warning" | "note" | "none"> = {
  critical: "error",
  high: "error",
  medium: "warning",
  low: "note",
  info: "none",
};

export function formatSarifReport(report: ScanReport): string {
  const sarif = {
    version: "2.1.0",
    $schema:
      "https://json.schemastore.org/sarif-2.1.0.json",
    runs: [
      {
        tool: {
          driver: {
            name: "Wardrail",
            version: report.version,
            informationUri: "https://github.com/3196973848/wardrail",
            rules: [...builtinRules, ...builtinProjectRules].map(({ metadata }) => ({
              id: metadata.id,
              name: metadata.title.replaceAll(/\s+/g, ""),
              shortDescription: { text: metadata.title },
              fullDescription: { text: metadata.description },
              help: {
                text: metadata.remediation,
                markdown: metadata.remediation,
              },
              defaultConfiguration: {
                level: sarifLevel[metadata.severity],
              },
              properties: {
                severity: metadata.severity,
                references: metadata.references,
              },
            })),
          },
        },
        results: report.findings.map((finding) => ({
          ruleId: finding.ruleId,
          level: sarifLevel[finding.severity],
          message: { text: finding.message },
          locations: [
            {
              physicalLocation: {
                artifactLocation: { uri: finding.file },
                region: {
                  startLine: finding.line,
                  startColumn: finding.column,
                },
              },
            },
          ],
          partialFingerprints: {
            primaryLocationLineHash: finding.fingerprint,
          },
        })),
      },
    ],
  };

  return JSON.stringify(sarif, null, 2);
}

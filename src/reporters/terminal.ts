import chalk from "chalk";
import type { ScanReport, Severity } from "../types/index.js";

const severityColor: Record<Severity, (value: string) => string> = {
  critical: chalk.bgRed.white.bold,
  high: chalk.red.bold,
  medium: chalk.yellow.bold,
  low: chalk.blue.bold,
  info: chalk.gray,
};

export function formatTerminalReport(report: ScanReport, color = true): string {
  const paint = color ? severityColor : Object.fromEntries(
    Object.keys(severityColor).map((key) => [key, (value: string) => value]),
  ) as Record<Severity, (value: string) => string>;

  const output: string[] = [
    color ? chalk.bold("Wardrail Security Report") : "Wardrail Security Report",
    "",
  ];

  if (report.findings.length === 0) {
    output.push(
      color ? chalk.green("No risks found.") : "No risks found.",
      "",
      `${report.summary.filesScanned} files scanned`,
    );
    if (report.summary.baselineSuppressed > 0) {
      output.push(`${report.summary.baselineSuppressed} baseline finding(s) suppressed`);
    }
    return output.join("\n");
  }

  for (const finding of report.findings) {
    const severity = finding.severity.toUpperCase().padEnd(9);
    output.push(
      `${paint[finding.severity](severity)} ${finding.file}:${finding.line}:${finding.column}`,
      `${finding.ruleId}: ${finding.title}`,
      `  ${finding.message}`,
      `  Evidence: ${finding.evidence}`,
      `  Fix: ${finding.remediation}`,
      "",
    );
  }

  const counts = (["critical", "high", "medium", "low", "info"] as const)
    .filter((severity) => report.summary.bySeverity[severity] > 0)
    .map((severity) => `${report.summary.bySeverity[severity]} ${severity}`)
    .join(", ");
  output.push(
    `${report.summary.findings} risk${report.summary.findings === 1 ? "" : "s"} found: ${counts}`,
    `${report.summary.filesScanned} files scanned`,
  );
  if (report.summary.baselineSuppressed > 0) {
    output.push(`${report.summary.baselineSuppressed} baseline finding(s) suppressed`);
  }

  return output.join("\n");
}

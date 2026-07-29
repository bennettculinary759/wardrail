import type { ScanReport } from "../types/index.js";

export function formatJsonReport(report: ScanReport): string {
  return JSON.stringify(report, null, 2);
}

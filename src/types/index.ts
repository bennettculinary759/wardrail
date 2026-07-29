export const severityOrder = {
  info: 0,
  low: 1,
  medium: 2,
  high: 3,
  critical: 4,
} as const;

export type Severity = keyof typeof severityOrder;

export interface RuleMetadata {
  id: string;
  title: string;
  severity: Severity;
  description: string;
  remediation: string;
  references: string[];
}

export interface Finding {
  ruleId: string;
  title: string;
  severity: Severity;
  message: string;
  file: string;
  line: number;
  column: number;
  evidence: string;
  remediation: string;
  references: string[];
  fingerprint: string;
}

export interface ScanFile {
  absolutePath: string;
  relativePath: string;
  content: string;
}

export interface ScanSummary {
  filesScanned: number;
  findings: number;
  baselineSuppressed: number;
  bySeverity: Record<Severity, number>;
}

export interface ScanReport {
  version: string;
  root: string;
  scannedAt: string;
  summary: ScanSummary;
  findings: Finding[];
}

export interface WardrailConfig {
  ignore: string[];
  ignoreRules: string[];
  maxFileSize: number;
  baseline: string;
}

export interface BaselineEntry {
  fingerprint: string;
  ruleId: string;
  file: string;
}

export interface BaselineFile {
  version: 1;
  createdAt: string;
  entries: BaselineEntry[];
}

export interface Rule {
  metadata: RuleMetadata;
  scan(file: ScanFile): Finding[];
}

export interface ProjectRule {
  metadata: RuleMetadata;
  scan(files: ScanFile[]): Finding[];
}

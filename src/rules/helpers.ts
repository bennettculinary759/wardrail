import { createHash } from "node:crypto";
import type { Finding, RuleMetadata, ScanFile } from "../types/index.js";

const secretValuePattern =
  /((?:api[_-]?key|access[_-]?token|auth[_-]?token|password|passwd|secret)\s*[:=]\s*["']?)([^\s"',}]{4,})/gi;
const knownTokenPattern =
  /\b(?:AKIA[0-9A-Z]{16}|gh[pousr]_[A-Za-z0-9]{20,}|sk-(?:ant-|proj-)?[A-Za-z0-9_-]{20,}|AIza[0-9A-Za-z_-]{35}|(?:sk|rk)_live_[0-9A-Za-z]{16,}|xox[baprs]-[0-9A-Za-z-]{10,}|hf_[0-9A-Za-z]{20,}|npm_[0-9A-Za-z]{20,})\b/g;

export function redactEvidence(value: string): string {
  return value
    .trim()
    .slice(0, 240)
    .replace(secretValuePattern, "$1<redacted>")
    .replace(knownTokenPattern, "<redacted-token>");
}

export function createFinding(
  metadata: RuleMetadata,
  file: ScanFile,
  line: number,
  column: number,
  evidence: string,
  message = metadata.description,
): Finding {
  const safeEvidence = redactEvidence(evidence);
  const fingerprint = createHash("sha256")
    .update(`${metadata.id}\0${file.relativePath}\0${line}\0${safeEvidence}`)
    .digest("hex")
    .slice(0, 20);

  return {
    ruleId: metadata.id,
    title: metadata.title,
    severity: metadata.severity,
    message,
    file: file.relativePath,
    line,
    column,
    evidence: safeEvidence,
    remediation: metadata.remediation,
    references: metadata.references,
    fingerprint,
  };
}

export function isSuppressed(
  lines: string[],
  lineIndex: number,
  ruleId: string,
): boolean {
  const comments = [lines[lineIndex], lines[lineIndex - 1]].filter(
    (line): line is string => line !== undefined,
  );

  return comments.some((line) => {
    const match = line.match(/wardrail-ignore(?:-next-line)?\s+([A-Z0-9_,*\s-]+)/i);
    if (!match?.[1]) {
      return false;
    }
    const ids = match[1]
      .split(/[\s,]+/)
      .map((id) => id.toUpperCase())
      .filter(Boolean);
    return ids.includes("*") || ids.includes(ruleId.toUpperCase());
  });
}

export function scanLines(
  file: ScanFile,
  metadata: RuleMetadata,
  patterns: RegExp[],
  message?: string,
): Finding[] {
  const findings: Finding[] = [];
  const lines = file.content.split(/\r?\n/);

  lines.forEach((line, index) => {
    if (isSuppressed(lines, index, metadata.id)) {
      return;
    }
    for (const pattern of patterns) {
      const match = pattern.exec(line);
      if (match) {
        findings.push(
          createFinding(metadata, file, index + 1, match.index + 1, line, message),
        );
        break;
      }
    }
  });

  return findings;
}

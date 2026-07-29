import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { loadBaseline } from "../baseline.js";
import { loadConfig } from "../config.js";
import { builtinRules } from "../rules/builtin.js";
import { builtinProjectRules } from "../rules/project.js";
import {
  severityOrder,
  type Finding,
  type ScanFile,
  type ScanReport,
  type Severity,
} from "../types/index.js";
import { discoverFiles } from "./file-discovery.js";
import { scanGitHistory } from "./git-history.js";
import { WARDRAIL_VERSION } from "../version.js";

export interface ScanOptions {
  now?: Date;
  files?: string[];
  useBaseline?: boolean;
  history?: boolean;
  historyMaxCommits?: number;
}

function emptySeverityCounts(): Record<Severity, number> {
  return {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
    info: 0,
  };
}

export async function scanProject(
  target: string,
  options: ScanOptions = {},
): Promise<ScanReport> {
  const root = path.resolve(target);
  const rootStats = await stat(root);
  if (!rootStats.isDirectory()) {
    throw new Error(`Scan target must be a directory: ${root}`);
  }

  const config = await loadConfig(root);
  const ignoredRules = new Set(
    config.ignoreRules.map((ruleId) => ruleId.toUpperCase()),
  );
  const paths = await discoverFiles(root, config, options.files);
  const findings: Finding[] = [];
  const scanFiles: ScanFile[] = [];
  let filesScanned = 0;

  for (const absolutePath of paths) {
    const fileStats = await stat(absolutePath);
    if (fileStats.size > config.maxFileSize) {
      continue;
    }

    const file: ScanFile = {
      absolutePath,
      relativePath: path.relative(root, absolutePath).replaceAll(path.sep, "/"),
      content: await readFile(absolutePath, "utf8"),
    };
    scanFiles.push(file);
    filesScanned += 1;

    for (const rule of builtinRules) {
      if (!ignoredRules.has(rule.metadata.id.toUpperCase())) {
        findings.push(...rule.scan(file));
      }
    }
  }

  const projectRuleFiles = [...scanFiles];
  if (
    options.files &&
    !projectRuleFiles.some((file) => file.relativePath === ".gitignore")
  ) {
    const gitignorePath = path.join(root, ".gitignore");
    try {
      projectRuleFiles.push({
        absolutePath: gitignorePath,
        relativePath: ".gitignore",
        content: await readFile(gitignorePath, "utf8"),
      });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        throw error;
      }
    }
  }

  for (const rule of builtinProjectRules) {
    if (!ignoredRules.has(rule.metadata.id.toUpperCase())) {
      findings.push(...rule.scan(projectRuleFiles));
    }
  }

  const history = options.history
    ? await scanGitHistory(root, config, ignoredRules, {
        maxCommits: options.historyMaxCommits ?? 100,
      })
    : {
        findings: [],
        filesScanned: 0,
        commitsScanned: 0,
        truncated: false,
        shallowRepository: false,
      };
  findings.push(...history.findings);

  const baseline =
    options.useBaseline === false
      ? new Set<string>()
      : await loadBaseline(root, config.baseline);
  const baselineSuppressed = findings.filter((finding) =>
    baseline.has(finding.fingerprint),
  ).length;
  const activeFindings = findings.filter(
    (finding) => !baseline.has(finding.fingerprint),
  );

  activeFindings.sort((left, right) => {
    const severityDifference =
      severityOrder[right.severity] - severityOrder[left.severity];
    return (
      severityDifference ||
      left.file.localeCompare(right.file) ||
      left.line - right.line ||
      left.ruleId.localeCompare(right.ruleId)
    );
  });

  const bySeverity = emptySeverityCounts();
  for (const finding of activeFindings) {
    bySeverity[finding.severity] += 1;
  }

  return {
    version: WARDRAIL_VERSION,
    root,
    scannedAt: (options.now ?? new Date()).toISOString(),
    summary: {
      filesScanned: filesScanned + history.filesScanned,
      historyFilesScanned: history.filesScanned,
      commitsScanned: history.commitsScanned,
      historyTruncated: history.truncated,
      shallowRepository: history.shallowRepository,
      findings: activeFindings.length,
      baselineSuppressed,
      bySeverity,
    },
    findings: activeFindings,
  };
}

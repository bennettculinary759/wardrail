import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";
import { historyRules } from "../rules/history.js";
import type {
  Finding,
  ScanFile,
  WardrailConfig,
} from "../types/index.js";

const execFileAsync = promisify(execFile);
const DEFAULT_MAX_HISTORY_FILES = 5_000;
const commandBufferLimit = 16 * 1024 * 1024;

export interface GitHistoryOptions {
  maxCommits: number;
  maxFiles?: number;
}

export interface GitHistoryScanResult {
  findings: Finding[];
  filesScanned: number;
  commitsScanned: number;
  truncated: boolean;
  shallowRepository: boolean;
}

async function runGit(
  root: string,
  args: string[],
  maxBuffer = commandBufferLimit,
): Promise<string> {
  try {
    const result = await execFileAsync("git", args, {
      cwd: root,
      encoding: "utf8",
      maxBuffer,
      windowsHide: true,
    });
    return String(result.stdout);
  } catch (error) {
    const failure = error as NodeJS.ErrnoException & { stderr?: string };
    const detail = failure.stderr?.trim() || failure.message;
    throw new Error(`Git history scan failed: ${detail}`);
  }
}

function globToRegExp(pattern: string): RegExp {
  const normalized = pattern
    .replaceAll("\\", "/")
    .replace(/^\/+/, "")
    .replace(/\/+$/, "/**");
  let source = "";

  for (let index = 0; index < normalized.length; index += 1) {
    const character = normalized[index];
    const next = normalized[index + 1];
    const afterNext = normalized[index + 2];

    if (character === "*" && next === "*" && afterNext === "/") {
      source += "(?:.*/)?";
      index += 2;
    } else if (character === "*" && next === "*") {
      source += ".*";
      index += 1;
    } else if (character === "*") {
      source += "[^/]*";
    } else if (character === "?") {
      source += "[^/]";
    } else {
      source += character?.replace(/[|\\{}()[\]^$+?.]/g, "\\$&") ?? "";
    }
  }

  return new RegExp(`^${source}$`, "i");
}

function shouldIgnore(
  relativePath: string,
  configuredIgnore: RegExp[],
): boolean {
  const normalized = relativePath.replaceAll("\\", "/");
  if (
    /(?:^|\/)(?:node_modules|vendor|\.venv|venv|target)(?:\/|$)/i.test(
      normalized,
    )
  ) {
    return true;
  }
  return configuredIgnore.some((pattern) => pattern.test(normalized));
}

function isProbablyBinary(content: string): boolean {
  return content.slice(0, 8_192).includes("\0");
}

function samePath(left: string, right: string): boolean {
  return process.platform === "win32"
    ? left.toLowerCase() === right.toLowerCase()
    : left === right;
}

function deduplicateFindings(findings: Finding[]): Finding[] {
  const seen = new Set<string>();
  return findings.filter((finding) => {
    const key = [
      finding.ruleId,
      finding.file,
      finding.line,
      finding.evidence,
    ].join("\0");
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

export async function scanGitHistory(
  root: string,
  config: WardrailConfig,
  ignoredRules: Set<string>,
  options: GitHistoryOptions,
): Promise<GitHistoryScanResult> {
  if (!Number.isSafeInteger(options.maxCommits) || options.maxCommits < 1) {
    throw new Error("Git history commit limit must be a positive integer.");
  }
  const maxFiles = options.maxFiles ?? DEFAULT_MAX_HISTORY_FILES;
  if (!Number.isSafeInteger(maxFiles) || maxFiles < 1) {
    throw new Error("Git history file limit must be a positive integer.");
  }

  const repositoryRoot = path.resolve(
    (await runGit(root, ["rev-parse", "--show-toplevel"])).trim(),
  );
  if (!samePath(repositoryRoot, path.resolve(root))) {
    throw new Error(
      `Git history scanning must start at the repository root: ${repositoryRoot}`,
    );
  }

  const shallowRepository =
    (await runGit(root, ["rev-parse", "--is-shallow-repository"])).trim() ===
    "true";
  let commitOutput: string;
  try {
    commitOutput = await runGit(root, [
      "rev-list",
      `--max-count=${options.maxCommits + 1}`,
      "HEAD",
    ]);
  } catch (error) {
    if (
      error instanceof Error &&
      /(?:ambiguous argument|unknown revision|bad revision).{0,20}HEAD/i.test(
        error.message,
      )
    ) {
      return {
        findings: [],
        filesScanned: 0,
        commitsScanned: 0,
        truncated: false,
        shallowRepository,
      };
    }
    throw error;
  }
  const availableCommits = commitOutput.split(/\r?\n/).filter(Boolean);
  const commitLimitReached = availableCommits.length > options.maxCommits;
  const commits = availableCommits.slice(0, options.maxCommits);
  const configuredIgnore = config.ignore.map(globToRegExp);
  const findings: Finding[] = [];
  let filesScanned = 0;
  let fileLimitReached = false;

  for (const commit of commits) {
    const changedOutput = await runGit(root, [
      "diff-tree",
      "--root",
      "--no-commit-id",
      "--name-only",
      "-r",
      "-z",
      "--diff-filter=AM",
      commit,
    ]);
    const changedPaths = changedOutput.split("\0").filter(Boolean);

    for (const relativePath of changedPaths) {
      if (filesScanned >= maxFiles) {
        fileLimitReached = true;
        break;
      }
      if (shouldIgnore(relativePath, configuredIgnore)) {
        continue;
      }

      const objectName = `${commit}:${relativePath}`;
      let size: number;
      let content: string;
      try {
        size = Number.parseInt(
          (await runGit(root, ["cat-file", "-s", objectName])).trim(),
          10,
        );
        if (!Number.isFinite(size) || size > config.maxFileSize) {
          continue;
        }
        content = await runGit(
          root,
          ["cat-file", "blob", objectName],
          config.maxFileSize + 1_024,
        );
      } catch {
        // Submodules and non-blob tree entries are not scan targets.
        continue;
      }
      if (isProbablyBinary(content)) {
        continue;
      }

      const file: ScanFile = {
        absolutePath: path.join(root, relativePath),
        relativePath: relativePath.replaceAll("\\", "/"),
        content,
        commit,
      };
      filesScanned += 1;

      for (const rule of historyRules) {
        if (!ignoredRules.has(rule.metadata.id.toUpperCase())) {
          findings.push(...rule.scan(file));
        }
      }
    }
    if (fileLimitReached) {
      break;
    }
  }

  return {
    findings: deduplicateFindings(findings),
    filesScanned,
    commitsScanned: commits.length,
    truncated: commitLimitReached || fileLimitReached,
    shallowRepository,
  };
}

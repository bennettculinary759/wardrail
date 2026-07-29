import { execFile } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { afterEach, describe, expect, it } from "vitest";
import { formatSarifReport } from "../src/reporters/sarif.js";
import { formatTerminalReport } from "../src/reporters/terminal.js";
import { scanProject } from "../src/scanners/project-scanner.js";

const execFileAsync = promisify(execFile);
const temporaryDirectories: string[] = [];

async function git(directory: string, ...args: string[]): Promise<string> {
  const result = await execFileAsync("git", args, {
    cwd: directory,
    encoding: "utf8",
  });
  return String(result.stdout).trim();
}

async function createRepository(): Promise<string> {
  const directory = await mkdtemp(path.join(os.tmpdir(), "wardrail-history-"));
  temporaryDirectories.push(directory);
  await git(directory, "init", "--quiet");
  await git(directory, "config", "user.name", "Wardrail Test");
  await git(directory, "config", "user.email", "wardrail@example.invalid");
  return directory;
}

async function commitAll(directory: string, message: string): Promise<string> {
  await git(directory, "add", "--all");
  await git(directory, "commit", "--quiet", "-m", message);
  return git(directory, "rev-parse", "HEAD");
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) =>
      rm(directory, { recursive: true, force: true }),
    ),
  );
});

describe("Git history scanning", () => {
  it("finds and redacts a credential that was deleted from the working tree", async () => {
    const directory = await createRepository();
    await writeFile(path.join(directory, "index.ts"), "export const safe = true;\n");
    await commitAll(directory, "safe start");

    const secret = "sk-proj-abcdefghijklmnopqrstuvwxyz123456";
    await writeFile(
      path.join(directory, "leaked.env"),
      [
        `OPENAI_API_KEY=${secret}`,
        "client_secret=historical-secret-value-123",
        "",
      ].join("\n"),
    );
    const leakCommit = await commitAll(directory, "accidentally add key");

    await rm(path.join(directory, "leaked.env"));
    await commitAll(directory, "remove key");

    const report = await scanProject(directory, {
      history: true,
      historyMaxCommits: 100,
      now: new Date("2026-01-01T00:00:00.000Z"),
    });

    expect(new Set(report.findings.map((finding) => finding.ruleId))).toEqual(
      new Set(["WR-016", "WR-017"]),
    );
    expect(report.findings.every((finding) => finding.commit === leakCommit)).toBe(
      true,
    );
    expect(JSON.stringify(report)).not.toContain(secret);
    expect(report.summary.commitsScanned).toBe(3);
    expect(report.summary.historyFilesScanned).toBe(2);
    expect(report.summary.historyTruncated).toBe(false);

    const terminal = formatTerminalReport(report, false);
    expect(terminal).toContain(leakCommit.slice(0, 12));
    expect(terminal).toContain("3 Git commits");

    const sarif = JSON.parse(formatSarifReport(report)) as {
      runs: Array<{ results: Array<{ properties?: { gitCommit?: string } }> }>;
    };
    expect(sarif.runs[0]?.results[0]?.properties?.gitCommit).toBe(leakCommit);
    expect(formatSarifReport(report)).not.toContain(secret);
  });

  it("marks a bounded scan as truncated", async () => {
    const directory = await createRepository();
    await writeFile(path.join(directory, "one.ts"), "export const one = 1;\n");
    await commitAll(directory, "one");
    await writeFile(path.join(directory, "two.ts"), "export const two = 2;\n");
    await commitAll(directory, "two");

    const report = await scanProject(directory, {
      history: true,
      historyMaxCommits: 1,
    });

    expect(report.summary.commitsScanned).toBe(1);
    expect(report.summary.historyTruncated).toBe(true);
    expect(formatTerminalReport(report, false)).toContain(
      "Increase --history-limit",
    );
  });

  it("respects configured history ignores", async () => {
    const directory = await createRepository();
    await writeFile(
      path.join(directory, ".wardrail.json"),
      `${JSON.stringify({ ignore: ["leaked.env"] }, null, 2)}\n`,
    );
    await writeFile(
      path.join(directory, "leaked.env"),
      "API_KEY=historical-secret-value-123\n",
    );
    await commitAll(directory, "ignored fixture");
    await rm(path.join(directory, "leaked.env"));
    await commitAll(directory, "remove fixture");

    const report = await scanProject(directory, { history: true });
    expect(report.findings).toEqual([]);
  });

  it("fails clearly outside a Git repository", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "wardrail-no-git-"));
    temporaryDirectories.push(directory);
    await writeFile(path.join(directory, "index.ts"), "export const safe = true;\n");

    await expect(
      scanProject(directory, { history: true }),
    ).rejects.toThrow("Git history scan failed");
  });

  it("treats a repository without commits as empty history", async () => {
    const directory = await createRepository();
    await writeFile(path.join(directory, "index.ts"), "export const safe = true;\n");

    const report = await scanProject(directory, { history: true });
    expect(report.findings).toEqual([]);
    expect(report.summary.commitsScanned).toBe(0);
    expect(report.summary.historyFilesScanned).toBe(0);
  });
});

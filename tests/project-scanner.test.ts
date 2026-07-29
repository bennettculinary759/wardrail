import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { formatSarifReport } from "../src/reporters/sarif.js";
import { scanProject } from "../src/scanners/project-scanner.js";

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(testDirectory, "..");

describe("project scanner", () => {
  it("scans the dangerous example and returns stable report metadata", async () => {
    const report = await scanProject(
      path.join(projectRoot, "examples", "dangerous-agent"),
      { now: new Date("2026-01-01T00:00:00.000Z") },
    );

    expect(report.scannedAt).toBe("2026-01-01T00:00:00.000Z");
    expect(report.summary.filesScanned).toBe(3);
    expect(new Set(report.findings.map((finding) => finding.ruleId))).toEqual(
      new Set(["WR-001", "WR-002", "WR-003", "WR-004", "WR-005"]),
    );
  });

  it("produces valid SARIF 2.1.0", async () => {
    const report = await scanProject(
      path.join(projectRoot, "examples", "dangerous-agent"),
    );
    const sarif = JSON.parse(formatSarifReport(report)) as {
      version: string;
      runs: Array<{ results: unknown[] }>;
    };

    expect(sarif.version).toBe("2.1.0");
    expect(sarif.runs[0]?.results).toHaveLength(report.findings.length);
  });

  it("returns no findings for the safe example", async () => {
    const report = await scanProject(
      path.join(projectRoot, "examples", "safe-agent"),
    );
    expect(report.findings).toEqual([]);
  });

  it("finds API exposure risks across an ordinary application", async () => {
    const report = await scanProject(
      path.join(projectRoot, "examples", "vibecoding-api-leak"),
    );
    const ruleIds = new Set(report.findings.map((finding) => finding.ruleId));

    expect(report.summary.filesScanned).toBe(4);
    expect(ruleIds).toEqual(
      new Set(["WR-006", "WR-007", "WR-008", "WR-009", "WR-010", "WR-011", "WR-012"]),
    );
  });

  it("uses the root gitignore as context during a staged-style scan", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "wardrail-context-"));
    try {
      await writeFile(path.join(directory, ".env"), "API_KEY=local-secret-value\n");
      await writeFile(path.join(directory, ".gitignore"), ".env\n");

      const report = await scanProject(directory, { files: [".env"] });
      expect(report.findings.map((finding) => finding.ruleId)).not.toContain(
        "WR-006",
      );
      expect(report.summary.filesScanned).toBe(1);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});

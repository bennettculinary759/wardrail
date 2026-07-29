#!/usr/bin/env node

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { Command } from "commander";
import {
  createBaseline as createBaselineData,
  writeBaseline,
} from "../baseline.js";
import {
  installPreCommitHook,
  uninstallPreCommitHook,
} from "../integrations/git-hook.js";
import { builtinRules, findRule } from "../rules/builtin.js";
import { builtinProjectRules } from "../rules/project.js";
import { formatJsonReport } from "../reporters/json.js";
import { formatSarifReport } from "../reporters/sarif.js";
import { formatTerminalReport } from "../reporters/terminal.js";
import { scanProject } from "../scanners/project-scanner.js";
import { getStagedFiles } from "../scanners/staged-files.js";
import { severityOrder, type Severity } from "../types/index.js";

const program = new Command();
const validSeverities = Object.keys(severityOrder) as Severity[];

program
  .name("wardrail")
  .description("Scan source code and agent configuration before your AI agent runs it.")
  .version("0.2.0");

program
  .command("scan")
  .description("Scan a project for secrets and unsafe agent behavior")
  .argument("[path]", "directory to scan", ".")
  .option("-f, --format <format>", "terminal, json, or sarif", "terminal")
  .option("-o, --output <file>", "write the report to a file")
  .option("--fail-on <severity>", "minimum severity that produces exit code 1", "low")
  .option("--staged", "scan only files staged in Git")
  .option("--no-color", "disable colored terminal output")
  .action(async (target: string, options: {
    format: string;
    failOn: string;
    color: boolean;
    staged?: boolean;
    output?: string;
  }) => {
    if (!["terminal", "json", "sarif"].includes(options.format)) {
      throw new Error(`Unsupported format: ${options.format}`);
    }
    if (!validSeverities.includes(options.failOn as Severity)) {
      throw new Error(`Unsupported severity: ${options.failOn}`);
    }

    const selectedFiles = options.staged
      ? await getStagedFiles(target)
      : undefined;
    const report = await scanProject(
      target,
      selectedFiles ? { files: selectedFiles } : {},
    );
    let rendered: string;
    if (options.format === "json") {
      rendered = formatJsonReport(report);
    } else if (options.format === "sarif") {
      rendered = formatSarifReport(report);
    } else {
      rendered = formatTerminalReport(report, options.output ? false : options.color);
    }
    if (options.output) {
      const destination = path.resolve(options.output);
      await mkdir(path.dirname(destination), { recursive: true });
      await writeFile(destination, `${rendered}\n`, "utf8");
      if (options.format === "terminal") {
        console.log(`Report written to ${destination}`);
      }
    } else {
      console.log(rendered);
    }

    const threshold = severityOrder[options.failOn as Severity];
    if (report.findings.some((finding) => severityOrder[finding.severity] >= threshold)) {
      process.exitCode = 1;
    }
  });

program
  .command("explain")
  .description("Explain a security rule")
  .argument("<rule-id>", "rule identifier, for example WR-004")
  .action((ruleId: string) => {
    const rule = findRule(ruleId);
    if (!rule) {
      throw new Error(`Unknown rule: ${ruleId}`);
    }
    const { metadata } = rule;
    console.log([
      `${metadata.id}: ${metadata.title}`,
      `Severity: ${metadata.severity}`,
      "",
      metadata.description,
      "",
      `Remediation: ${metadata.remediation}`,
      "",
      ...metadata.references.map((reference) => `Reference: ${reference}`),
      "",
      `Suppress a reviewed finding with: wardrail-ignore ${metadata.id}`,
    ].join("\n"));
  });

const rules = program.command("rules").description("Inspect security rules");
rules
  .command("list")
  .description("List built-in rules")
  .action(() => {
    const rules = [...builtinRules, ...builtinProjectRules].sort((left, right) =>
      left.metadata.id.localeCompare(right.metadata.id),
    );
    for (const { metadata } of rules) {
      console.log(
        `${metadata.id.padEnd(7)} ${metadata.severity.toUpperCase().padEnd(9)} ${metadata.title}`,
      );
    }
  });

const baseline = program
  .command("baseline")
  .description("Manage accepted-finding baselines");
baseline
  .command("create")
  .description("Record current findings so future scans report only new risks")
  .argument("[path]", "project directory", ".")
  .option(
    "-o, --output <file>",
    "baseline path relative to the project",
    ".wardrail-baseline.json",
  )
  .option("--force", "replace an existing baseline")
  .action(async (
    target: string,
    options: { output: string; force?: boolean },
  ) => {
    const root = path.resolve(target);
    const report = await scanProject(root, { useBaseline: false });
    const destination = await writeBaseline(
      root,
      options.output,
      createBaselineData(report),
      options.force ?? false,
    );
    console.log(
      `Created ${destination} with ${report.findings.length} finding(s)`,
    );
  });

const hook = program.command("hook").description("Manage Git integration");
hook
  .command("install")
  .description("Install an idempotent pre-commit staged-file scan")
  .argument("[path]", "Git project directory", ".")
  .action(async (target: string) => {
    const result = await installPreCommitHook(target);
    console.log(
      result.changed
        ? `Installed Wardrail pre-commit hook at ${result.path}`
        : `Wardrail pre-commit hook is already installed at ${result.path}`,
    );
  });
hook
  .command("uninstall")
  .description("Remove only the Wardrail block from the pre-commit hook")
  .argument("[path]", "Git project directory", ".")
  .action(async (target: string) => {
    const result = await uninstallPreCommitHook(target);
    console.log(
      result.changed
        ? `Removed Wardrail from ${result.path}`
        : `No Wardrail pre-commit hook found at ${result.path}`,
    );
  });

program
  .command("init")
  .description("Create a Wardrail configuration file")
  .argument("[path]", "project directory", ".")
  .action(async (target: string) => {
    const destination = path.resolve(target, ".wardrail.json");
    const config = {
      ignore: ["**/vendor/**"],
      ignoreRules: [],
      maxFileSize: 1048576,
      baseline: ".wardrail-baseline.json",
    };
    await writeFile(destination, `${JSON.stringify(config, null, 2)}\n`, {
      encoding: "utf8",
      flag: "wx",
    });
    console.log(`Created ${destination}`);
  });

program.parseAsync().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Wardrail error: ${message}`);
  process.exitCode = 2;
});

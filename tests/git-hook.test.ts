import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { afterEach, describe, expect, it } from "vitest";
import {
  installPreCommitHook,
  uninstallPreCommitHook,
} from "../src/integrations/git-hook.js";

const execFileAsync = promisify(execFile);
const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) =>
      rm(directory, { recursive: true, force: true }),
    ),
  );
});

async function createRepository(): Promise<string> {
  const directory = await mkdtemp(path.join(os.tmpdir(), "wardrail-hook-"));
  temporaryDirectories.push(directory);
  await execFileAsync("git", ["init", "--quiet"], { cwd: directory });
  return directory;
}

describe("Git pre-commit integration", () => {
  it("installs idempotently and removes only the Wardrail block", async () => {
    const directory = await createRepository();
    const hookPath = path.join(directory, ".git", "hooks", "pre-commit");
    await writeFile(hookPath, "#!/bin/sh\n\necho custom-check\n");

    const first = await installPreCommitHook(directory);
    const second = await installPreCommitHook(directory);
    expect(first.changed).toBe(true);
    expect(second.changed).toBe(false);

    const installed = await readFile(hookPath, "utf8");
    expect(installed.match(/>>> wardrail >>>/g)).toHaveLength(1);
    expect(installed).toContain("echo custom-check");
    expect(installed).toContain("wardrail scan --staged");

    const removed = await uninstallPreCommitHook(directory);
    expect(removed.changed).toBe(true);
    const finalSource = await readFile(hookPath, "utf8");
    expect(finalSource).toContain("echo custom-check");
    expect(finalSource).not.toContain("wardrail");
  });

  it("refuses to modify a non-shell hook", async () => {
    const directory = await createRepository();
    const hookPath = path.join(directory, ".git", "hooks", "pre-commit");
    await writeFile(hookPath, "#!/usr/bin/env python\nprint('check')\n");

    await expect(installPreCommitHook(directory)).rejects.toThrow(
      "not a shell script",
    );
  });
});

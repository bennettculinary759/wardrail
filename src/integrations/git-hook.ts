import { execFile } from "node:child_process";
import { chmod, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const startMarker = "# >>> wardrail >>>";
const endMarker = "# <<< wardrail <<<";
const hookBlock = [
  startMarker,
  'npx --no-install wardrail scan --staged',
  endMarker,
].join("\n");

async function resolveHookPath(root: string): Promise<string> {
  const resolvedRoot = path.resolve(root);
  let stdout: string;
  try {
    const result = await execFileAsync(
      "git",
      ["-C", resolvedRoot, "rev-parse", "--git-path", "hooks/pre-commit"],
      {
        encoding: "utf8",
        windowsHide: true,
      },
    );
    stdout = result.stdout.trim();
  } catch {
    throw new Error(`Unable to locate Git hooks. Is ${resolvedRoot} a Git repository?`);
  }
  return path.isAbsolute(stdout) ? stdout : path.resolve(resolvedRoot, stdout);
}

async function readExistingHook(hookPath: string): Promise<string | undefined> {
  try {
    return await readFile(hookPath, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return undefined;
    }
    throw error;
  }
}

export interface HookChange {
  path: string;
  changed: boolean;
}

export async function installPreCommitHook(root: string): Promise<HookChange> {
  const hookPath = await resolveHookPath(root);
  const existing = await readExistingHook(hookPath);
  if (existing?.includes(startMarker)) {
    return { path: hookPath, changed: false };
  }
  if (
    existing &&
    existing.trim().length > 0 &&
    !existing.startsWith("#!/bin/sh") &&
    !existing.startsWith("#!/usr/bin/env sh") &&
    !existing.startsWith("#!/usr/bin/env bash")
  ) {
    throw new Error(
      "Existing pre-commit hook is not a shell script; add `npx --no-install wardrail scan --staged` manually.",
    );
  }

  const source = existing
    ? `${existing.trimEnd()}\n\n${hookBlock}\n`
    : `#!/bin/sh\n\n${hookBlock}\n`;
  await mkdir(path.dirname(hookPath), { recursive: true });
  await writeFile(hookPath, source, "utf8");
  await chmod(hookPath, 0o755);
  return { path: hookPath, changed: true };
}

export async function uninstallPreCommitHook(root: string): Promise<HookChange> {
  const hookPath = await resolveHookPath(root);
  const existing = await readExistingHook(hookPath);
  if (!existing?.includes(startMarker)) {
    return { path: hookPath, changed: false };
  }

  const escapedStart = startMarker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const escapedEnd = endMarker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const withoutBlock = existing
    .replace(new RegExp(`\\n?${escapedStart}[\\s\\S]*?${escapedEnd}\\n?`), "\n")
    .replace(/\n{3,}/g, "\n\n");
  await writeFile(hookPath, withoutBlock, "utf8");
  await chmod(hookPath, 0o755);
  return { path: hookPath, changed: true };
}

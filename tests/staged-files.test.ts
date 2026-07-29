import { execFile } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { afterEach, describe, expect, it } from "vitest";
import { getStagedFiles } from "../src/scanners/staged-files.js";

const execFileAsync = promisify(execFile);
const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) =>
      rm(directory, { recursive: true, force: true }),
    ),
  );
});

describe("staged file discovery", () => {
  it("returns only files added to the Git index", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "wardrail-staged-"));
    temporaryDirectories.push(directory);
    await execFileAsync("git", ["init", "--quiet"], { cwd: directory });
    await writeFile(path.join(directory, "staged.ts"), "const value = 1;\n");
    await writeFile(path.join(directory, "unstaged.ts"), "const value = 2;\n");
    await execFileAsync("git", ["add", "staged.ts"], { cwd: directory });

    await expect(getStagedFiles(directory)).resolves.toEqual(["staged.ts"]);
  });
});

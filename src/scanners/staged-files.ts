import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export async function getStagedFiles(root: string): Promise<string[]> {
  const resolvedRoot = path.resolve(root);
  let stdout: string;

  try {
    const result = await execFileAsync(
      "git",
      [
        "-C",
        resolvedRoot,
        "diff",
        "--cached",
        "--name-only",
        "--diff-filter=ACMR",
        "-z",
      ],
      {
        encoding: "utf8",
        windowsHide: true,
        maxBuffer: 4 * 1024 * 1024,
      },
    );
    stdout = result.stdout;
  } catch {
    throw new Error(`Unable to read staged files. Is ${resolvedRoot} a Git repository?`);
  }

  return stdout
    .split("\0")
    .filter(Boolean)
    .map((file) => file.replaceAll("\\", "/"))
    .filter((file) => {
      const absolutePath = path.resolve(resolvedRoot, file);
      const relativePath = path.relative(resolvedRoot, absolutePath);
      return relativePath !== ".." && !relativePath.startsWith(`..${path.sep}`);
    });
}

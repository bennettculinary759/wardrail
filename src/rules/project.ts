import path from "node:path";
import type { ProjectRule } from "../types/index.js";
import { createFinding } from "./helpers.js";

function isExampleEnv(relativePath: string): boolean {
  return /\.(?:example|sample|template|defaults)$/i.test(relativePath);
}

function containsSensitiveAssignment(content: string): boolean {
  return /^(?:export\s+)?[A-Z0-9_]*(?:KEY|TOKEN|SECRET|PASSWORD|CREDENTIAL)[A-Z0-9_]*\s*=\s*[^#\s][^\r\n]*$/im.test(
    content,
  );
}

function hasCommonEnvIgnore(gitignore: string, relativePath: string): boolean {
  const normalizedPath = relativePath.replaceAll("\\", "/");
  const basename = path.posix.basename(normalizedPath);
  const directory = path.posix.dirname(normalizedPath);
  const commonPatterns = new Set([
    ".env",
    ".env*",
    ".env.*",
    "*.env",
    "*.env.*",
    "**/.env",
    "**/.env*",
    normalizedPath,
    `${directory}/.env`,
    `${directory}/.env*`,
  ]);

  return gitignore
    .split(/\r?\n/)
    .map((line) => line.trim().replace(/^\/+/, "").replace(/\/+$/, ""))
    .filter((line) => line.length > 0 && !line.startsWith("#") && !line.startsWith("!"))
    .some((line) => commonPatterns.has(line) || line === basename);
}

export const builtinProjectRules: ProjectRule[] = [
  {
    metadata: {
      id: "WR-006",
      title: "Sensitive environment file is not ignored",
      severity: "high",
      description:
        "A non-example .env file contains secret-named values but is not covered by the root .gitignore.",
      remediation:
        "Add the environment file pattern to .gitignore, remove it from version control, and rotate any exposed values.",
      references: ["https://git-scm.com/docs/gitignore"],
    },
    scan(files) {
      const rootGitignore =
        files.find((file) => file.relativePath === ".gitignore")?.content ?? "";
      return files
        .filter((file) => {
          const basename = path.posix.basename(file.relativePath);
          return (
            /^\.env(?:\.|$)/i.test(basename) &&
            !isExampleEnv(file.relativePath) &&
            containsSensitiveAssignment(file.content) &&
            !hasCommonEnvIgnore(rootGitignore, file.relativePath)
          );
        })
        .map((file) =>
          createFinding(
            this.metadata,
            file,
            1,
            1,
            `${file.relativePath} is not covered by .gitignore`,
          ),
        );
    },
  },
];

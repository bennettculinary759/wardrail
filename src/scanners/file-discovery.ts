import path from "node:path";
import fg from "fast-glob";
import type { WardrailConfig } from "../types/index.js";

const candidatePatterns = [
  "**/AGENTS.md",
  "**/SKILL.md",
  "**/.env",
  "**/.env.*",
  "**/.gitignore",
  "**/.mcp.json",
  "**/mcp.json",
  "**/mcp.jsonc",
  "**/mcp.config.json",
  "**/claude_desktop_config.json",
  "**/Dockerfile",
  "**/Dockerfile.*",
  "**/docker-compose.{yml,yaml}",
  "**/*.{js,jsx,ts,tsx,mjs,cjs,py,rb,go,java,kt,kts,rs,php,cs,swift,scala,sh,bash,zsh,fish,ps1,psm1,json,jsonc,yaml,yml,toml,ini,cfg,conf,properties,xml,md,txt,env}",
  "**/{install,setup,preinstall,postinstall}.{sh,ps1,js,mjs,cjs,ts}",
];

const defaultIgnore = [
  "**/.git/**",
  "**/node_modules/**",
  "**/dist/**",
  "**/build/**",
  "**/coverage/**",
  "**/.next/**",
  "**/.nuxt/**",
  "**/target/**",
  "**/vendor/**",
  "**/.venv/**",
  "**/venv/**",
];

export async function discoverFiles(
  root: string,
  config: WardrailConfig,
  selectedFiles?: string[],
): Promise<string[]> {
  const files = await fg(candidatePatterns, {
    cwd: root,
    absolute: true,
    onlyFiles: true,
    dot: true,
    unique: true,
    followSymbolicLinks: false,
    ignore: [
      ...defaultIgnore,
      ...config.ignore.map((pattern) => pattern.replaceAll("\\", "/")),
    ],
  });

  const selected = selectedFiles
    ? new Set(selectedFiles.map((file) => file.replaceAll("\\", "/")))
    : undefined;
  const filtered = selected
    ? files.filter((file) =>
        selected.has(path.relative(root, file).replaceAll(path.sep, "/")),
      )
    : files;

  return filtered.sort((left, right) =>
    path.relative(root, left).localeCompare(path.relative(root, right)),
  );
}

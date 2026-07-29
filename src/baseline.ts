import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import type {
  BaselineFile,
  Finding,
  ScanReport,
} from "./types/index.js";

const baselineSchema = z.object({
  version: z.literal(1),
  createdAt: z.string(),
  entries: z.array(
    z.object({
      fingerprint: z.string().min(1),
      ruleId: z.string().min(1),
      file: z.string().min(1),
    }),
  ),
});

function resolveInsideRoot(root: string, relativePath: string): string {
  const resolvedRoot = path.resolve(root);
  const resolvedPath = path.resolve(resolvedRoot, relativePath);
  const relation = path.relative(resolvedRoot, resolvedPath);
  if (relation === ".." || relation.startsWith(`..${path.sep}`) || path.isAbsolute(relation)) {
    throw new Error(`Baseline path must stay inside the scan root: ${relativePath}`);
  }
  return resolvedPath;
}

export async function loadBaseline(
  root: string,
  relativePath: string,
): Promise<Set<string>> {
  const baselinePath = resolveInsideRoot(root, relativePath);
  let source: string;
  try {
    source = await readFile(baselinePath, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return new Set();
    }
    throw error;
  }

  let value: unknown;
  try {
    value = JSON.parse(source);
  } catch {
    throw new Error(`Invalid baseline JSON: ${relativePath}`);
  }
  const result = baselineSchema.safeParse(value);
  if (!result.success) {
    throw new Error(`Invalid baseline file ${relativePath}: ${result.error.message}`);
  }
  return new Set(result.data.entries.map((entry) => entry.fingerprint));
}

export function createBaseline(report: ScanReport): BaselineFile {
  return {
    version: 1,
    createdAt: new Date().toISOString(),
    entries: report.findings.map((finding: Finding) => ({
      fingerprint: finding.fingerprint,
      ruleId: finding.ruleId,
      file: finding.file,
    })),
  };
}

export async function writeBaseline(
  root: string,
  relativePath: string,
  baseline: BaselineFile,
  overwrite = false,
): Promise<string> {
  const destination = resolveInsideRoot(root, relativePath);
  await mkdir(path.dirname(destination), { recursive: true });
  await writeFile(destination, `${JSON.stringify(baseline, null, 2)}\n`, {
    encoding: "utf8",
    flag: overwrite ? "w" : "wx",
  });
  return destination;
}

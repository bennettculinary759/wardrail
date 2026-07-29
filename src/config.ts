import { readFile } from "node:fs/promises";
import path from "node:path";
import { parse, printParseErrorCode, type ParseError } from "jsonc-parser";
import { z } from "zod";
import type { WardrailConfig } from "./types/index.js";

const configSchema = z
  .object({
    ignore: z.array(z.string()).default([]),
    ignoreRules: z.array(z.string()).default([]),
    maxFileSize: z
      .number()
      .int()
      .positive()
      .max(10 * 1024 * 1024)
      .default(1024 * 1024),
    baseline: z.string().min(1).default(".wardrail-baseline.json"),
  })
  .strict();

export const defaultConfig: WardrailConfig = {
  ignore: [],
  ignoreRules: [],
  maxFileSize: 1024 * 1024,
  baseline: ".wardrail-baseline.json",
};

export async function loadConfig(root: string): Promise<WardrailConfig> {
  const configPath = path.join(root, ".wardrail.json");

  let source: string;
  try {
    source = await readFile(configPath, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return defaultConfig;
    }
    throw error;
  }

  const errors: ParseError[] = [];
  const value: unknown = parse(source, errors, { allowTrailingComma: true });
  if (errors.length > 0) {
    const details = errors
      .map((error) => `${printParseErrorCode(error.error)} at offset ${error.offset}`)
      .join(", ");
    throw new Error(`Invalid .wardrail.json: ${details}`);
  }

  const result = configSchema.safeParse(value);
  if (!result.success) {
    throw new Error(`Invalid .wardrail.json: ${result.error.message}`);
  }
  return result.data;
}

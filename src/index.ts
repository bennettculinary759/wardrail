export { scanProject, type ScanOptions } from "./scanners/project-scanner.js";
export { createBaseline, loadBaseline, writeBaseline } from "./baseline.js";
export { discoverFiles } from "./scanners/file-discovery.js";
export { getStagedFiles } from "./scanners/staged-files.js";
export {
  scanGitHistory,
  type GitHistoryOptions,
  type GitHistoryScanResult,
} from "./scanners/git-history.js";
export {
  installPreCommitHook,
  uninstallPreCommitHook,
  type HookChange,
} from "./integrations/git-hook.js";
export { builtinRules, findRule } from "./rules/builtin.js";
export { builtinProjectRules } from "./rules/project.js";
export { historyRules } from "./rules/history.js";
export { formatTerminalReport } from "./reporters/terminal.js";
export { formatJsonReport } from "./reporters/json.js";
export { formatSarifReport } from "./reporters/sarif.js";
export type {
  WardrailConfig,
  BaselineEntry,
  BaselineFile,
  Finding,
  ProjectRule,
  Rule,
  RuleMetadata,
  ScanFile,
  ScanReport,
  ScanSummary,
  Severity,
} from "./types/index.js";

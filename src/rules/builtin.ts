import path from "node:path";
import type { Finding, Rule, ScanFile } from "../types/index.js";
import { createFinding, isSuppressed, scanLines } from "./helpers.js";
import { builtinProjectRules } from "./project.js";

function isAgentInstructionFile(file: ScanFile): boolean {
  const name = path.basename(file.relativePath).toUpperCase();
  return (
    name === "AGENTS.MD" ||
    name === "SKILL.MD" ||
    /(?:^|\/)(?:\.agents|\.claude|\.cursor|skills)\//i.test(file.relativePath)
  );
}

function isInstallContext(file: ScanFile): boolean {
  const name = path.basename(file.relativePath);
  return (
    isAgentInstructionFile(file) ||
    /^(?:install|setup|preinstall|postinstall)\./i.test(name) ||
    /(?:^|\/)(?:\.mcp|mcp(?:\.config)?)\.jsonc?$/i.test(file.relativePath)
  );
}

export const builtinRules: Rule[] = [
  {
    metadata: {
      id: "WR-001",
      title: "Known credential format",
      severity: "critical",
      description: "A value matches the format of a known API key, token, or private key.",
      remediation:
        "Remove the value, rotate the exposed credential, and load it from an approved secret store.",
      references: ["https://cwe.mitre.org/data/definitions/798.html"],
    },
    scan(file) {
      return scanLines(file, this.metadata, [
        /\bAKIA[0-9A-Z]{16}\b/,
        /\bgh[pousr]_[A-Za-z0-9]{20,}\b/,
        /\bsk-ant-[A-Za-z0-9_-]{20,}\b/,
        /\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}\b/,
        /\bAIza[0-9A-Za-z_-]{35}\b/,
        /\b(?:sk|rk)_live_[0-9A-Za-z]{16,}\b/,
        /\bxox[baprs]-[0-9A-Za-z-]{10,}\b/,
        /\bhf_[0-9A-Za-z]{20,}\b/,
        /\bnpm_[0-9A-Za-z]{20,}\b/,
        /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/,
      ]);
    },
  },
  {
    metadata: {
      id: "WR-002",
      title: "Sensitive credential access",
      severity: "high",
      description: "An agent instruction or script reads a sensitive credential location.",
      remediation:
        "Limit reads to declared project files and request explicit user approval before accessing credentials.",
      references: ["https://modelcontextprotocol.io/specification/"],
    },
    scan(file) {
      return scanLines(file, this.metadata, [
        /(?:cat|type|read|get-content|source|\.)\s+["']?(?:\.\.?[/\\])?\.env\b/i,
        /(?:~|\$HOME|\$env:USERPROFILE|%USERPROFILE%)[/\\]\.ssh\b/i,
        /(?:~|\$HOME|\$env:USERPROFILE|%USERPROFILE%)[/\\]\.aws[/\\]credentials\b/i,
        /(?:Login Data|Cookies|Local State|keychain|credential manager)/i,
      ]);
    },
  },
  {
    metadata: {
      id: "WR-003",
      title: "Potential sensitive data exfiltration",
      severity: "critical",
      description:
        "Sensitive file or environment data may be sent to an external network endpoint.",
      remediation:
        "Remove the transfer or restrict it to an explicitly declared endpoint with user approval and data minimization.",
      references: ["https://owasp.org/www-project-top-10-for-large-language-model-applications/"],
    },
    scan(file) {
      const findings: Finding[] = [];
      const lines = file.content.split(/\r?\n/);
      const sourcePattern =
        /(?:process\.env(?:\.|\[['"])[A-Z0-9_]*(?:KEY|TOKEN|SECRET|PASSWORD|CREDENTIAL)|os\.(?:environ|getenv)[^\r\n]*(?:KEY|TOKEN|SECRET|PASSWORD|CREDENTIAL)|\$env:[A-Z0-9_]*(?:KEY|TOKEN|SECRET|PASSWORD|CREDENTIAL)|\$\{?[A-Z0-9_]*(?:KEY|TOKEN|SECRET|PASSWORD|CREDENTIAL)\}?|%[A-Z0-9_]*(?:KEY|TOKEN|SECRET|PASSWORD|CREDENTIAL)%|(?:get-content|readfilesync|cat)\b[^\r\n]*(?:\.env\b|credentials|\.ssh)|\b(?:printenv|env)\s*(?:[|;]|$))/i;
      const sinkPattern =
        /(?:https?:\/\/|curl\b|wget\b|fetch\s*\(|axios\b|requests?\.(?:post|put)|invoke-restmethod|invoke-webrequest)/i;

      lines.forEach((line, index) => {
        if (!sinkPattern.test(line) || isSuppressed(lines, index, this.metadata.id)) {
          return;
        }
        const windowStart = Math.max(0, index - 5);
        const contextLines = lines.slice(windowStart, index);
        const taintedVariables = new Set<string>();

        for (const contextLine of contextLines) {
          const assignment = contextLine.match(
            /(?:\b(?:const|let|var)\s+)?([A-Za-z_$][\w$]*)\s*=\s*(.+)/,
          );
          if (!assignment?.[1] || !assignment[2]) {
            continue;
          }
          const rightHandSide = assignment[2];
          if (
            sourcePattern.test(rightHandSide) ||
            [...taintedVariables].some((name) =>
              new RegExp(`\\b${name.replaceAll("$", "\\$")}\\b`).test(rightHandSide),
            )
          ) {
            taintedVariables.add(assignment[1]);
          }
        }

        const hasTaintedValue =
          sourcePattern.test(line) ||
          [...taintedVariables].some((name) =>
            new RegExp(`\\b${name.replaceAll("$", "\\$")}\\b`).test(line),
          );
        if (hasTaintedValue) {
          const sinkMatch = sinkPattern.exec(line);
          findings.push(
            createFinding(
              this.metadata,
              file,
              index + 1,
              (sinkMatch?.index ?? 0) + 1,
              line,
            ),
          );
        }
      });
      return findings;
    },
  },
  {
    metadata: {
      id: "WR-004",
      title: "Remote download and execution",
      severity: "high",
      description: "A remote script is downloaded and executed without local review.",
      remediation:
        "Pin an immutable version and checksum, download it separately, review it, and execute only after verification.",
      references: ["https://slsa.dev/spec/v1.0/threats-overview"],
    },
    scan(file) {
      return scanLines(file, this.metadata, [
        /\b(?:curl|wget)\b[^|;&]*(?:https?:\/\/)[^|;&]*\|\s*(?:sudo\s+)?(?:sh|bash|zsh|node|python\d?)\b/i,
        /\b(?:iwr|irm|invoke-webrequest|invoke-restmethod)\b[^\r\n|;]*(?:https?:\/\/)[^\r\n|;]*\|\s*(?:iex|invoke-expression)\b/i,
        /\b(?:iex|invoke-expression)\s*\([^)]*(?:downloadstring|invoke-webrequest|invoke-restmethod)/i,
        /\bpowershell(?:\.exe)?\b.*-(?:enc|encodedcommand)\b/i,
      ]);
    },
  },
  {
    metadata: {
      id: "WR-005",
      title: "High-risk destructive operation",
      severity: "high",
      description: "A command may recursively delete or overwrite a high-risk path.",
      remediation:
        "Constrain the operation to a validated project subdirectory and require explicit confirmation.",
      references: ["https://cwe.mitre.org/data/definitions/73.html"],
    },
    scan(file) {
      return scanLines(file, this.metadata, [
        /\brm\s+-[a-z]*r[a-z]*f[a-z]*\s+(?:\/|~|\$HOME|\.\.[/\\])/i,
        /\brm\s+-[a-z]*f[a-z]*r[a-z]*\s+(?:\/|~|\$HOME|\.\.[/\\])/i,
        /\bremove-item\b(?=.*-recurse)(?=.*-force).*(?:[A-Z]:\\|[/\\]\.\.[/\\]|\$env:USERPROFILE)/i,
        /\bdd\b[^;\r\n]*\bof=\/dev\/(?:sd[a-z]|nvme\d+n\d+)\b/i,
      ]);
    },
  },
  {
    metadata: {
      id: "WR-007",
      title: "Secret exposed through public frontend environment",
      severity: "critical",
      description:
        "A secret-like value is assigned to an environment variable that client bundles expose publicly.",
      remediation:
        "Move the secret to server-only code and proxy the operation through an authenticated backend.",
      references: ["https://vite.dev/guide/env-and-mode"],
    },
    scan(file) {
      return scanLines(file, this.metadata, [
        /\b(?:VITE|NEXT_PUBLIC|REACT_APP)_[A-Z0-9_]*(?:KEY|TOKEN|SECRET|PASSWORD)[A-Z0-9_]*\s*[:=]\s*["']?[^\s"',}]{8,}/i,
      ]);
    },
  },
  {
    metadata: {
      id: "WR-008",
      title: "Sensitive value written to logs",
      severity: "high",
      description: "A credential or sensitive environment value may be printed to logs.",
      remediation:
        "Remove the log statement or log only a non-sensitive identifier with explicit redaction.",
      references: ["https://cwe.mitre.org/data/definitions/532.html"],
    },
    scan(file) {
      return scanLines(file, this.metadata, [
        /(?:console\.(?:log|debug|info|warn|error)|logger\.\w+)\s*\([^)]*(?:process\.env\.)?[A-Z0-9_]*(?:KEY|TOKEN|SECRET|PASSWORD)/i,
        /\bprint\s*\([^)]*(?:os\.environ|os\.getenv)[^)]*(?:KEY|TOKEN|SECRET|PASSWORD)/i,
        /\b(?:echo|write-host|write-output)\b[^\r\n]*(?:\$env:|\$\{?)[A-Z0-9_]*(?:KEY|TOKEN|SECRET|PASSWORD)/i,
      ]);
    },
  },
  {
    metadata: {
      id: "WR-009",
      title: "Credential embedded in connection URL",
      severity: "critical",
      description: "A connection URL contains an inline username and password or token.",
      remediation:
        "Remove credentials from the URL, rotate them, and inject them from a secret store at runtime.",
      references: ["https://cwe.mitre.org/data/definitions/798.html"],
    },
    scan(file) {
      return scanLines(file, this.metadata, [
        /\b(?:postgres(?:ql)?|mysql|mongodb(?:\+srv)?|redis|amqp|https?):\/\/[^:\s/@]+:[^@\s/]{4,}@/i,
      ]);
    },
  },
  {
    metadata: {
      id: "WR-010",
      title: "Hardcoded authorization header",
      severity: "critical",
      description: "An Authorization header contains a hardcoded bearer or basic credential.",
      remediation:
        "Load the credential at runtime from a protected secret source and rotate the exposed value.",
      references: ["https://cwe.mitre.org/data/definitions/798.html"],
    },
    scan(file) {
      return scanLines(file, this.metadata, [
        /authorization["']?\s*[:=]\s*["'](?:bearer|basic)\s+[A-Za-z0-9._~+\/=-]{8,}/i,
        /-(?:h|header)\s+["']authorization:\s*(?:bearer|basic)\s+[A-Za-z0-9._~+\/=-]{8,}/i,
      ]);
    },
  },
  {
    metadata: {
      id: "WR-011",
      title: "Generic hardcoded secret",
      severity: "high",
      description: "A secret-named variable contains a hardcoded value.",
      remediation:
        "Replace the literal with a runtime environment lookup or approved secret manager reference.",
      references: ["https://cwe.mitre.org/data/definitions/798.html"],
    },
    scan(file) {
      const name = path.basename(file.relativePath);
      if (/^Dockerfile(?:\.|$)/i.test(name) || /^docker-compose\.ya?ml$/i.test(name)) {
        return [];
      }
      return scanLines(file, this.metadata, [
        /\b(?:api[_-]?key|access[_-]?token|auth[_-]?token|client[_-]?secret|password|passwd|secret)\s*[:=]\s*(?!["']?(?:process\.env|deno\.env|bun\.env|os\.(?:environ|getenv)|env\s*\(|\$env:|\$\{))["']?[A-Za-z0-9_./+=:-]{8,}/i,
      ]).filter(
        (finding) =>
          !finding.evidence.includes("<redacted-token>") &&
          !/\b(?:VITE|NEXT_PUBLIC|REACT_APP)_/i.test(finding.evidence),
      );
    },
  },
  {
    metadata: {
      id: "WR-012",
      title: "Secret persisted in container build",
      severity: "high",
      description: "A secret-like value is assigned in a Docker build layer or Compose file.",
      remediation:
        "Use BuildKit secret mounts or runtime secret injection instead of Docker ARG, ENV, or committed Compose values.",
      references: ["https://docs.docker.com/build/building/secrets/"],
    },
    scan(file) {
      const name = path.basename(file.relativePath);
      if (!/^Dockerfile(?:\.|$)/i.test(name) && !/^docker-compose\.ya?ml$/i.test(name)) {
        return [];
      }
      return scanLines(file, this.metadata, [
        /\b(?:ARG|ENV)\s+[A-Z0-9_]*(?:KEY|TOKEN|SECRET|PASSWORD)[A-Z0-9_]*(?:=|\s+)[^\s$]{8,}/i,
        /^\s*[A-Z0-9_]*(?:KEY|TOKEN|SECRET|PASSWORD)[A-Z0-9_]*\s*:\s*["']?[A-Za-z0-9_./+=:-]{8,}/i,
      ]);
    },
  },
  {
    metadata: {
      id: "WR-013",
      title: "Instruction attempts to bypass safeguards",
      severity: "high",
      description: "An agent instruction asks the model to ignore safeguards, hide actions, or bypass confirmation.",
      remediation:
        "Remove the bypass instruction and require explicit user approval for sensitive actions.",
      references: ["https://owasp.org/www-project-top-10-for-large-language-model-applications/"],
    },
    scan(file) {
      if (!isAgentInstructionFile(file)) {
        return [];
      }
      return scanLines(file, this.metadata, [
        /\bignore\s+(?:all\s+)?(?:previous|prior|system|developer|security|safety)\s+(?:(?:system|developer|security|safety)\s+)?(?:instructions?|rules?|restrictions?)/i,
        /\b(?:bypass|skip|avoid)\s+(?:user\s+)?(?:approval|confirmation|permission|safeguards?)/i,
        /\b(?:hide|conceal)\s+(?:the\s+)?(?:operation|action|command|process)\s+from\s+(?:the\s+)?user/i,
        /(?:不要|无需|绕过).{0,12}(?:用户确认|安全限制|权限检查)/,
        /(?:忽略|无视).{0,12}(?:系统规则|安全规则|之前的指令)/,
      ]);
    },
  },
  {
    metadata: {
      id: "WR-014",
      title: "Invisible Unicode control character",
      severity: "medium",
      description: "An instruction contains an invisible character that can conceal or reorder text.",
      remediation:
        "Remove the control character and review the surrounding instruction as plain visible text.",
      references: ["https://unicode.org/reports/tr36/"],
    },
    scan(file) {
      if (!isAgentInstructionFile(file)) {
        return [];
      }
      const findings: Finding[] = [];
      const lines = file.content.split(/\r?\n/);
      const controlPattern = /[\u200B-\u200F\u202A-\u202E\u2060\u2066-\u2069\uFEFF]/;
      lines.forEach((line, index) => {
        const match = controlPattern.exec(line);
        if (!match || isSuppressed(lines, index, this.metadata.id)) {
          return;
        }
        const codePoint = match[0]?.codePointAt(0)?.toString(16).toUpperCase().padStart(4, "0");
        findings.push(
          createFinding(
            this.metadata,
            file,
            index + 1,
            match.index + 1,
            `Invisible Unicode character U+${codePoint ?? "UNKNOWN"}`,
          ),
        );
      });
      return findings;
    },
  },
  {
    metadata: {
      id: "WR-015",
      title: "Unpinned remote dependency",
      severity: "medium",
      description: "An install path references a mutable branch, latest release, or unpinned package.",
      remediation:
        "Pin an immutable package version, commit SHA, and integrity hash where supported.",
      references: ["https://slsa.dev/spec/v1.0/threats-overview"],
    },
    scan(file) {
      if (!isInstallContext(file)) {
        return [];
      }
      return scanLines(file, this.metadata, [
        /raw\.githubusercontent\.com\/[^/\s]+\/[^/\s]+\/(?:main|master)\//i,
        /github\.com\/[^/\s]+\/[^/\s]+\/(?:archive\/refs\/heads\/(?:main|master)|releases\/latest)/i,
        /\b(?:npm|pnpm|yarn)\s+(?:install|add|exec)\s+(?:-g\s+)?[A-Za-z0-9@][^\s]*@latest\b/i,
        /\bnpx\s+(?:--yes\s+)?(?![^@\s]+@\d)[A-Za-z0-9][A-Za-z0-9._/-]*(?:\s|$)/i,
      ]);
    },
  },
];

export function findRule(ruleId: string): Rule | (typeof builtinProjectRules)[number] | undefined {
  return [...builtinRules, ...builtinProjectRules].find(
    (rule) => rule.metadata.id.toUpperCase() === ruleId.toUpperCase(),
  );
}

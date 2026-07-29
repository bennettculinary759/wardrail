import type { Rule } from "../types/index.js";
import { scanLines } from "./helpers.js";
import {
  genericHardcodedSecretPattern,
  knownCredentialPatterns,
} from "./secret-patterns.js";

export const historyRules: Rule[] = [
  {
    metadata: {
      id: "WR-016",
      title: "Known credential remains in Git history",
      severity: "critical",
      description:
        "A known API key, token, or private key exists in a historical Git revision even if it was deleted later.",
      remediation:
        "Revoke or rotate the credential immediately. Remove it from current code, then coordinate any history rewrite with collaborators; rewriting history does not make the old credential safe.",
      references: [
        "https://docs.github.com/authentication/keeping-your-account-and-data-secure/removing-sensitive-data-from-a-repository",
      ],
    },
    scan(file) {
      return scanLines(file, this.metadata, knownCredentialPatterns);
    },
  },
  {
    metadata: {
      id: "WR-017",
      title: "Generic secret remains in Git history",
      severity: "high",
      description:
        "A secret-named variable, credential URL, or authorization value exists in a historical Git revision.",
      remediation:
        "Verify whether the value was real. If it was, revoke or rotate it before considering a coordinated history rewrite.",
      references: [
        "https://docs.github.com/code-security/secret-scanning/introduction/about-secret-scanning",
      ],
    },
    scan(file) {
      return scanLines(file, this.metadata, [
        genericHardcodedSecretPattern,
        /\b(?:postgres(?:ql)?|mysql|mongodb(?:\+srv)?|redis|amqp|https?):\/\/[^:\s/@]+:[^@\s/]{4,}@/i,
        /authorization["']?\s*[:=]\s*["'](?:bearer|basic)\s+[A-Za-z0-9._~+\/=-]{8,}/i,
      ]);
    },
  },
];

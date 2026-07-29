export const knownCredentialPatterns = [
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
];

export const genericHardcodedSecretPattern =
  /\b(?:api[_-]?key|access[_-]?token|auth[_-]?token|client[_-]?secret|password|passwd|secret)\s*[:=]\s*(?!["']?(?:process\.env|deno\.env|bun\.env|os\.(?:environ|getenv)|env\s*\(|\$env:|\$\{))["']?[A-Za-z0-9_./+=:-]{8,}/i;

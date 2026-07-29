# Rule development

Built-in rules implement the `Rule` interface in `src/types/index.ts` and live
in `src/rules/builtin.ts`.

Each rule must provide:

1. A stable `WR-NNN` identifier.
2. A severity and concise title.
3. An explanation and actionable remediation.
4. At least one authoritative reference.
5. Dangerous, safe, suppression, and redaction tests where applicable.

Rules receive text only after file discovery and the maximum file-size check.
They must not execute code, resolve remote resources, or read files outside the
provided scan context. Prefer narrow patterns that describe a security
relationship instead of matching isolated words.

Add tests to `tests/rules.test.ts` and run:

```bash
npm run typecheck
npm test
```

# Contributing to Wardrail

Thank you for helping new builders and security teams catch risky agent
configuration before it runs.

Wardrail especially welcomes first-time open-source contributors. Security
experience is useful, but not required; a clear false-positive report or a
better beginner explanation is a valuable contribution.

## Ways to contribute

- Report a reproducible bug.
- Submit a false positive with all private data removed.
- Propose a rule with dangerous and safe examples.
- Improve remediation text or documentation.
- Add support for an agent configuration format.
- Translate the beginner safety guide.

Use the structured GitHub issue forms so reports include the information
needed to act on them.

## Local setup

Requires Node.js 20 or later.

```bash
npm install
npm run verify
```

`npm run verify` runs type checking, all tests, a production build, and a
Wardrail self-scan.

## Rule requirements

Every security rule must include:

1. A stable `WR-NNN` identifier.
2. A clear severity, explanation, and actionable remediation.
3. At least one authoritative reference.
4. A dangerous fixture that must be detected.
5. A safe fixture that must not be detected.
6. A documented false-positive and suppression strategy.
7. Evidence-redaction coverage when credentials may be matched.

Prefer rules that express a security relationship over isolated keyword
matching. For example, “sensitive environment value reaches an HTTP request”
is more useful than flagging every environment-variable read.

See [docs/rule-development.md](docs/rule-development.md).

## Credential safety

Never put a real credential in an issue, fixture, commit, screenshot, or test.
Use synthetic values that cannot authenticate to a real service.

If you accidentally submit a real credential:

1. rotate or revoke it immediately;
2. contact the maintainers through the private security process;
3. do not rely on editing or deleting the public message.

## Pull requests

- Keep scanning static and offline by default.
- Do not execute target code or follow target symlinks.
- Keep changes focused and explain user-visible behavior.
- Update English and Chinese entry documentation when behavior changes.
- Run `npm run verify`.
- Complete the pull request checklist.

Security vulnerabilities should follow [SECURITY.md](SECURITY.md), not a
public issue.

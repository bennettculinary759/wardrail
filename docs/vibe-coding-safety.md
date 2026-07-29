# Vibe coding without leaking your API keys

AI coding tools make software development more accessible. They also make it
easy to ship code before learning which values are safe to place in a browser,
repository, log, or prompt.

This guide covers the minimum secret-safety model every new builder needs.

## 1. An API key is an account credential

Treat an API key like a password. Anyone who obtains it may be able to consume
your quota, access data, impersonate your application, or create charges.

Never paste a real credential into:

- source code;
- `AGENTS.md` or `SKILL.md`;
- an MCP JSON file committed to Git;
- a screenshot, issue, chat, or tutorial;
- browser-side environment variables;
- logs or error messages.

## 2. `.env` is a filename, not a security boundary

Moving a key from source code into `.env` is only safe when:

- the file is excluded by `.gitignore`;
- the value is used only by trusted server-side code;
- build tools do not copy it into client bundles;
- logs and error messages do not print it.

Keep a safe `.env.example` containing names but no real values:

```env
OPENAI_API_KEY=
DATABASE_URL=
```

## 3. Public frontend prefixes are public

Vite documents that `VITE_*` values are bundled into client-side source.
Similar conventions include `NEXT_PUBLIC_*` and `REACT_APP_*`.

Unsafe:

```env
VITE_OPENAI_API_KEY=***
```

Safer architecture:

```text
browser → your authenticated backend → external API
                     ↑
             server-side secret
```

The browser should call your backend. Only the backend should hold a
privileged provider credential.

## 4. Stop the leak before Git history

Run Wardrail before committing:

```bash
npx wardrail scan --staged
npx wardrail hook install
```

Preventing a secret from entering history is easier than removing it later.
GitHub describes push protection the same way: block hardcoded credentials
before they reach the repository.

## 5. If a key was exposed, rotate it

Deleting the line or making the repository private does not invalidate the
credential.

1. Revoke or rotate the key at the provider.
2. Replace it with server-side secret injection.
3. Inspect repository history, CI logs, deployment logs, and frontend assets.
4. Review provider usage and billing.
5. Add a pre-commit and CI check to prevent recurrence.

Wardrail can check recent committed versions even after the current file was
cleaned:

```bash
npx wardrail scan --history
```

It scans the latest 100 commits by default. Use `--history-limit 1000` when a
deeper check is appropriate. A history finding identifies where the value
remains, but rotation is still the first response.

## What Wardrail checks

Wardrail detects common credential formats, generic secret assignments,
unignored `.env` files, public frontend variables, logging, connection URLs,
Authorization headers, Docker layers, and short flows into network requests.

It runs locally and redacts evidence before reporting.

## What it cannot guarantee

Wardrail scans a bounded number of Git commits and reports when the limit or a
shallow clone prevents complete coverage. It does not scan binary files,
screenshots, unreachable Git objects, or heavily obfuscated values. A clean
result is a useful safety check, not proof that no secret has ever been
exposed.

## Further reading

- [GitHub push protection](https://docs.github.com/en/code-security/concepts/secret-security/push-protection)
- [GitHub secret scanning](https://docs.github.com/en/code-security/concepts/secret-security/secret-scanning)
- [Vite environment variables and secret guidance](https://vite.dev/guide/env-and-mode)

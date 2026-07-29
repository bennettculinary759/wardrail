# Wardrail roadmap

Wardrail aims to become the default local safety check for vibe-coded apps,
MCP configurations, and AI agent projects.

## Now: reliable local protection

- 15 explainable rules
- source, `.env`, MCP, Skill, instruction, shell, and Docker scanning
- terminal, JSON, and SARIF output
- staged-file pre-commit checks
- GitHub Code Scanning integration
- baselines and narrow inline suppressions
- offline-by-default operation

## Next: better secret coverage

- Git-history and commit-range scanning
- entropy-assisted generic-token detection
- more provider-specific key formats
- framework-aware public environment rules
- secret-safe `.env.example` validation
- clearer confidence levels and fewer false positives

## Then: deeper agent understanding

- cross-file sensitive-data flow
- MCP permission and capability graphs
- Skill description-versus-behavior checks
- configurable community rule packs
- package provenance and typosquatting signals
- more agent configuration formats

## Toward 1.0

- stable public rule API
- versioned configuration schema
- performance benchmarks on large repositories
- Windows, macOS, and Linux installation testing
- VS Code diagnostics
- documented compatibility and deprecation policy

## Good first contributions

- Add dangerous and safe fixtures for one credential provider.
- Improve one remediation message for a first-time developer.
- Report a false positive with all real credentials removed.
- Add discovery support for one agent configuration filename.
- Translate the beginner safety guide.

Every rule contribution needs a dangerous case, a safe case, and an
explanation of likely false positives.

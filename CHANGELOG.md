# Changelog

All notable Wardrail changes are documented here.

## 0.3.0 - 2026-07-29

### Added

- `wardrail scan --history` for bounded, read-only scanning of committed Git
  file versions.
- `--history-limit` with a safe default of 100 recent commits.
- `WR-016` for known credentials that remain in Git history.
- `WR-017` for generic secrets, credential URLs, and authorization values in
  Git history.
- Commit hashes, shallow-clone warnings, and truncation details in reports.
- A VS Code launch configuration and task for Git-history scans.

### Security

- Historical blobs are read directly without checkout, hooks, text conversion,
  or execution.
- Secret evidence remains redacted in terminal, JSON, and SARIF output.
- History scans enforce commit, file-count, and per-file size limits.

## 0.2.0 - 2026-07-29

- First public npm release.
- 15 explainable rules for secrets, agent instructions, dangerous commands,
  data exfiltration, and supply-chain risks.
- Terminal, JSON, and SARIF reports.
- Staged scans, pre-commit hooks, baselines, and GitHub Code Scanning.

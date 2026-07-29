# GitHub Code Scanning

Wardrail emits SARIF 2.1.0 and can publish findings to the repository
Security tab.

This repository contains a working workflow at
`.github/workflows/code-scanning.yml`. A consumer workflow can use the
published npm package:

```yaml
name: Wardrail

on:
  push:
  pull_request:

permissions:
  contents: read
  security-events: write

jobs:
  scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm install --no-save wardrail
      - name: Generate SARIF
        continue-on-error: true
        run: npx wardrail scan . --format sarif --output wardrail.sarif
      - uses: github/codeql-action/upload-sarif@v3
        with:
          sarif_file: wardrail.sarif
          category: wardrail
      - name: Enforce critical findings
        run: npx wardrail scan . --fail-on critical --no-color
```

The SARIF generation step continues so GitHub can upload findings even when
the scanner returns exit status `1`. The final step enforces the chosen
severity threshold. Scanner or configuration errors return status `2`.

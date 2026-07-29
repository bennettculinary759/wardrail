## What changed?

Describe the user-visible outcome.

## Why?

Explain the risk, bug, or workflow this addresses.

## Security-rule checklist

- [ ] Dangerous fixture added or updated
- [ ] Safe fixture added or updated
- [ ] Likely false positives considered
- [ ] Evidence remains redacted
- [ ] Remediation is understandable to a first-time developer

Use “Not applicable” when the change does not affect rules.

## Verification

- [ ] `npm run typecheck`
- [ ] `npm test`
- [ ] `npm run build`
- [ ] `npm run scan:self`

## Safety

- [ ] This pull request contains no real credentials or private data.

# Wardrail launch checklist

This checklist keeps the first public release credible and easy to try.

## Before publishing

- Reserve the `wardrail` npm package by publishing an intentional first
  release.
- Create the final GitHub repository and update package metadata and SARIF
  `informationUri`.
- Enable GitHub Discussions, private vulnerability reporting, and branch
  protection.
- Confirm CI on Node.js 20, 22, and 24.
- Run `npm run verify` from a clean checkout.
- Install the generated npm tarball in an empty directory and run a scan.
- Verify every README command against the published package.
- Replace the pre-release badge with the npm version badge.

## Twenty-second demo

1. Show a small app containing a synthetic API key.
2. Stage the file with Git.
3. Run `git commit`.
4. Show Wardrail stop the commit and redact the key.
5. Move the key server-side.
6. Run the commit again and show it pass.

Never use a working credential in a demo.

## Launch message

Lead with the problem, not the architecture:

> AI helped you ship your first app. Wardrail helps stop your first API key
> from shipping with it.

Then show:

- the exact unsafe line;
- the redacted Wardrail finding;
- the one-command pre-commit setup;
- local and offline operation;
- a link to the beginner safety guide.

## Where to share

- GitHub repository topics and release notes
- developer communities focused on beginner projects
- AI coding and MCP communities
- security engineering communities
- concise technical posts demonstrating one real class of mistake

Avoid generic promotion. Each post should teach one useful security lesson and
use only synthetic credentials.

## After launch

- Label and prioritize false positives as product bugs.
- Publish small rule improvements regularly.
- Convert recurring questions into documentation.
- Track successful installs, external contributors, adopted CI workflows, and
  resolved false positives—not only stars.

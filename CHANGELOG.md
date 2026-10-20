# Changelog

Notable changes to this project are recorded here.

## Unreleased

- Added automatic Codex recovery after ordinary repair attempts are exhausted, with error and evidence context, full re-verification, and a persisted one-pass limit per iteration. Existing stopped checkpoints can recover on resume. Bumped the package version to `1.2.0`.
- Bumped the package version to `1.1.1`.
- Added `ralph server` for a live local browser view of the current directory's `progress.txt`, with run/search filters, expandable event details, raw text, and configurable port; bumped the package version to `1.1.0`.
- Fixed browser verification for global installations by using the target project's Playwright runner and avoiding a second Playwright import in Ralph's config. Added isolated-install regression coverage and actionable missing-dependency errors; bumped the package version to `1.0.4`.
- Added `ralph --version` to print the installed package version and exit; bumped the package version to `1.0.3`.
- Bumped the package version to `1.0.2` and updated npm publication metadata and documentation.
- Prepared the project for npm publication as `@muthuspark/ralph`.
- Added this changelog and an agent instruction to update it before each commit.

## 2026-10-19

- Added Python project support and configurable verification commands.
- Added Claude CLI as a supported agent and addressed follow-up review findings.
- Documented the Ralph workflow with a flow diagram, including a rendered SVG.


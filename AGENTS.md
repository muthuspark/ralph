# Agent instructions

## Changelog

Before creating any Git commit, update `CHANGELOG.md` with a concise entry describing the changes included in that commit. Add entries under `Unreleased` unless the project has a release-specific section. Do not create a commit until the changelog entry is in place.

## Versioning

Before creating each Git commit that includes codebase changes, increment the tool's version using the appropriate Semantic Versioning level (patch, minor, or major). Update the `version` in `package.json` and keep the corresponding version in `package-lock.json` in sync. Do not create the commit until both version files are updated.

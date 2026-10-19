# Ralph

A global CLI and TypeScript library for goal-driven Codex iterations. Ralph ranks
five proposed improvements, implements one, runs checks and browser verification,
reviews the changes, and commits each verified iteration on a local branch.

## Install locally as a global command

Requires Node.js 22+, npm, Git, and an authenticated `codex` executable on `PATH`.

Install directly from GitHub:

```sh
npm install --global git+https://github.com/muthuspark/ralph.git
ralph --help
```

From this package directory:

```sh
npm install
npm link
ralph --help
```

For an independent installation you can distribute without the source directory:

```sh
npm pack
npm install --global ./ralph-1.0.0.tgz
```

The package is private to prevent accidental registry publication. Local global
installation and tarball distribution work normally. `npm link` follows this
checkout; rebuild with `npm run build` after changing the source.

## Run in a project

Ralph operates on the Git repository containing your current directory. It stores
`progress.txt` and `.ralph/` at that repository's root, independently for each project.

Before the first run:

- Add `.ralph/` to the project's `.gitignore` and commit it.
- Provide working `lint`, `typecheck`, `test`, and `build` npm scripts.
- Install `@playwright/test` as a dev dependency in the project so its generated
  browser specs can import it. Match the version used by Ralph when possible.
- Install Chromium with `npx playwright install chromium` in the project.
- Start the app separately, using test-owned data for acceptance checks.
- Commit existing changes. Ralph requires a clean tree and an initial Git commit.

```sh
cd /path/to/project
ralph --goal "Improve onboarding" --iterations 3 --base-url http://localhost:3000
ralph --goal-file requirements.txt --iterations 1
ralph --resume <run-id>
```

The default limit is ten verified commits; `--iterations 0` runs without a limit.
The app must remain available at `--base-url` (default `http://localhost:3000`).
Ralph uses its bundled Playwright runner and configuration; the project does not
need a `test:e2e:ralph` npm script or a `playwright.ralph.config.ts` file.
Generated specs live under `e2e/ralph/<run-id>/` in the project.

Ralph creates a `ralph/<run-id>` branch and commits verified changes automatically.
It never pushes, merges, or deploys. Codex calls may incur usage charges.

## Progress and recovery

`progress.txt` is an append-only, timestamped record of phases, ranked candidates,
implementation decisions, check results, repairs, and stop/resume instructions.
It is created automatically when a run starts and included in verified commits.
Watch it from another terminal:

```sh
tail -f progress.txt
```

Detailed command logs, prompts, browser reports, and resumable checkpoints are
stored in `.ralph/<run-id>/`. Ctrl+C preserves unfinished changes and records the
resume command. Resume from the same branch and working tree. After manually
fixing an unfinished increment, use:

```sh
ralph --resume <run-id> --retry-verification
```

This accepts the current edits for full verification and preserves the repair
count. `ralph --help` lists the remaining options.

## Library

The package exports ESM functions and TypeScript declarations:

```ts
import { parseOptions, runRalph } from "ralph";

const options = parseOptions(["--goal", "Improve onboarding", "--iterations", "1"]);
await runRalph(options, "/absolute/path/to/project");
```

Install the tarball as a dependency to import it; a global command installation
does not make the package available to Node imports in unrelated projects.
`runRalph` accepts an optional third `AbortSignal` argument. Browser report
validation is exported from `ralph/browser`.

## Development

```sh
npm run lint
npm run typecheck
npm test
npm run build
```

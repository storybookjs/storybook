# Repository Guidelines

## Project Structure & Module Organization
- Root packages live under `code/*` (e.g., `code/core`, `code/lib/create-storybook`, `code/frameworks`). Each package uses `src/` for code with colocated tests.
- Scripts and dev tooling: `scripts/` (sandbox generation, tasks, CI helpers).
- Example sandboxes: `sandbox/`; documentation: `docs/`.

## Build, Test, and Development Commands
- `yarn i` — bootstrap the repo (installs and builds scripts, then packages).
- `yarn task --task dev --template react-vite/default-ts` — run a local sandbox dev workflow.
- `yarn --cwd code build` — build all packages.
- `yarn test` (root) or `yarn --cwd code test` — run Vitest across packages.
- Important: after changes that affect sandboxes or compiled outputs, run `yarn task --task "compile"` before validating with Vitest.

## Coding Style & Naming Conventions
- TypeScript-first. Use top‑level `import` statements; avoid `require`.
- Formatting via Prettier; lint with ESLint: `yarn --cwd code lint`.
- Naming: descriptive; files use kebab-case; types/classes use PascalCase.

## Testing Guidelines
- Framework: Vitest (repository-wide). Aim to maintain or improve coverage where you touch code. Use snapshots intentionally.

### Use Wallaby.js first
- Use Wallaby.js for test results, errors, and debugging
- Leverage runtime values and coverage data when debugging tests
- Fall back to terminal only if Wallaby isn't available

1. Analyze failing tests with Wallaby and identify the cause of the failure.
2. Use Wallaby's covered files to find relevant implementation files or narrow your search.
3. Use Wallaby's runtime values tool and coverage tool to support your reasoning.
4. Suggest and explain a code fix that will resolve the failure.
5. After the fix, use Wallaby's reported test state to confirm that the test now passes.
6. If the test still fails, continue iterating with updated Wallaby data until it passes.
7. If a snapshot update is needed, use Wallaby's snapshot tools for it.

When responding:
- Explain your reasoning step by step.
- Use runtime and coverage data directly to justify your conclusions.

## Commit & Pull Request Guidelines
- Commits: concise, imperative subject lines; reference issues when applicable.
- PRs: include a clear description, rationale, and testing notes (what you ran, e.g., `yarn --cwd code test`). Add screenshots/logs when relevant and link related issues/PRs.

## Security & Configuration Tips
- Do not commit secrets. Use environment variables and local `.env` files.
- Keep local tool versions aligned (see `.nvmrc` and `packageManager`). Update docs when changing commands or flags.


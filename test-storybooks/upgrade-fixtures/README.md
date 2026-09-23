# Storybook upgrade fixtures

These projects are pinned to Storybook 10.5.10. They verify that a checked-out Storybook build can
upgrade representative v10 projects, run its automigrations, install the upgraded dependencies, and
start successfully.

The four seeds cover React with Vite, Next.js, Angular with Webpack, and React with Webpack. Keep the
seeds small and on v10: the harness copies them before every run, so automigrations never modify the
checked-in source.

## Run the harness

Use Node 22.22.3 and install this repository's dependencies first. Run one fixture:

```sh
node test-storybooks/upgrade-fixtures/run.ts react-vite
node test-storybooks/upgrade-fixtures/run.ts nextjs
node test-storybooks/upgrade-fixtures/run.ts angular
node test-storybooks/upgrade-fixtures/run.ts react-webpack
```

Run all four with one compile and local publish:

```sh
node test-storybooks/upgrade-fixtures/run.ts all
```

Each normal run:

1. compiles the current checkout;
2. publishes that build to Storybook's local registry;
3. installs a clean copy of each v10 seed;
4. runs the local build's `storybook upgrade --yes --force` in an agent-marked environment;
5. rejects dependency or automigration failures and verifies the installed local package versions;
6. verifies the known v10 `addon-mcp` migration result; and
7. runs Storybook with `--smoke-test`.

The final `GREEN` or `RED` line is suitable for a verification report. A failed project is preserved
and its temporary path is printed. Pass `--keep` to preserve successful projects too.

Use `--dry-run` to inspect the commands without compiling, installing, or starting a registry.

## React DOM shim removal proof

The React-Vite proof keeps three independent v10 inputs so a retained unsafe consumer never shares
an install with the seed that is expected to become shim-free:

- `react-vite` represents ordinary transitive usage with no direct configuration;
- `react-dom-shim-seeds/safe` overlays an explicit 10.5.10 dependency, the literal preset, and the
  literal React 16 alias, with no direct API consumer; and
- `react-dom-shim-seeds/unsafe` overlays a workspace that directly imports `renderElement` and
  `unmountElement` plus a computed alias configuration.

The v10 baseline runs all three installs and smoke tests without compiling or publishing the
checked-out repository:

```sh
node test-storybooks/upgrade-fixtures/run.ts react-vite --baseline-v10
```

The safe implementation-head command requires removal of its explicit dependency, preset, and
literal alias; a shim-free install; the approved `storybook/internal/react-dom-client` first-party
imports; the Preact peer range `^10.7.1 || >= 11.0.0-0`; and no request for a v11 shim release:

```sh
node test-storybooks/upgrade-fixtures/run.ts react-vite --verify-react-dom-shim-removal
```

Capture its expected pre-implementation failures without compiling or publishing a local build:

```sh
node test-storybooks/upgrade-fixtures/run.ts react-vite --baseline-removal-contract
```

The unsafe implementation-head command has the opposite dependency outcome. It requires the
consumer manifest, direct-import source, and computed configuration to remain byte-for-byte
unchanged; the installable 10.5.10 shim dependency to remain; and file-specific manual guidance for
both unsafe files. It also rejects any request for a nonexistent v11 shim release. This outcome is a
refused automatic migration, not a completed migration:

```sh
node test-storybooks/upgrade-fixtures/run.ts react-vite --verify-react-dom-shim-refusal
```

Capture the expected pre-implementation missing-diagnostic failures with the same refusal contract:

```sh
node test-storybooks/upgrade-fixtures/run.ts react-vite --baseline-refusal-contract
```

Both baseline contract commands must end in `RED` before the removal implementation exists. The
safe baseline lists unmet removal requirements. The unsafe baseline proves preservation and fails
only because no implementation has emitted the required file-specific guidance.

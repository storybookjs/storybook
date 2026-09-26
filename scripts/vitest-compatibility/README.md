# Vitest addon runtime compatibility

Run with the Node version in `.nvmrc`, npm, and the repository's Yarn installation.
Compile the addon, framework, renderer, builder, and core before preparing a fixture:

```sh
yarn nx run-many -t compile --projects=addon-vitest,react-vite
node scripts/vitest-compatibility/prepare.ts /tmp/storybook-vitest-5 5.0.1 react
cd /tmp/storybook-vitest-5
npx playwright install chromium
node run.ts
```

Repeat with separate directories and versions `3.2.4` and `4.0.0`. Preparation packages
local build output into tarballs and installs real, independent dependencies. It does
not link the monorepo's node_modules. `--legacy-peer-deps` prevents npm from installing
optional, unrelated Storybook peers; the required runtime peers are pinned explicitly.
Keep the generated package-lock.json with the evidence when reproducing an installation.

The harness starts the published addon child-process entry point, bridges real
UniversalStores, and runs actual Chromium stories. It checks startup without a run,
all stories, exact child selection containing regex punctuation, parent selection,
coverage off/on/off, and automatic watch failure/recovery after component edits.
Native V8 execution counts verify three `init()` calls on Vitest 3/4 or three
`standalone()` calls on Vitest 5, including both coverage restarts. A separate CLI
`vitest run --project=storybook --coverage` invocation verifies coverage output.

The intentionally failing watch run must fail before recovery passes. Its diagnostic
output is expected. Harness assertion failures produce a nonzero exit status.

Artifacts stay in the fixture: environment.json, package-lock.json, results.json,
lifecycle.json, native-coverage/, and coverage-cli/. Run browser checks outside an OS
sandbox that prevents Chromium from launching. Do not treat a blocked launch as a
product failure or a passing test.

## Framework configuration migration

Compile `vue3-vite` and `svelte-vite` before preparing the corresponding fixtures.
From the repository root:

```sh
node scripts/vitest-compatibility/prepare.ts /tmp/storybook-vitest-vue 5.0.1 vue3
node scripts/vitest-compatibility/framework-config.ts /tmp/storybook-vitest-vue vue3 existing
cd /tmp/storybook-vitest-vue
node node_modules/vitest/vitest.mjs run --project=storybook
```

Repeat with mode `single`, and with framework `svelte` in another directory. The
configuration comes from the actual updater and template. Real Vue/Svelte compiler
plugins and an alias live in shared configuration. Unit setup deliberately throws
if it leaks into the Storybook project. Explicit dependency prebundling avoids
cold-cache reloads interrupting the first browser run.

## Storybook UI

After a successful React `run.ts`, add `@storybook/addon-vitest` to the fixture's
`.storybook/main.js` addons array. Start the UI from the fixture directory:

```sh
node node_modules/storybook/dist/bin/dispatcher.js dev --ci --port 6026
```

In another terminal in that directory, run `node ui.ts http://localhost:6026`.
It selects a nested story, starts a test run through the UI, enables watch mode,
edits the component to fail, restores it, and verifies displayed failure/recovery.
It saves a Playwright trace and screenshots. Exact child/parent filtering is asserted
by `run.ts` against the real backend's completed run results.

## Coverage and mutation measurements

Collect source coverage from the repository root:

```sh
yarn --cwd code/addons/vitest vitest run --coverage --coverage.provider=v8 \
  --coverage.include=src/node/vitest-manager.ts \
  --coverage.include=src/node/coverage-reporter.ts \
  --coverage.include=src/vitest-plugin/index.ts \
  --coverage.reporter=json --coverage.reportsDirectory=/tmp/vitest-source-coverage
node scripts/vitest-compatibility/quality.ts /tmp/vitest-source-coverage/coverage-final.json /tmp/vitest-quality.json
```

The report states its complexity and coverage conventions. It measures complete
changed methods, including their pre-existing branches. Source coverage here is
from unit tests; native/browser evidence is reported separately, not silently merged.
The score formula is `complexity² × (1 − coverage)³ + complexity`.

Install pinned mutation tooling outside the repository, then run from the repository:

```sh
npm install --prefix /tmp/storybook-mutation-tools --no-audit --no-fund @stryker-mutator/core@10.0.0
node scripts/vitest-compatibility/mutation.ts /tmp/storybook-mutation-tools /tmp/storybook-mutation-results
```

This uses the command runner with coverage analysis disabled. Stryker's Vitest
runner currently constructs space-separated test-name filters, which do not select
Vitest 5 nested tests correctly. The command runner executes a fresh focused suite
for every mutant. The sandbox build compiles the mutated coverage reporter, so the
native loader tests also exercise mutations. Sandboxes stay outside the repository
to avoid NX discovering duplicate projects. Keep timeouts separate from killed
mutants when interpreting the JSON report; survivors are not waived or hidden.

After successful unmodified compatibility runs, execute explicit built-artifact
regression probes:

```sh
node scripts/vitest-compatibility/regressions.ts /tmp/storybook-vitest-3 /tmp/storybook-vitest-4 /tmp/storybook-vitest-5 /tmp/storybook-regressions
```

These revert individual compatibility changes in disposable fixture packages and
require the expected failure. They restore each package in `finally`. They supplement
the generated mutation report; they do not establish a zero-survivor score for whole
functions or substitute for a complete base-branch run.

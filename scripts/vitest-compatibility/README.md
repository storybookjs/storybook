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

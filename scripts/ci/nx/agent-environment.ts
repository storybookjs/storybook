// What the tasks on an NX DTE agent (circleci-dte.ts) see besides the checkout and node_modules:
// the machine, the environment variables and the tools the agent installs before `nx start-agent`.
// Every task hashes this file (`ci-environment` in nx.json), so a change here runs the tasks again
// instead of restoring their results from the old environment. Like main.ts, this runs under plain
// Node before `yarn install`.
import { NODE_MODULES_CACHE_KEY, NODE_MODULES_CACHE_PATHS, cache } from '../utils/helpers.ts';
import { isTrustedAuthor } from '../utils/runtime.ts';
import { installNodeOnWindows } from '../utils/windows-node.ts';

export type Os = 'linux' | 'windows';

// From scripts/ci/utils/executors.ts and the `win` orb (scripts/ci/utils/orbs.ts), which every task
// hashes too. On Windows as CircleCI's own Windows E2E jobs.
export const AGENT_EXECUTORS = {
  linux: { name: 'sb_node_22_browsers', class: 'large' },
  windows: { name: 'win/default', size: 'large', shell: 'bash.exe' },
} as const;

// As on the NX Cloud workers (.nx/workflows/agents.yaml).
export const agentEnvironment = (os: Os): Record<string, string> => ({
  STORYBOOK_DISABLE_TELEMETRY: 'true',
  IN_STORYBOOK_SANDBOX: 'true',
  // bench-packages.ts uploads the benchmarks for this pull request.
  BENCH_BASE_BRANCH: '<< pipeline.parameters.ghBaseBranch >>',
  BENCH_PR_NUMBER: '<< pipeline.parameters.ghPrNumber >>',
  // The sandboxes install from the global yarn cache (scripts/utils/yarn.ts), so the installs of one
  // sandbox, and of every sandbox task an agent runs after it, share their downloads.
  ...(os === 'linux' ? { STORYBOOK_NX_CLOUD_AGENT: 'true' } : {}),
  // As CircleCI's own e2e jobs on 4 vCPUs. The dev-server E2E targets also share the machine with
  // their dev server; with 4 workers their tests timed out at random, on Windows most.
  PLAYWRIGHT_WORKERS: '3',
});

const PLAYWRIGHT_CACHE: Record<Os, { key: string; path: string }> = {
  linux: {
    key: 'v1-nx-dte-playwright/{{ arch }}/{{ checksum "yarn.lock" }}',
    path: '~/.cache/ms-playwright',
  },
  windows: {
    key: 'v1-nx-dte-playwright-windows/{{ checksum "yarn.lock" }}',
    path: 'C:\\Users\\circleci\\AppData\\Local\\ms-playwright',
  },
};

const installChromium = (os: Os) => [
  cache.attach([PLAYWRIGHT_CACHE[os].key]),
  {
    run: {
      name: 'Install Chromium for Playwright',
      // The Linux image has Chrome's system libraries, so no `--with-deps`.
      command: 'yarn playwright install chromium',
    },
  },
  ...(isTrustedAuthor()
    ? [cache.persist([PLAYWRIGHT_CACHE[os].path], PLAYWRIGHT_CACHE[os].key)]
    : []),
];

// Node, Yarn and node_modules on a Windows machine, from CircleCI's Windows cache. (Linux agents
// restore node_modules with circleci-node-modules.sh, which every task hashes too.)
export const windowsInstall = () => [
  installNodeOnWindows(),
  cache.attach([NODE_MODULES_CACHE_KEY('windows')]),
  { 'node/install-packages': { 'app-dir': '.', 'pkg-manager': 'yarn', 'with-cache': false } },
  ...(isTrustedAuthor()
    ? [cache.persist(NODE_MODULES_CACHE_PATHS, NODE_MODULES_CACHE_KEY('windows'))]
    : []),
];

// The steps an agent runs after its checkout (and, on Linux, once node_modules is in place).
export const agentSetup = (os: Os) =>
  os === 'linux'
    ? [
        ...installChromium(os),
        {
          run: {
            name: 'Clear Storybook packages from the global yarn cache',
            // As NX Cloud's workers do. A fresh container starts with an empty cache, which nothing
            // saves between runs.
            command:
              'rm -f ~/.yarn/berry/cache/storybook-npm-*.zip ~/.yarn/berry/cache/@storybook-*.zip',
          },
        },
      ]
    : [
        ...windowsInstall(),
        {
          run: {
            name: 'Clone GitHub over https',
            // The checkout orb rewrites every https://github.com URL to ssh globally.
            command: [
              'git config --global --unset-all url.ssh://git@github.com.insteadOf || true',
              "git config --global --get-regexp '^url\\.' || echo 'No URL rewrites left.'",
            ].join('\n'),
          },
        },
        ...installChromium(os),
      ];

/**
 * Run `storybook init` in an empty directory against the local registry and smoke-test the result,
 * as CircleCI's init-empty jobs do (scripts/ci/init-empty.ts).
 *
 * Usage: init-empty.ts <type>, where <type> is an init-empty type such as `react-vite-ts`, or
 * `features` for `create-storybook --features docs test a11y` followed by the Vitest tests it adds.
 * The local registry must be running (`nx run scripts:run-registry`).
 */
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';

const type = process.argv[2]?.split('/').at(-1);
if (!type) {
  throw new Error('Usage: init-empty.ts <type>');
}

const features = type === 'features';
const initType = features ? 'react-vite-ts' : type;

// Outside the repository, so npm does not pick up its workspaces or configuration.
const cwd = join(mkdtempSync(join(tmpdir(), 'init-empty-')), `empty-${initType}`);
mkdirSync(cwd);

/**
 * The environment of a plain shell, as on CircleCI. This script runs under `yarn exec`, whose
 * variables (`npm_config_user_agent` above all) make `storybook init` pick Yarn instead of npm.
 */
const shellEnv = Object.fromEntries(
  Object.entries(process.env).filter(
    ([key]) => !/^(npm_|YARN_|BERRY_)/i.test(key) && !['INIT_CWD', 'PROJECT_CWD'].includes(key)
  )
);
// Yarn puts its own bin folder (`xfs-…`) on the PATH; Windows spells the variable `Path`.
for (const key of Object.keys(shellEnv).filter((key) => key.toUpperCase() === 'PATH')) {
  shellEnv[key] = (shellEnv[key] ?? '')
    .split(delimiter)
    .filter((dir) => !/[\\/]xfs-[^\\/]+$/.test(dir))
    .join(delimiter);
}

const env = {
  ...shellEnv,
  // Per process, unlike CircleCI's `npm set registry`, so no other task on the worker is affected.
  npm_config_registry: 'http://localhost:6001',
  IN_STORYBOOK_SANDBOX: 'true',
  STORYBOOK_DISABLE_TELEMETRY: 'true',
  STORYBOOK_INIT_EMPTY_TYPE: initType,
  ...(features ? {} : { STORYBOOK_CLI_SKIP_PLAYWRIGHT_INSTALLATION: 'true' }),
};

function run(command: string, args: string[]) {
  console.log(`$ ${command} ${args.join(' ')}`);
  const { status } = spawnSync(command, args, {
    cwd,
    env,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
  if (status !== 0) {
    process.exit(status ?? 1);
  }
}

if (features) {
  run('npx', [
    'create-storybook',
    '--yes',
    '--package-manager',
    'npm',
    '--features',
    'docs',
    'test',
    'a11y',
    '--loglevel=debug',
  ]);
  run('npx', ['vitest']);
} else {
  run('npx', ['storybook', 'init', '--yes', '--package-manager', 'npm']);
  run('npm', ['run', 'storybook', '--', '--smoke-test']);
}

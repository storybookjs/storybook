import { spawn, type ChildProcess } from 'node:child_process';
import { cp, mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';

import {
  assertOrdinaryReactDomShimSeed,
  assertReactDomShimRemovalContract,
  assertReactDomShimRefusalContract,
  assertSafeReactDomShimSeed,
  assertUnsafeReactDomShimSeed,
} from './react-dom-shim-contract.ts';

const fixtureNames = ['react-vite', 'nextjs', 'angular', 'react-webpack'] as const;
type FixtureName = (typeof fixtureNames)[number];

const fixtureRoot = resolve(import.meta.dirname);
const repositoryRoot = resolve(fixtureRoot, '../..');
const registryUrl = 'http://127.0.0.1:6001';
const registryPingUrl = 'http://127.0.0.1:6002/-/ping';
const nxSocketDir = process.env.NX_SOCKET_DIR ?? `/tmp/sb-nx-${process.pid}`;
const commandTimeoutMs = 20 * 60 * 1000;

const frameworkPackages: Record<FixtureName, string> = {
  'react-vite': '@storybook/react-vite',
  nextjs: '@storybook/nextjs',
  angular: '@storybook/angular',
  'react-webpack': '@storybook/react-webpack5',
};

const requestedFixture = process.argv[2];
const flags = new Set(process.argv.slice(3));
const dryRun = flags.has('--dry-run');
const keep = flags.has('--keep');
const baselineV10 = flags.has('--baseline-v10');
const baselineRemovalContract = flags.has('--baseline-removal-contract');
const baselineRefusalContract = flags.has('--baseline-refusal-contract');
const verifyReactDomShimRemoval = flags.has('--verify-react-dom-shim-removal');
const verifyReactDomShimRefusal = flags.has('--verify-react-dom-shim-refusal');

type ReactDomShimScenario =
  | { kind: 'ordinary' }
  | { kind: 'safe-removal' }
  | { kind: 'unsafe-refusal' };

function usage(): never {
  console.error(
    `Usage: node test-storybooks/upgrade-fixtures/run.ts <${fixtureNames.join('|')}|all> [--dry-run] [--keep] [--baseline-v10] [--baseline-removal-contract] [--baseline-refusal-contract] [--verify-react-dom-shim-removal] [--verify-react-dom-shim-refusal]`
  );
  process.exit(2);
}

if (!requestedFixture) {
  usage();
}

const selectedFixtures: FixtureName[] =
  requestedFixture === 'all'
    ? [...fixtureNames]
    : fixtureNames.includes(requestedFixture as FixtureName)
      ? [requestedFixture as FixtureName]
      : usage();

const reactDomShimMode =
  baselineV10 ||
  baselineRemovalContract ||
  baselineRefusalContract ||
  verifyReactDomShimRemoval ||
  verifyReactDomShimRefusal;

if (reactDomShimMode && requestedFixture !== 'react-vite') {
  usage();
}

if (
  [
    baselineV10,
    baselineRemovalContract,
    baselineRefusalContract,
    verifyReactDomShimRemoval,
    verifyReactDomShimRefusal,
  ].filter(Boolean).length > 1
) {
  usage();
}

function formatCommand(command: string, args: string[]) {
  return [command, ...args].map((part) => JSON.stringify(part)).join(' ');
}

async function run(command: string, args: string[], cwd = repositoryRoot, captureOutput = false) {
  console.log(`\n$ ${formatCommand(command, args)}`);
  console.log(`  cwd: ${cwd}`);

  if (dryRun) {
    return '';
  }

  let output = '';
  const result = await new Promise<number | null>((resolveResult, reject) => {
    let timedOut = false;
    const child = spawn(command, args, {
      cwd,
      env: {
        ...process.env,
        AI_AGENT: process.env.AI_AGENT ?? 'codex',
        CI: 'true',
        NX_SOCKET_DIR: nxSocketDir,
        STORYBOOK_DISABLE_TELEMETRY: 'true',
      },
      stdio: captureOutput ? ['inherit', 'pipe', 'pipe'] : 'inherit',
    });
    if (captureOutput) {
      child.stdout?.on('data', (data) => {
        output += data;
        process.stdout.write(data);
      });
      child.stderr?.on('data', (data) => {
        output += data;
        process.stderr.write(data);
      });
    }
    const timeout = setTimeout(async () => {
      timedOut = true;
      await stopProcess(child);
      reject(new Error(`${command} timed out after ${commandTimeoutMs / 1000} seconds`));
    }, commandTimeoutMs);

    child.once('error', (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    child.once('exit', (code) => {
      clearTimeout(timeout);
      if (!timedOut) {
        resolveResult(code);
      }
    });
  });

  if (result !== 0) {
    throw new Error(`${command} exited with code ${result}`);
  }

  return output;
}

async function waitForRegistry(registry: ChildProcess) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (registry.exitCode !== null) {
      throw new Error(`Local registry exited with code ${registry.exitCode}`);
    }

    try {
      const response = await fetch(registryPingUrl, { signal: AbortSignal.timeout(1_000) });
      if (response.ok) {
        return;
      }
    } catch {}

    await new Promise((resolveWait) => setTimeout(resolveWait, 200));
  }

  throw new Error(`Local registry did not become ready at ${registryPingUrl}`);
}

async function stopProcess(child: ChildProcess) {
  const hasExited = () => child.exitCode !== null || child.signalCode !== null;
  if (hasExited()) {
    return;
  }

  child.kill('SIGTERM');
  await Promise.race([
    new Promise<void>((resolveExit) => child.once('exit', () => resolveExit())),
    new Promise<void>((resolveWait) => setTimeout(resolveWait, 5_000)),
  ]);

  if (!hasExited()) {
    child.kill('SIGKILL');
    await new Promise<void>((resolveExit) => child.once('exit', () => resolveExit()));
  }
}

async function prepareLocalBuild() {
  await run('yarn', ['nx', 'run-many', '-t', 'compile']);
  await run('yarn', ['--cwd', 'code', 'local-registry', '--publish']);

  if (dryRun) {
    console.log(`\n$ ${formatCommand('yarn', ['--cwd', 'code', 'local-registry', '--open'])}`);
    return undefined;
  }

  console.log(`\n$ ${formatCommand('yarn', ['--cwd', 'code', 'local-registry', '--open'])}`);
  const registry = spawn('yarn', ['--cwd', 'code', 'local-registry', '--open'], {
    cwd: repositoryRoot,
    env: { ...process.env, CI: 'true' },
    stdio: 'inherit',
  });
  try {
    await waitForRegistry(registry);
  } catch (error) {
    await stopProcess(registry);
    throw error;
  }
  return registry;
}

async function readLocalVersion() {
  const packageJson = JSON.parse(await readFile(join(repositoryRoot, 'code/package.json'), 'utf8'));
  return packageJson.version as string;
}

async function assertUpgradedFixture(
  projectDir: string,
  fixture: FixtureName,
  localVersion: string
) {
  const packageNames = ['storybook', frameworkPackages[fixture], '@storybook/addon-mcp'];

  for (const packageName of packageNames) {
    const packageJsonPath = join(projectDir, 'node_modules', packageName, 'package.json');
    const packageJson = JSON.parse(await readFile(packageJsonPath, 'utf8'));

    if (packageJson.version !== localVersion) {
      throw new Error(
        `${packageName} resolved to ${packageJson.version}; expected local build ${localVersion}`
      );
    }
  }

  const mainConfigPath = join(projectDir, '.storybook/main.ts');
  const { default: mainConfig } = await import(pathToFileURL(mainConfigPath).href);
  const addons = Array.isArray(mainConfig.addons) ? mainConfig.addons : [];
  const addonNames = addons.map((addon: string | { name?: string }) =>
    typeof addon === 'string' ? addon : addon.name
  );
  if (!addonNames.includes('@storybook/addon-mcp')) {
    throw new Error('Expected the addon-mcp automigration to update .storybook/main.ts');
  }
}

function scenarioForMode(): ReactDomShimScenario {
  if (baselineRemovalContract || verifyReactDomShimRemoval) {
    return { kind: 'safe-removal' };
  }
  if (baselineRefusalContract || verifyReactDomShimRefusal) {
    return { kind: 'unsafe-refusal' };
  }
  return { kind: 'ordinary' };
}

async function applyReactDomShimScenario(projectDir: string, scenario: ReactDomShimScenario) {
  if (scenario.kind === 'ordinary') {
    await assertOrdinaryReactDomShimSeed(projectDir);
    return;
  }

  const overlayDir = join(
    fixtureRoot,
    'react-dom-shim-seeds',
    scenario.kind === 'safe-removal' ? 'safe' : 'unsafe'
  );
  await cp(overlayDir, projectDir, { recursive: true, force: true });

  if (scenario.kind === 'safe-removal') {
    await assertSafeReactDomShimSeed(projectDir);
  } else {
    await assertUnsafeReactDomShimSeed(projectDir);
  }
}

async function readUnsafeInputs(projectDir: string) {
  return {
    manifestBefore: await readFile(join(projectDir, 'packages/shim-consumer/package.json'), 'utf8'),
    sourceBefore: await readFile(join(projectDir, 'packages/shim-consumer/src/index.ts'), 'utf8'),
    configBefore: await readFile(
      join(projectDir, 'packages/dynamic-config/vitest.config.ts'),
      'utf8'
    ),
  };
}

async function verifyFixture(
  fixture: FixtureName,
  localVersion: string,
  scenario: ReactDomShimScenario = { kind: 'ordinary' }
) {
  const scenarioLabel = fixture === 'react-vite' ? `${fixture}/${scenario.kind}` : fixture;
  const workspace = await mkdtemp(
    join(tmpdir(), `storybook-upgrade-${scenarioLabel.replace('/', '-')}-`)
  );
  const projectDir = join(workspace, fixture);
  await cp(join(fixtureRoot, fixture), projectDir, { recursive: true });

  console.log(
    baselineV10 || baselineRemovalContract || baselineRefusalContract
      ? `\n=== ${scenarioLabel}: seeded Storybook 10.5.10 baseline ===`
      : `\n=== ${scenarioLabel}: v10 seed -> local Storybook ${localVersion} ===`
  );
  console.log(`Workspace: ${projectDir}`);

  try {
    if (fixture === 'react-vite') {
      await applyReactDomShimScenario(projectDir, scenario);
    }
    await run('npm', ['install', '--ignore-scripts'], projectDir);
    if (!dryRun && baselineRemovalContract) {
      await assertReactDomShimRemovalContract({
        projectDir,
        repositoryRoot,
        upgradeOutput: '',
      });
    }
    if (!dryRun && baselineRefusalContract) {
      await assertReactDomShimRefusalContract({
        projectDir,
        ...(await readUnsafeInputs(projectDir)),
        upgradeOutput: '',
      });
    }
    if (baselineV10) {
      await run('npm', ['run', 'storybook', '--', '--smoke-test', '--ci', '--no-open'], projectDir);
      console.log(`\nGREEN ${scenarioLabel}: seeded Storybook 10.5.10 baseline`);
      if (keep) {
        console.log(`Workspace preserved at ${projectDir}`);
      } else {
        await rm(workspace, { recursive: true, force: true });
      }
      return;
    }

    const unsafeInputs = verifyReactDomShimRefusal ? await readUnsafeInputs(projectDir) : undefined;
    const upgradeOutput = await run(
      'npx',
      [
        '--yes',
        `--registry=${registryUrl}`,
        `storybook@${localVersion}`,
        'upgrade',
        '--yes',
        '--force',
        '--package-manager',
        'npm',
        '--config-dir',
        '.storybook',
      ],
      projectDir,
      true
    );
    const plainUpgradeOutput = upgradeOutput.replace(/\x1B\[[0-?]*[ -\/]*[@-~]/g, '');
    if (
      /failed to upgrade|automigration(?: checks?|s)? failed|configuring .* failed/i.test(
        plainUpgradeOutput
      )
    ) {
      throw new Error('Storybook upgrade reported a dependency or automigration failure');
    }
    if (!dryRun) {
      await assertUpgradedFixture(projectDir, fixture, localVersion);
      if (verifyReactDomShimRemoval) {
        await assertReactDomShimRemovalContract({
          projectDir,
          repositoryRoot,
          upgradeOutput: plainUpgradeOutput,
        });
      }
      if (unsafeInputs) {
        await assertReactDomShimRefusalContract({
          projectDir,
          ...unsafeInputs,
          upgradeOutput: plainUpgradeOutput,
        });
      }
    }
    await run('npm', ['run', 'storybook', '--', '--smoke-test', '--ci', '--no-open'], projectDir);
    console.log(dryRun ? `\nPLANNED ${scenarioLabel}` : `\nGREEN ${scenarioLabel}`);
  } catch (error) {
    console.error(`\nRED ${scenarioLabel}`);
    console.error(`Failed workspace preserved at ${projectDir}`);
    console.error(error);
    throw error;
  }

  if (keep || dryRun) {
    console.log(`Workspace preserved at ${projectDir}`);
  } else {
    await rm(workspace, { recursive: true, force: true });
  }
}

let registry: ChildProcess | undefined;

try {
  const localVersion = await readLocalVersion();
  if (!baselineV10 && !baselineRemovalContract && !baselineRefusalContract) {
    registry = await prepareLocalBuild();
  }
  let failedFixtures = 0;
  let fixtureRuns = 0;

  for (const fixture of selectedFixtures) {
    const scenarios: ReactDomShimScenario[] =
      fixture === 'react-vite' && baselineV10
        ? [{ kind: 'ordinary' }, { kind: 'safe-removal' }, { kind: 'unsafe-refusal' }]
        : [fixture === 'react-vite' ? scenarioForMode() : { kind: 'ordinary' }];

    for (const scenario of scenarios) {
      fixtureRuns += 1;
      try {
        await verifyFixture(fixture, localVersion, scenario);
      } catch {
        failedFixtures += 1;
      }
    }
  }

  if (failedFixtures > 0) {
    throw new Error(`${failedFixtures}/${fixtureRuns} upgrade fixture(s) failed`);
  }

  console.log(
    dryRun
      ? `\nPLANNED ${fixtureRuns} upgrade fixture(s)`
      : `\nGREEN ${fixtureRuns}/${fixtureRuns} upgrade fixture(s)`
  );
} catch (error) {
  console.error(`\nRED upgrade fixture harness`);
  console.error(error);
  process.exitCode = 1;
} finally {
  if (registry) {
    await stopProcess(registry);
  }
}

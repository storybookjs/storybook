import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { stripVTControlCharacters } from 'node:util';

import { afterEach, beforeEach, expect, it, vi } from 'vitest';

import {
  JsPackageManagerFactory,
  PackageManagerName,
  effects,
  invalidateProjectRootCache,
  versions,
} from 'storybook/internal/common';
import { logger, prompt } from 'storybook/internal/node-logger';

import { join, relative } from 'pathe';

import { executeCommand, executeCommandSync } from '../../../core/src/common/utils/command.ts';
import { runAutomigrations } from './automigrate/multi-project.ts';
import { runMultiProjectDoctor } from './doctor/index.ts';
import { upgrade } from './upgrade.ts';
import { type CollectProjectsSuccessResult, getProjects } from './util.ts';

vi.mock('../../../core/src/common/utils/command.ts', { spy: true });
vi.mock('storybook/internal/node-logger', { spy: true });
vi.mock('storybook/internal/telemetry');
vi.mock('./automigrate/multi-project.ts', { spy: true });
vi.mock('./doctor/index.ts', { spy: true });
vi.mock('./util.ts', { spy: true });

let root: string;

const files = () =>
  Object.fromEntries(
    readdirSync(root, { recursive: true, withFileTypes: true })
      .filter((entry) => entry.isFile())
      .map((entry) => join(entry.parentPath, entry.name))
      .map((path) => [relative(root, path), readFileSync(path, 'utf8')])
  );

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'storybook-upgrade-dry-run-'));
  mkdirSync(join(root, '.storybook'));
  writeFileSync(join(root, '.storybook/main.js'), 'export default {};\n');
  writeFileSync(
    join(root, 'package.json'),
    `${JSON.stringify(
      {
        name: 'app',
        private: true,
        workspaces: ['packages/*'],
        devDependencies: { storybook: '10.3.0', '@storybook/react-vite': '10.3.0' },
      },
      null,
      2
    )}\n`
  );
  writeFileSync(
    join(root, 'skills-lock.json'),
    JSON.stringify({ version: 1, skills: { storybook: { source: 'storybookjs/skills' } } })
  );
  vi.stubEnv('STORYBOOK_PROJECT_ROOT', root);
  invalidateProjectRootCache();

  vi.mocked(executeCommand).mockResolvedValue({ stdout: '' } as never);
  vi.mocked(executeCommandSync).mockReturnValue('10.0.0');
  for (const method of ['info', 'step', 'log', 'warn', 'debug'] as const) {
    vi.mocked(logger[method]).mockImplementation(() => {});
  }
  vi.mocked(prompt.taskLog).mockReturnValue({
    message: vi.fn(),
    success: vi.fn(),
    error: vi.fn(),
  } as unknown as ReturnType<typeof prompt.taskLog>);

  const packageManager = JsPackageManagerFactory.getPackageManager(
    { force: PackageManagerName.PNPM, ignoreCache: true },
    root
  );
  // The monorepo check searches up from the working directory of the process.
  vi.spyOn(packageManager, 'isStorybookInMonorepo').mockReturnValue(true);
  const project = {
    configDir: join(root, '.storybook'),
    mainConfigPath: join(root, '.storybook/main.js'),
    mainConfig: {},
    beforeVersion: '10.3.0',
    currentCLIVersion: versions.storybook,
    isCanary: false,
    isCLIOutdated: false,
    isCLIPrerelease: false,
    isCLIExactLatest: true,
    isCLIExactPrerelease: false,
    autoblockerCheckResults: null,
    packageManager,
  } as unknown as CollectProjectsSuccessResult;
  vi.mocked(getProjects).mockResolvedValue({
    allProjects: [project],
    selectedProjects: [project],
    unreadProjects: 0,
  });
  vi.mocked(runAutomigrations).mockResolvedValue({
    automigrationResults: {},
    detectedAutomigrations: [],
  });

  effects.setDryRun(true);
});

afterEach(() => {
  effects.setDryRun(false);
  vi.unstubAllEnvs();
  invalidateProjectRootCache();
  rmSync(root, { recursive: true, force: true });
});

it('changes the project only through effects, and lists every change a run would make', async () => {
  const before = files();

  await upgrade({ skipCheck: true, yes: true, force: false, disableTelemetry: true });

  const commands = vi
    .mocked(executeCommand)
    .mock.calls.map(([{ command, args = [] }]) => [command, ...args].join(' '));
  expect(
    commands.filter((command) => /\b(install|add|dedupe|remove|set|dlx)\b/.test(command))
  ).toEqual([]);
  expect(runMultiProjectDoctor).not.toHaveBeenCalled();
  expect(files()).toEqual(before);

  const changes = effects.describeDryRunChanges().map((line) => stripVTControlCharacters(line));
  expect(changes).toEqual([
    'update package.json',
    expect.stringMatching(/^↳ devDependencies\.storybook: 10\.3\.0 → \^?\d+\.\d+\.\d+/),
    expect.stringMatching(
      /^↳ devDependencies\.@storybook\/react-vite: 10\.3\.0 → \^?\d+\.\d+\.\d+/
    ),
    'run pnpm install',
    'run pnpm dedupe',
    expect.stringMatching(/^run pnpm dlx skills@latest add storybookjs\/skills#v/),
    'run pnpm exec storybook doctor to verify the upgrade went well',
  ]);
});

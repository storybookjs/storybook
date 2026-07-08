import { beforeEach, describe, expect, it, vi } from 'vitest';

import { readFile, writeFile } from 'node:fs/promises';

import { logger, prompt } from 'storybook/internal/node-logger';
import { telemetry } from 'storybook/internal/telemetry';

import * as memfs from 'memfs';
import { vol } from 'memfs';

import { runExperimentalFlagsHighlightStep } from './experimentalFlags.ts';
import type { CollectProjectsSuccessResult } from './util.ts';

vi.mock('storybook/internal/node-logger', { spy: true });
vi.mock('storybook/internal/telemetry', { spy: true });

// Spy-only mock: keep the real `node:fs/promises` module shape, then redirect the calls used by
// csf-tools' readConfig/writeConfigFile to `memfs` so disk state stays scoped to `vol`.
vi.mock('node:fs/promises', { spy: true });

const MAIN_CONFIG_PATH = '/project/.storybook/main.ts';

// Realistic generated main.ts shape, as produced by `storybook init`.
const FIXTURE_MAIN_TS = `import type { StorybookConfig } from '@storybook/react-vite';

const config: StorybookConfig = {
  stories: ['../src/**/*.mdx', '../src/**/*.stories.@(js|jsx|mjs|ts|tsx)'],
  addons: ['@storybook/addon-docs'],
  framework: {
    name: '@storybook/react-vite',
    options: {},
  },
};
export default config;
`;

const createMockProject = (overrides: Partial<CollectProjectsSuccessResult> = {}) =>
  ({
    configDir: '/project/.storybook',
    mainConfigPath: MAIN_CONFIG_PATH,
    mainConfig: {} as any,
    beforeVersion: '10.4.0',
    currentCLIVersion: '10.5.0',
    packageManager: {} as any,
    ...overrides,
  }) as CollectProjectsSuccessResult;

const readMainConfig = () => memfs.fs.readFileSync(MAIN_CONFIG_PATH, 'utf-8') as string;

describe('experimentalFlags integration (real csf-tools read/write on memfs)', () => {
  beforeEach(() => {
    vol.reset();
    vi.mocked(readFile).mockImplementation(
      memfs.fs.promises.readFile as unknown as typeof readFile
    );
    vi.mocked(writeFile).mockImplementation(
      memfs.fs.promises.writeFile as unknown as typeof writeFile
    );
    // Spy mocks call through to the real implementations unless stubbed; keep prompts, logs, and
    // telemetry inert.
    vi.mocked(prompt.multiselect).mockResolvedValue([]);
    vi.mocked(telemetry).mockResolvedValue(undefined);
    vi.mocked(logger.log).mockImplementation(() => {});
    vi.mocked(logger.warn).mockImplementation(() => {});
    vi.mocked(logger.error).mockImplementation(() => {});
    vi.mocked(logger.debug).mockImplementation(() => {});
  });

  it('writes the requested flag to disk while preserving the rest of the file', async () => {
    vol.fromJSON({ [MAIN_CONFIG_PATH]: FIXTURE_MAIN_TS });
    const project = createMockProject({ mainConfig: {} as any });

    await runExperimentalFlagsHighlightStep([project], {
      features: 'experimentalReview',
      yes: false,
      dryRun: false,
    });

    const written = readMainConfig();

    expect(written).toMatch(/features:\s*{\s*experimentalReview:\s*true/);

    // The untouched parts of the file must survive character-identical.
    expect(written).toContain(`import type { StorybookConfig } from '@storybook/react-vite';`);
    expect(written).toContain(
      `stories: ['../src/**/*.mdx', '../src/**/*.stories.@(js|jsx|mjs|ts|tsx)'],`
    );
    expect(written).toContain(`addons: ['@storybook/addon-docs'],`);
    expect(written).toContain(`framework: {`);
    expect(written).toContain(`name: '@storybook/react-vite',`);
    expect(written).toContain(`options: {},`);
    expect(written).toContain('export default config;');
  });

  it('leaves the file byte-identical when the requested flag is already explicitly set to false', async () => {
    const fixtureWithFlagSet = FIXTURE_MAIN_TS.replace(
      '};\nexport default config;',
      '  features: { experimentalReview: false },\n};\nexport default config;'
    );
    vol.fromJSON({ [MAIN_CONFIG_PATH]: fixtureWithFlagSet });
    const project = createMockProject({
      mainConfig: { features: { experimentalReview: false } } as any,
    });

    // Only requesting the flag that is already set, so nothing should be pending.
    await runExperimentalFlagsHighlightStep([project], {
      features: 'experimentalReview',
      yes: false,
      dryRun: false,
    });

    expect(readMainConfig()).toBe(fixtureWithFlagSet);
  });

  it('is idempotent: a second run with the same already-applied flag does not rewrite the file', async () => {
    vol.fromJSON({ [MAIN_CONFIG_PATH]: FIXTURE_MAIN_TS });
    const project = createMockProject({ mainConfig: {} as any });
    const options = { features: 'experimentalDocgenServer', yes: false, dryRun: false };

    await runExperimentalFlagsHighlightStep([project], options);
    const afterFirstRun = readMainConfig();
    expect(afterFirstRun).toMatch(/features:\s*{\s*experimentalDocgenServer:\s*true/);

    await runExperimentalFlagsHighlightStep([project], options);
    const afterSecondRun = readMainConfig();

    expect(afterSecondRun).toBe(afterFirstRun);
  });

  it('writes the interactively selected flag to disk and sends prompt-source telemetry', async () => {
    vol.fromJSON({ [MAIN_CONFIG_PATH]: FIXTURE_MAIN_TS });
    vi.mocked(prompt.multiselect).mockResolvedValue(['experimentalDocgenServer']);
    const project = createMockProject({
      beforeVersion: '10.4.0',
      currentCLIVersion: '10.5.0',
      mainConfig: {} as any,
    });

    await runExperimentalFlagsHighlightStep([project], {
      features: undefined,
      yes: false,
      dryRun: false,
    });

    expect(readMainConfig()).toMatch(/features:\s*{\s*experimentalDocgenServer:\s*true/);
    expect(telemetry).toHaveBeenCalledWith('upgrade-experimental-flags', {
      flags: ['experimentalDocgenServer'],
      source: 'prompt',
    });
  });
});

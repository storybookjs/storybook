import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { prompt } from 'storybook/internal/node-logger';
import { telemetry } from 'storybook/internal/telemetry';

import { runExperimentalFlagsHighlightStep } from './experimentalFlags.ts';
import type { CollectProjectsSuccessResult } from './util.ts';

vi.mock('storybook/internal/node-logger', async (importOriginal) => {
  return {
    ...(await importOriginal<typeof import('storybook/internal/node-logger')>()),
    prompt: { multiselect: vi.fn() },
    logger: { log: vi.fn(), debug: vi.fn(), error: vi.fn(), warn: vi.fn() },
  };
});

vi.mock('storybook/internal/telemetry');

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

const createMockProject = (
  mainConfigPath: string,
  overrides: Partial<CollectProjectsSuccessResult> = {}
) =>
  ({
    configDir: path.dirname(mainConfigPath),
    mainConfigPath,
    mainConfig: {} as any,
    beforeVersion: '10.4.0',
    currentCLIVersion: '10.5.0',
    packageManager: {} as any,
    ...overrides,
  }) as CollectProjectsSuccessResult;

describe('experimentalFlags integration (real csf-tools read/write)', () => {
  let tmpDir: string;
  let mainConfigPath: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sb-experimental-flags-'));
    mainConfigPath = path.join(tmpDir, 'main.ts');
    vi.mocked(prompt.multiselect).mockResolvedValue([]);
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('writes the requested flag to disk while preserving the rest of the file', async () => {
    fs.writeFileSync(mainConfigPath, FIXTURE_MAIN_TS);
    const project = createMockProject(mainConfigPath, { mainConfig: {} as any });

    await runExperimentalFlagsHighlightStep([project], {
      features: 'experimentalReview',
      yes: false,
      dryRun: false,
    });

    const written = fs.readFileSync(mainConfigPath, 'utf-8');

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
    fs.writeFileSync(mainConfigPath, fixtureWithFlagSet);
    const before = fs.readFileSync(mainConfigPath, 'utf-8');
    const project = createMockProject(mainConfigPath, {
      mainConfig: { features: { experimentalReview: false } } as any,
    });

    // Only requesting the flag that is already set, so nothing should be pending.
    await runExperimentalFlagsHighlightStep([project], {
      features: 'experimentalReview',
      yes: false,
      dryRun: false,
    });

    const after = fs.readFileSync(mainConfigPath, 'utf-8');
    expect(after).toBe(before);
  });

  it('is idempotent: a second run with the same already-applied flag does not rewrite the file', async () => {
    fs.writeFileSync(mainConfigPath, FIXTURE_MAIN_TS);
    const project = createMockProject(mainConfigPath, { mainConfig: {} as any });
    const options = { features: 'experimentalDocgenServer', yes: false, dryRun: false };

    await runExperimentalFlagsHighlightStep([project], options);
    const afterFirstRun = fs.readFileSync(mainConfigPath, 'utf-8');
    expect(afterFirstRun).toMatch(/features:\s*{\s*experimentalDocgenServer:\s*true/);

    await runExperimentalFlagsHighlightStep([project], options);
    const afterSecondRun = fs.readFileSync(mainConfigPath, 'utf-8');

    expect(afterSecondRun).toBe(afterFirstRun);
  });

  it('writes the interactively selected flag to disk and sends prompt-source telemetry', async () => {
    fs.writeFileSync(mainConfigPath, FIXTURE_MAIN_TS);
    vi.mocked(prompt.multiselect).mockResolvedValue(['experimentalDocgenServer']);
    const project = createMockProject(mainConfigPath, {
      beforeVersion: '10.4.0',
      currentCLIVersion: '10.5.0',
      mainConfig: {} as any,
    });

    await runExperimentalFlagsHighlightStep([project], {
      features: undefined,
      yes: false,
      dryRun: false,
    });

    const written = fs.readFileSync(mainConfigPath, 'utf-8');
    expect(written).toMatch(/features:\s*{\s*experimentalDocgenServer:\s*true/);
    expect(telemetry).toHaveBeenCalledWith('upgrade-experimental-flags', {
      flags: ['experimentalDocgenServer'],
      source: 'prompt',
    });
  });
});

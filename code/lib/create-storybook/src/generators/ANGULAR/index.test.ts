import * as fs from 'node:fs';
import { join, resolve } from 'node:path';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AngularJSON, copyTemplate } from 'storybook/internal/cli';
import { SupportedBuilder } from 'storybook/internal/types';

import { fs as memfs, vol } from 'memfs';

import angularGenerator from './index.ts';

vi.mock('node:fs', { spy: true });
vi.mock('storybook/internal/cli', { spy: true });

const packageManager = {
  getDependencyVersion: vi.fn(() => '^21.0.0'),
  addScripts: vi.fn(),
};

const root = resolve('/project');

const angularJson = {
  projects: { app: {} },
  projectsWithoutStorybook: ['app'],
  getProjectName: vi.fn(async () => 'app'),
  getProjectSettingsByName: vi.fn(() => ({ root, projectType: 'application' })),
  addStorybookEntries: vi.fn(),
  write: vi.fn(),
};

const configureWith = (builder: SupportedBuilder) =>
  angularGenerator.configure(
    packageManager as any,
    {
      builder,
      yes: true,
      telemetryService: { trackPromptCancel: vi.fn() },
    } as any
  );

beforeEach(() => {
  vi.clearAllMocks();
  vol.reset();
  vi.mocked(fs.readdirSync).mockImplementation(memfs.readdirSync as never);
  vi.mocked(fs.rmSync).mockImplementation(memfs.rmSync as never);
  vi.mocked(copyTemplate).mockImplementation((_templateDir, destination = '.') => {
    vol.fromNestedJSON({
      [join(destination, '.storybook', 'tsconfig.doc.json')]: '',
      [join(destination, '.storybook', 'tsconfig.json')]: '',
      [join(destination, '.storybook', 'typings.d.ts')]: '',
    });
  });
  vi.mocked(AngularJSON).mockImplementation(function () {
    return angularJson as any;
  } as any);
});

describe('the Angular generator .storybook folder', () => {
  it('omits the Compodoc-only tsconfig when Compodoc will not run', async () => {
    await configureWith(SupportedBuilder.VITE);

    expect(fs.readdirSync(join(root, '.storybook')).sort()).toEqual([
      'tsconfig.json',
      'typings.d.ts',
    ]);
  });

  it('keeps the Compodoc-only tsconfig on the webpack Compodoc path', async () => {
    await configureWith(SupportedBuilder.WEBPACK5);

    expect(fs.readdirSync(join(root, '.storybook')).sort()).toEqual([
      'tsconfig.doc.json',
      'tsconfig.json',
      'typings.d.ts',
    ]);
  });
});

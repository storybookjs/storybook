import { mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AngularJSON } from 'storybook/internal/cli';
import { SupportedBuilder } from 'storybook/internal/types';

import angularGenerator from './index.ts';

// `copyTemplate` shells out to `cpSync`, which memfs does not implement, so this suite copies the
// real template files into a real temporary directory.
vi.mock('storybook/internal/cli', { spy: true });

const packageManager = {
  getDependencyVersion: vi.fn(() => '^21.0.0'),
  addScripts: vi.fn(),
};

let root: string;

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
  root = mkdtempSync(join(tmpdir(), 'sb-angular-init-'));
  vi.mocked(AngularJSON).mockImplementation(function () {
    return angularJson as any;
  } as any);
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

describe('the Angular generator .storybook folder', () => {
  it('omits the Compodoc-only tsconfig when Compodoc will not run', async () => {
    await configureWith(SupportedBuilder.VITE);

    expect(readdirSync(join(root, '.storybook')).sort()).toEqual(['tsconfig.json', 'typings.d.ts']);
  });

  it('keeps the Compodoc-only tsconfig on the webpack Compodoc path', async () => {
    await configureWith(SupportedBuilder.WEBPACK5);

    expect(readdirSync(join(root, '.storybook')).sort()).toEqual([
      'tsconfig.doc.json',
      'tsconfig.json',
      'typings.d.ts',
    ]);
  });
});

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { prompt } from 'storybook/internal/node-logger';
import { SupportedBuilder } from 'storybook/internal/types';

import angularGenerator from './index.ts';

const write = vi.fn();
const addStorybookEntries = vi.fn();

vi.mock('storybook/internal/cli', () => ({
  ProjectType: { ANGULAR: 'ANGULAR' },
  copyTemplate: vi.fn(),
  AngularJSON: class {
    projects = { app: { root: '', projectType: 'application', architect: {} } };
    projectsWithoutStorybook = ['app'];
    getProjectName = async () => 'app';
    getProjectSettingsByName = () => ({ root: '', projectType: 'application' });
    addStorybookEntries = addStorybookEntries;
    write = write;
  },
}));

vi.mock('storybook/internal/node-logger', () => ({
  logger: { log: vi.fn(), info: vi.fn() },
  prompt: { confirm: vi.fn(), select: vi.fn() },
}));

const packageManager = {
  getDependencyVersion: () => '^22.0.0',
  addScripts: vi.fn(),
} as never;

const configure = (builder: SupportedBuilder) =>
  angularGenerator.configure(packageManager, { builder, yes: false } as never);

beforeEach(() => {
  vi.mocked(prompt.confirm).mockResolvedValue(true);
});

describe('Angular generator, Vite builder', () => {
  it('never asks about Compodoc', async () => {
    await configure(SupportedBuilder.VITE);

    expect(prompt.confirm).not.toHaveBeenCalled();
  });

  it('does not install Compodoc', async () => {
    const result = await configure(SupportedBuilder.VITE);

    expect(result.extraPackages).not.toContain('@compodoc/compodoc');
  });

  it('writes no setCompodocJson wiring into the preview', async () => {
    const result = await configure(SupportedBuilder.VITE);

    expect(result.frameworkPreviewParts).toBeUndefined();
  });

  it('writes no `compodoc` framework option, which would read as "no Angular docgen"', async () => {
    const result = await configure(SupportedBuilder.VITE);

    expect(result).not.toHaveProperty('frameworkOptions');
  });
});

describe('Angular generator, Webpack builder', () => {
  it('keeps the documented Compodoc setup when the user says yes', async () => {
    const result = await configure(SupportedBuilder.WEBPACK5);

    expect(prompt.confirm).toHaveBeenCalled();
    expect(result.extraPackages).toContain('@compodoc/compodoc');
    expect(result.frameworkPreviewParts?.prefix).toContain('setCompodocJson');
  });

  it('skips the Compodoc setup when the user says no', async () => {
    vi.mocked(prompt.confirm).mockResolvedValue(false);

    const result = await configure(SupportedBuilder.WEBPACK5);

    expect(result.extraPackages).not.toContain('@compodoc/compodoc');
    expect(result.frameworkPreviewParts).toBeUndefined();
  });
});

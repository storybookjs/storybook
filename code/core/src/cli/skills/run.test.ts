import { describe, expect, it, vi } from 'vitest';

import { resolveStorybookConfigDir } from '../tools/config-dir.ts';
import { resolveSkillsIntent, runSkillsCommand } from './run.ts';

const deps = () => ({
  loadStorybook: vi.fn().mockResolvedValue({ presets: { apply: vi.fn() } }),
  resolveSkillInputs: vi.fn().mockResolvedValue({
    framework: '@storybook/react-vite',
    renderer: '@storybook/react',
    changeDetectionEnabled: true,
    moduleGraphSupported: true,
    reviewEnabled: false,
    reviewEnabledForCli: true,
    docsEnabled: false,
    docsEnabledForCli: false,
    docsHasManifests: false,
    docsFeatureEnabled: false,
    testSupported: true,
    a11yEnabled: false,
    docgenServer: false,
  }),
  getProjectInfo: vi.fn().mockResolvedValue({ ok: true, projectInfo: {} }),
  getSetupMarkdown: vi
    .fn()
    .mockResolvedValue({ markdown: '# Storybook Setup', prompt: 'optimized-tests' }),
});

describe('resolveSkillsIntent', () => {
  it('treats no args as the catalog', () => {
    expect(resolveSkillsIntent({ tokens: [] })).toEqual({ kind: 'catalog' });
    expect(resolveSkillsIntent({ tokens: [], help: true })).toEqual({ kind: 'catalog' });
  });

  it('prints a skill by id', () => {
    expect(resolveSkillsIntent({ tokens: ['stories'] })).toEqual({ kind: 'get', id: 'stories' });
    expect(resolveSkillsIntent({ tokens: ['setup'] })).toEqual({ kind: 'get', id: 'setup' });
  });

  it('prints every skill on --all, unless help is also set', () => {
    expect(resolveSkillsIntent({ tokens: [], all: true })).toEqual({ kind: 'all' });
    expect(resolveSkillsIntent({ tokens: [], all: true, help: true })).toEqual({ kind: 'catalog' });
  });

  it('treats help as the catalog even after a skill id', () => {
    expect(resolveSkillsIntent({ tokens: ['write-story'], help: true })).toEqual({
      kind: 'catalog',
    });
  });

  it('rejects `help`, `list`, and `get` as unknown skills, naming the valid ids', () => {
    for (const first of ['help', 'list', 'get']) {
      expect(resolveSkillsIntent({ tokens: [first, 'stories'] })).toEqual({
        kind: 'error',
        message: `Unknown skill "${first}". Available skills: stories, write-story, setup.`,
      });
    }
  });

  it('rejects surplus positional arguments and an id combined with --all', () => {
    expect(resolveSkillsIntent({ tokens: ['stories', 'typo'] })).toEqual({
      kind: 'error',
      message: expect.stringContaining('Unexpected arguments: "typo"'),
    });
    expect(resolveSkillsIntent({ tokens: ['stories'], all: true })).toEqual({
      kind: 'error',
      message: expect.stringContaining('takes no skill id'),
    });
  });
});

describe('runSkillsCommand', () => {
  it('lists all skills with their blurbs, without loading config', async () => {
    const d = deps();
    const result = await runSkillsCommand({ tokens: [], target: {} }, d);
    expect(result.exitCode).toBe(0);
    expect(result.output).toContain('Usage: npx storybook skills [options] [id]');
    expect(result.output).toContain('stories');
    expect(result.output).toContain('write-story');
    expect(result.output).toContain('setup');
    expect(d.loadStorybook).not.toHaveBeenCalled();
  });

  it('stories assembles CLI-transport server instructions using the CLI review gate', async () => {
    const d = deps();
    const result = await runSkillsCommand({ tokens: ['stories'], target: {} }, d);
    expect(result.exitCode).toBe(0);
    expect(result.output).toContain('npx storybook tools');
    expect(result.output).not.toContain('stories-preview** ');
  });

  it('serves the docs workflow on the CLI gate even when the MCP docs gate is off', async () => {
    const d = deps();
    d.resolveSkillInputs.mockResolvedValue({
      ...(await d.resolveSkillInputs()),
      docsEnabled: false,
      docsEnabledForCli: true,
    });

    const stories = await runSkillsCommand({ tokens: ['stories'], target: {} }, d);
    expect(stories.output).toContain('Documentation Workflow');

    const writeStory = await runSkillsCommand({ tokens: ['write-story'], target: {} }, d);
    expect(writeStory.output).toContain('npx storybook tools docs list');
  });

  it('omits the docs workflow when the CLI docs gate is off', async () => {
    const d = deps();
    const stories = await runSkillsCommand({ tokens: ['stories'], target: {} }, d);
    expect(stories.output).not.toContain('Documentation Workflow');
  });

  it('write-story assembles CLI-transport story instructions', async () => {
    const d = deps();
    const result = await runSkillsCommand({ tokens: ['write-story'], target: {} }, d);
    expect(result.exitCode).toBe(0);
    expect(result.output).toContain('@storybook/react');
    expect(result.output).toContain('npx storybook tools stories changed');
  });

  it('setup emits the setup markdown from the lightweight probe, without loading config', async () => {
    const d = deps();
    const result = await runSkillsCommand({ tokens: ['setup'], target: {} }, d);
    expect(result.exitCode).toBe(0);
    expect(result.output).toBe('# Storybook Setup');
    expect(d.loadStorybook).not.toHaveBeenCalled();
  });

  it('setup reports the probe failure message and exits nonzero', async () => {
    const d = deps();
    d.getProjectInfo.mockResolvedValue({ ok: false, message: 'Could not detect framework' });
    const result = await runSkillsCommand({ tokens: ['setup'], target: {} }, d);
    expect(result.exitCode).toBe(1);
    expect(result.errorOutput).toContain('Could not detect framework');
  });

  it('setup resolves configDir against the given cwd before probing, not process.cwd()', async () => {
    const d = deps();
    const target = { cwd: '/some/other/project', configDir: 'custom-storybook' };
    await runSkillsCommand({ tokens: ['setup'], target }, d);
    expect(d.getProjectInfo).toHaveBeenCalledWith({
      configDir: resolveStorybookConfigDir(target),
    });
  });

  it('reports a clean one-line message when loading the target Storybook fails, no stack trace', async () => {
    const d = deps();
    d.loadStorybook.mockRejectedValue(new Error('Cannot find module .storybook/main.ts'));
    const result = await runSkillsCommand({ tokens: ['stories'], target: {} }, d);
    expect(result.exitCode).toBe(1);
    expect(result.errorOutput).toBe(
      'Could not load the Storybook configuration for this project: Cannot find module .storybook/main.ts'
    );
  });

  it('unknown id exits nonzero and names the valid ids', async () => {
    const result = await runSkillsCommand({ tokens: ['nope'], target: {} }, deps());
    expect(result.exitCode).toBe(1);
    expect(result.errorOutput).toContain('stories');
    expect(result.errorOutput).toContain('write-story');
    expect(result.errorOutput).toContain('setup');
  });

  it('--all prints every skill in full, loading the configuration once', async () => {
    const d = deps();
    const result = await runSkillsCommand({ tokens: [], all: true, target: {} }, d);
    expect(result.exitCode).toBe(0);
    expect(result.skill).toBe('all');
    expect(result.output).toContain('# Storybook Setup');
    expect(result.output).toContain('npx storybook tools stories changed');
    expect(result.output).toContain('@storybook/react');
    expect(d.loadStorybook).toHaveBeenCalledTimes(1);
    expect(d.getProjectInfo).toHaveBeenCalledTimes(1);
  });

  it('--all fails as a whole when the configuration cannot be loaded', async () => {
    const d = deps();
    d.loadStorybook.mockRejectedValue(new Error('Cannot find module .storybook/main.ts'));
    const result = await runSkillsCommand({ tokens: [], all: true, target: {} }, d);
    expect(result.exitCode).toBe(1);
    expect(result.output).toBe('');
    expect(result.errorOutput).toContain('Cannot find module .storybook/main.ts');
  });
});

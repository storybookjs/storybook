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
  it('treats no args and `list` as the catalog', () => {
    expect(resolveSkillsIntent([])).toEqual({ kind: 'catalog' });
    expect(resolveSkillsIntent(['list'])).toEqual({ kind: 'catalog' });
  });

  it('prints a skill by id, including the `get <id>` spelling', () => {
    expect(resolveSkillsIntent(['stories'])).toEqual({ kind: 'get', id: 'stories' });
    expect(resolveSkillsIntent(['get', 'setup'])).toEqual({ kind: 'get', id: 'setup' });
  });

  it('describes a skill when help is set', () => {
    expect(resolveSkillsIntent(['write-story'], true)).toEqual({
      kind: 'skill-help',
      id: 'write-story',
    });
    expect(resolveSkillsIntent(['get', 'write-story'], true)).toEqual({
      kind: 'skill-help',
      id: 'write-story',
    });
  });

  it('does not treat `help` as a subcommand', () => {
    expect(resolveSkillsIntent(['help', 'stories'])).toEqual({ kind: 'unknown', id: 'help' });
  });

  it('rejects surplus positional arguments', () => {
    expect(resolveSkillsIntent(['stories', 'typo'])).toEqual({
      kind: 'invalid',
      tokens: ['stories', 'typo'],
    });
    expect(resolveSkillsIntent(['get', 'stories', 'typo'])).toEqual({
      kind: 'invalid',
      tokens: ['get', 'stories', 'typo'],
    });
  });
});

describe('runSkillsCommand', () => {
  it('lists all skills with their blurbs, without loading config', async () => {
    const d = deps();
    const result = await runSkillsCommand({ tokens: [], target: {} }, d);
    expect(result.exitCode).toBe(0);
    expect(result.kind).toBe('help');
    expect(result.output).toContain('Usage: npx storybook skills [options] [id]');
    expect(result.output).toContain('stories');
    expect(result.output).toContain('write-story');
    expect(result.output).toContain('setup');
    expect(d.loadStorybook).not.toHaveBeenCalled();
  });

  it('describes one skill on `--help` without loading config', async () => {
    const d = deps();
    const result = await runSkillsCommand({ tokens: ['write-story'], help: true, target: {} }, d);
    expect(result.exitCode).toBe(0);
    expect(result.kind).toBe('help');
    expect(result.output).toContain('Usage: npx storybook skills write-story [options]');
    expect(result.output).toContain('Prints the full instructions as markdown.');
    expect(d.loadStorybook).not.toHaveBeenCalled();
  });

  it('get stories assembles CLI-transport server instructions using the CLI review gate', async () => {
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

  it('get write-story assembles CLI-transport story instructions', async () => {
    const d = deps();
    const result = await runSkillsCommand({ tokens: ['get', 'write-story'], target: {} }, d);
    expect(result.exitCode).toBe(0);
    expect(result.output).toContain('@storybook/react');
    expect(result.output).toContain('npx storybook tools stories changed');
  });

  it('get setup emits the setup markdown from the lightweight probe, without loading config', async () => {
    const d = deps();
    const result = await runSkillsCommand({ tokens: ['setup'], target: {} }, d);
    expect(result.exitCode).toBe(0);
    expect(result.output).toBe('# Storybook Setup');
    expect(d.loadStorybook).not.toHaveBeenCalled();
  });

  it('get setup reports the probe failure message and exits nonzero', async () => {
    const d = deps();
    d.getProjectInfo.mockResolvedValue({ ok: false, message: 'Could not detect framework' });
    const result = await runSkillsCommand({ tokens: ['setup'], target: {} }, d);
    expect(result.exitCode).toBe(1);
    expect(result.errorOutput).toContain('Could not detect framework');
  });

  it('get setup resolves configDir against the given cwd before probing, not process.cwd()', async () => {
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

  it('`get` without an id behaves like unknown id', async () => {
    const result = await runSkillsCommand({ tokens: ['get'], target: {} }, deps());
    expect(result.exitCode).toBe(1);
  });
});

import { describe, expect, it, vi } from 'vitest';

import { resolveStorybookConfigDir } from '../tools/config-dir.ts';
import { runSkillsCommand } from './run.ts';

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

describe('runSkillsCommand', () => {
  it('lists all skills with their blurbs, without loading config', async () => {
    const d = deps();
    const result = await runSkillsCommand({ subcommand: 'list', target: {} }, d);
    expect(result.exitCode).toBe(0);
    expect(result.output).toContain('stories');
    expect(result.output).toContain('write-story');
    expect(result.output).toContain('setup');
    expect(d.loadStorybook).not.toHaveBeenCalled();
  });

  it('get stories assembles CLI-transport server instructions using the CLI review gate', async () => {
    const d = deps();
    const result = await runSkillsCommand({ subcommand: 'get', id: 'stories', target: {} }, d);
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

    const stories = await runSkillsCommand({ subcommand: 'get', id: 'stories', target: {} }, d);
    expect(stories.output).toContain('Documentation Workflow');

    const writeStory = await runSkillsCommand(
      { subcommand: 'get', id: 'write-story', target: {} },
      d
    );
    expect(writeStory.output).toContain('npx storybook tools docs list');
  });

  it('omits the docs workflow when the CLI docs gate is off', async () => {
    const d = deps();
    const stories = await runSkillsCommand({ subcommand: 'get', id: 'stories', target: {} }, d);
    expect(stories.output).not.toContain('Documentation Workflow');
  });

  it('get write-story assembles CLI-transport story instructions', async () => {
    const d = deps();
    const result = await runSkillsCommand({ subcommand: 'get', id: 'write-story', target: {} }, d);
    expect(result.exitCode).toBe(0);
    expect(result.output).toContain('@storybook/react');
    expect(result.output).toContain('npx storybook tools stories changed');
  });

  it('get setup emits the setup markdown from the lightweight probe, without loading config', async () => {
    const d = deps();
    const result = await runSkillsCommand({ subcommand: 'get', id: 'setup', target: {} }, d);
    expect(result.exitCode).toBe(0);
    expect(result.output).toBe('# Storybook Setup');
    expect(d.loadStorybook).not.toHaveBeenCalled();
  });

  it('get setup reports the probe failure message and exits nonzero', async () => {
    const d = deps();
    d.getProjectInfo.mockResolvedValue({ ok: false, message: 'Could not detect framework' });
    const result = await runSkillsCommand({ subcommand: 'get', id: 'setup', target: {} }, d);
    expect(result.exitCode).toBe(1);
    expect(result.errorOutput).toContain('Could not detect framework');
  });

  it('get setup resolves configDir against the given cwd before probing, not process.cwd()', async () => {
    const d = deps();
    const target = { cwd: '/some/other/project', configDir: 'custom-storybook' };
    await runSkillsCommand({ subcommand: 'get', id: 'setup', target }, d);
    expect(d.getProjectInfo).toHaveBeenCalledWith({
      configDir: resolveStorybookConfigDir(target),
    });
  });

  it('reports a clean one-line message when loading the target Storybook fails, no stack trace', async () => {
    const d = deps();
    d.loadStorybook.mockRejectedValue(new Error('Cannot find module .storybook/main.ts'));
    const result = await runSkillsCommand({ subcommand: 'get', id: 'stories', target: {} }, d);
    expect(result.exitCode).toBe(1);
    expect(result.errorOutput).toBe(
      'Could not load the Storybook configuration for this project: Cannot find module .storybook/main.ts'
    );
  });

  it('unknown id exits nonzero and names the valid ids', async () => {
    const result = await runSkillsCommand({ subcommand: 'get', id: 'nope', target: {} }, deps());
    expect(result.exitCode).toBe(1);
    expect(result.errorOutput).toContain('stories');
    expect(result.errorOutput).toContain('write-story');
    expect(result.errorOutput).toContain('setup');
  });

  it('missing id behaves like unknown id', async () => {
    const result = await runSkillsCommand({ subcommand: 'get', target: {} }, deps());
    expect(result.exitCode).toBe(1);
  });

  it('bare `skills` (no subcommand) lists', async () => {
    const result = await runSkillsCommand({ subcommand: undefined, target: {} }, deps());
    expect(result.output).toContain('write-story');
  });
});

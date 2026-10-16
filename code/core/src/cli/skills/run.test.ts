import { relative } from 'node:path';

import { describe, expect, it, vi } from 'vitest';

import { resolveStorybookConfigDir } from '../tools/config-dir.ts';
import { resolveSkillsIntent, runSkillsCommand } from './run.ts';

const deps = () => ({
  loadStorybook: vi.fn().mockResolvedValue({ presets: { apply: vi.fn() } }),
  resolveSkillInputs: vi.fn().mockResolvedValue({
    framework: '@storybook/react-vite',
    csfFactories: false,
    previewFile: '.storybook/preview.ts',
    typescript: true,
    moduleGraphSupported: true,
    docsEnabled: false,
    docsEnabledForCli: false,
    docsHasManifests: false,
    docsFeatureEnabled: false,
    testSupported: true,
    a11yEnabled: false,
    docgenServer: false,
    mcpToolsets: { dev: true, docs: true, test: true },
    composed: false,
  }),
  getProjectInfo: vi.fn().mockResolvedValue({
    ok: true,
    projectInfo: { rendererPackage: '@storybook/react', builderPackage: '@storybook/builder-vite' },
  }),
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
    expect(resolveSkillsIntent({ tokens: ['ui-workflow'] })).toEqual({
      kind: 'get',
      id: 'ui-workflow',
    });
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
      expect(resolveSkillsIntent({ tokens: [first, 'ui-workflow'] })).toEqual({
        kind: 'error',
        message: `Unknown skill "${first}". Available skills: ui-workflow, component-docs, write-story, setup.`,
      });
    }
  });

  it('names ui-workflow, the new name of stories', () => {
    expect(resolveSkillsIntent({ tokens: ['stories'] })).toEqual({
      kind: 'error',
      message: expect.stringContaining(
        'The `stories` skill is renamed to `ui-workflow`. Run `npx storybook skills ui-workflow`'
      ),
    });
  });

  it('rejects surplus positional arguments and an id combined with --all', () => {
    expect(resolveSkillsIntent({ tokens: ['ui-workflow', 'typo'] })).toEqual({
      kind: 'error',
      message: expect.stringContaining('Unexpected arguments: "typo"'),
    });
    expect(resolveSkillsIntent({ tokens: ['ui-workflow'], all: true })).toEqual({
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
    expect(result.output).toContain('ui-workflow');
    expect(result.output).toContain('component-docs');
    expect(result.output).toContain('write-story');
    expect(result.output).toContain('setup');
    expect(d.loadStorybook).not.toHaveBeenCalled();
  });

  it('component-docs prints the same text for every project, without loading config', async () => {
    const d = deps();
    const result = await runSkillsCommand({ tokens: ['component-docs'], target: {} }, d);
    expect(result.output).toContain('# Storybook component docs');
    expect(d.loadStorybook).not.toHaveBeenCalled();
  });

  it('ui-workflow prints the workflow with CLI commands', async () => {
    const d = deps();
    const result = await runSkillsCommand({ tokens: ['ui-workflow'], target: {} }, d);
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

    const componentDocs = await runSkillsCommand({ tokens: ['component-docs'], target: {} }, d);
    expect(componentDocs.output).toContain('npx storybook tools docs show --id <id>');

    const uiWorkflow = await runSkillsCommand({ tokens: ['ui-workflow'], target: {} }, d);
    expect(uiWorkflow.output).toContain('npx storybook tools docs show --id <id>');

    const writeStory = await runSkillsCommand({ tokens: ['write-story'], target: {} }, d);
    expect(writeStory.output).toContain('npx storybook tools docs list');
  });

  it('--mcp names the MCP tools, on the MCP docs gate', async () => {
    const d = deps();
    d.resolveSkillInputs.mockResolvedValue({
      ...(await d.resolveSkillInputs()),
      docsEnabled: true,
      docsEnabledForCli: true,
    });

    const uiWorkflow = await runSkillsCommand(
      { tokens: ['ui-workflow'], mcp: true, target: {} },
      d
    );
    expect(uiWorkflow.output).toContain('tools of the Storybook MCP server');
    expect(uiWorkflow.output).toContain('`docs-show` with an `id`');
    expect(uiWorkflow.output).toContain('Call `review-create` with:');
    expect(uiWorkflow.output).not.toContain('npx storybook tools');

    const componentDocs = await runSkillsCommand(
      { tokens: ['component-docs'], mcp: true, target: {} },
      d
    );
    expect(componentDocs.output).toContain(
      'The tools named here are tools of the Storybook MCP server.'
    );
    expect(componentDocs.output).toContain('`docs-list`: every component and docs page');
    expect(componentDocs.output).toContain('`npx storybook skills ui-workflow --mcp`');
    expect(componentDocs.output).not.toContain('npx storybook tools');

    d.resolveSkillInputs.mockResolvedValue({
      ...(await d.resolveSkillInputs()),
      docsEnabled: false,
      docsEnabledForCli: true,
    });
    const withoutDocsTools = await runSkillsCommand(
      { tokens: ['ui-workflow'], mcp: true, target: {} },
      d
    );
    expect(withoutDocsTools.output).not.toContain('## Look up components first');

    // Composed Storybooks give the MCP docs tools something to read without local manifests.
    d.resolveSkillInputs.mockResolvedValue({ ...(await d.resolveSkillInputs()), composed: true });
    const composed = await runSkillsCommand({ tokens: ['ui-workflow'], mcp: true, target: {} }, d);
    expect(composed.output).toContain('## Look up components first');
  });

  it('--mcp leaves out the steps of the toolsets main.ts turns off', async () => {
    const d = deps();
    d.resolveSkillInputs.mockResolvedValue({
      ...(await d.resolveSkillInputs()),
      docsEnabled: true,
      docsEnabledForCli: true,
      mcpToolsets: { dev: false, docs: false, test: true },
    });

    const mcp = await runSkillsCommand({ tokens: ['ui-workflow'], mcp: true, target: {} }, d);
    expect(mcp.output).not.toContain('## Look up components first');
    expect(mcp.output).not.toContain('stories-changed');
    expect(mcp.output).not.toContain('## Finish with a review');
    expect(mcp.output).not.toContain('## Link to one story');
    expect(mcp.output).toContain('## Test');
    expect(mcp.output).toContain('This Storybook has no tool that lists story ids.');

    const cli = await runSkillsCommand({ tokens: ['ui-workflow'], target: {} }, d);
    expect(cli.output).toContain('## Look up components first');
    expect(cli.output).toContain('## Finish with a review');
  });

  it('leaves the component lookup out of ui-workflow when the CLI docs gate is off', async () => {
    const d = deps();
    const uiWorkflow = await runSkillsCommand({ tokens: ['ui-workflow'], target: {} }, d);
    expect(uiWorkflow.output).not.toContain('## Look up components first');
    expect(uiWorkflow.output).not.toContain('npx storybook tools docs');
  });

  it('write-story prints the ui-workflow document, under its earlier name', async () => {
    const d = deps();
    const result = await runSkillsCommand({ tokens: ['write-story'], target: {} }, d);
    const uiWorkflow = await runSkillsCommand({ tokens: ['ui-workflow'], target: {} }, d);
    expect(result.exitCode).toBe(0);
    expect(result.output).toBe(uiWorkflow.output);
    expect(result.output).toContain('@storybook/react');
    expect(result.output).toContain('npx storybook tools stories changed');
  });

  it('ui-workflow and component-docs teach each command inline, without a command reference', async () => {
    const d = deps();
    d.resolveSkillInputs.mockResolvedValue({
      ...(await d.resolveSkillInputs()),
      docsEnabledForCli: true,
      a11yEnabled: true,
    });
    const uiWorkflow = await runSkillsCommand({ tokens: ['ui-workflow'], target: {} }, d);
    const componentDocs = await runSkillsCommand({ tokens: ['component-docs'], target: {} }, d);

    expect(uiWorkflow.output).not.toContain('Usage: npx storybook tools');
    expect(componentDocs.output).not.toContain('Usage: npx storybook tools');
    expect(uiWorkflow.output).toContain("npx storybook tools test run --stories '[{");
    expect(uiWorkflow.output).toContain("npx storybook tools review create --input '{");
    expect(uiWorkflow.output.length).toBeLessThan(10000);
  });

  it('--all prints each skill once', async () => {
    const result = await runSkillsCommand({ tokens: [], all: true, target: {} }, deps());

    expect(result.output.split('# Storybook UI workflow')).toHaveLength(2);
    expect(result.output.split('# Storybook component docs')).toHaveLength(2);
    expect(result.output.split('# Storybook Setup')).toHaveLength(2);
    expect(result.skill).toBe('all');
  });

  it('setup emits the setup markdown from the lightweight probe, without loading config', async () => {
    const d = deps();
    const result = await runSkillsCommand({ tokens: ['setup'], target: {} }, d);
    expect(result.exitCode).toBe(0);
    expect(result.output).toBe('# Storybook Setup');
    expect(d.loadStorybook).not.toHaveBeenCalled();
  });

  it('reports the setup run only when the setup skill itself was requested', async () => {
    const setup = await runSkillsCommand({ tokens: ['setup'], target: {} }, deps());
    const all = await runSkillsCommand({ tokens: [], all: true, target: {} }, deps());

    expect(setup.setupRun).toEqual({
      projectInfo: {
        rendererPackage: '@storybook/react',
        builderPackage: '@storybook/builder-vite',
      },
      prompt: 'optimized-tests',
    });
    expect(all.setupRun).toBeUndefined();
  });

  it.each(['@storybook/react', '@storybook/angular', '@storybook/vue3'])(
    'setup accepts renderer %s',
    async (rendererPackage) => {
      const d = deps();
      const projectInfo = { rendererPackage, builderPackage: '@storybook/builder-vite' };
      d.getProjectInfo.mockResolvedValue({ ok: true, projectInfo });

      const result = await runSkillsCommand({ tokens: ['setup'], target: {} }, d);

      expect(result.exitCode).toBe(0);
      expect(result.output).toBe('# Storybook Setup');
      expect(d.getSetupMarkdown).toHaveBeenCalledWith(projectInfo);
    }
  );

  it.each([
    '@storybook/svelte',
    '@storybook/preact',
    '@storybook/html',
    '@storybook/web-components',
    '@storybook/solid',
    '@storybook/react-native',
    '@custom/renderer',
    null,
  ])('setup rejects unsupported renderer %s', async (rendererPackage) => {
    const d = deps();
    d.getProjectInfo.mockResolvedValue({
      ok: true,
      projectInfo: { rendererPackage, builderPackage: '@storybook/builder-vite' },
    });

    const result = await runSkillsCommand({ tokens: ['setup'], target: {} }, d);

    expect(result.exitCode).toBe(1);
    expect(result.output).toBe('');
    expect(result.errorOutput).toContain('only available for React, Angular, and Vue projects');
    expect(d.getSetupMarkdown).not.toHaveBeenCalled();
  });

  it('--all rejects an unsupported setup renderer without emitting partial instructions', async () => {
    const d = deps();
    d.getProjectInfo.mockResolvedValue({
      ok: true,
      projectInfo: {
        rendererPackage: '@storybook/svelte',
        builderPackage: '@storybook/builder-vite',
      },
    });

    const result = await runSkillsCommand({ tokens: [], all: true, target: {} }, d);

    expect(result.exitCode).toBe(1);
    expect(result.output).toBe('');
    expect(result.errorOutput).toContain('only available for React, Angular, and Vue projects');
    expect(d.getSetupMarkdown).not.toHaveBeenCalled();
  });

  it.each(['@storybook/react', '@storybook/angular', '@storybook/vue3'])(
    'setup rejects renderer %s without the Vite builder',
    async (rendererPackage) => {
      const d = deps();
      d.getProjectInfo.mockResolvedValue({
        ok: true,
        projectInfo: { rendererPackage, builderPackage: '@storybook/builder-webpack5' },
      });

      const result = await runSkillsCommand({ tokens: ['setup'], target: {} }, d);

      expect(result.exitCode).toBe(1);
      expect(result.output).toBe('');
      expect(result.errorOutput).toContain('using the Vite builder');
      expect(d.getSetupMarkdown).not.toHaveBeenCalled();
    }
  );

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
      configDir: relative(process.cwd(), resolveStorybookConfigDir(target)),
    });
  });

  it('setup probes `--config-dir .` as the project directory itself', async () => {
    const d = deps();
    await runSkillsCommand({ tokens: ['setup'], target: { configDir: '.' } }, d);
    expect(d.getProjectInfo).toHaveBeenCalledWith({ configDir: '.' });
  });

  it('reports a clean one-line message when loading the target Storybook fails, no stack trace', async () => {
    const d = deps();
    d.loadStorybook.mockRejectedValue(new Error('Cannot find module .storybook/main.ts'));
    const result = await runSkillsCommand({ tokens: ['ui-workflow'], target: {} }, d);
    expect(result.exitCode).toBe(1);
    expect(result.errorOutput).toBe(
      'Could not load the Storybook configuration for this project: Cannot find module .storybook/main.ts'
    );
  });

  it('unknown id exits nonzero and names the valid ids', async () => {
    const result = await runSkillsCommand({ tokens: ['nope'], target: {} }, deps());
    expect(result.exitCode).toBe(1);
    expect(result.errorOutput).toContain('ui-workflow');
    expect(result.errorOutput).toContain('component-docs');
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

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
    expect(resolveSkillsIntent({ tokens: ['ui-review'] })).toEqual({
      kind: 'get',
      id: 'ui-review',
    });
    expect(resolveSkillsIntent({ tokens: ['setup'] })).toEqual({ kind: 'get', id: 'setup' });
  });

  it('prints every skill on --all, unless help is also set', () => {
    expect(resolveSkillsIntent({ tokens: [], all: true })).toEqual({ kind: 'all' });
    expect(resolveSkillsIntent({ tokens: [], all: true, help: true })).toEqual({ kind: 'catalog' });
  });

  it('treats help as the catalog even after a skill id', () => {
    expect(resolveSkillsIntent({ tokens: ['write-stories'], help: true })).toEqual({
      kind: 'catalog',
    });
  });

  it('rejects `help`, `list`, and `get` as unknown skills, naming the valid ids', () => {
    for (const first of ['help', 'list', 'get', 'constructor']) {
      expect(resolveSkillsIntent({ tokens: [first, 'ui-review'] })).toEqual({
        kind: 'error',
        message: `Unknown skill "${first}". Available skills: component-docs, write-stories, test-stories, ui-review, setup.`,
      });
    }
  });

  it('names the skills and the test command that replace stories, the skill of Storybook 10.6', () => {
    expect(resolveSkillsIntent({ tokens: ['stories'] })).toEqual({
      kind: 'error',
      message: expect.stringMatching(
        /^The `stories` skill is replaced by `component-docs` .*`write-stories` .*`npx storybook tools test run --changed`.*When the user asks for a review, run `npx storybook skills ui-review`\.$/
      ),
    });
  });

  it('names write-stories, the new name of write-story', () => {
    expect(resolveSkillsIntent({ tokens: ['write-story'] })).toEqual({
      kind: 'error',
      message:
        'The `write-story` skill is renamed to `write-stories`. Run `npx storybook skills write-stories`.',
    });
  });

  it('keeps --mcp in the command it names for a replaced skill', () => {
    expect(resolveSkillsIntent({ tokens: ['stories'], mcp: true })).toEqual({
      kind: 'error',
      message: expect.stringContaining(
        'Run `npx storybook skills component-docs --mcp` and `npx storybook skills write-stories --mcp` now'
      ),
    });
    expect(resolveSkillsIntent({ tokens: ['write-story'], mcp: true })).toEqual({
      kind: 'error',
      message: expect.stringContaining('Run `npx storybook skills write-stories --mcp`.'),
    });
  });

  it('rejects surplus positional arguments and an id combined with --all', () => {
    expect(resolveSkillsIntent({ tokens: ['ui-review', 'typo'] })).toEqual({
      kind: 'error',
      message: expect.stringContaining('Unexpected arguments: "typo"'),
    });
    expect(resolveSkillsIntent({ tokens: ['ui-review'], all: true })).toEqual({
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
    for (const id of ['component-docs', 'write-stories', 'test-stories', 'ui-review', 'setup']) {
      expect(result.output).toContain(id);
    }
    expect(d.loadStorybook).not.toHaveBeenCalled();
  });

  it('component-docs prints the docs commands, or says to skip the step without component docs', async () => {
    const d = deps();
    d.resolveSkillInputs.mockResolvedValue({
      ...(await d.resolveSkillInputs()),
      docsEnabledForCli: true,
    });
    const result = await runSkillsCommand({ tokens: ['component-docs'], target: {} }, d);
    expect(result.output).toContain('# Storybook component docs');
    expect(result.output).toContain('npx storybook tools docs show --id <id>');

    d.resolveSkillInputs.mockResolvedValue({
      ...(await d.resolveSkillInputs()),
      docsEnabledForCli: false,
    });
    const without = await runSkillsCommand({ tokens: ['component-docs'], target: {} }, d);
    expect(without.output).toContain('Skip this step');
    expect(without.output).not.toContain('npx storybook tools');

    // A composed Storybook serves its docs without local manifests.
    d.resolveSkillInputs.mockResolvedValue({ ...(await d.resolveSkillInputs()), composed: true });
    const composed = await runSkillsCommand({ tokens: ['component-docs'], target: {} }, d);
    expect(composed.output).toContain('npx storybook tools docs list');
  });

  it('write-stories prints the story rules of the project, and no command', async () => {
    const result = await runSkillsCommand({ tokens: ['write-stories'], target: {} }, deps());
    expect(result.exitCode).toBe(0);
    expect(result.output).toContain('# Write the component and its stories');
    expect(result.output).toContain('@storybook/react-vite');
    expect(result.output).not.toContain('npx storybook tools');
  });

  it('test-stories and ui-review print their steps with CLI commands', async () => {
    const d = deps();
    const testStories = await runSkillsCommand({ tokens: ['test-stories'], target: {} }, d);
    const uiReview = await runSkillsCommand({ tokens: ['ui-review'], target: {} }, d);

    expect(testStories.output).toContain('npx storybook tools test run --changed');
    expect(testStories.output).not.toContain('review create');
    expect(testStories.output).not.toContain('stories changed');
    expect(uiReview.output).toContain("npx storybook tools review create --input '{");
    expect(uiReview.output).toContain('npx storybook tools stories changed');
    expect(uiReview.output).not.toContain('test run');
    for (const { output } of [testStories, uiReview]) {
      expect(output).not.toContain('Usage: npx storybook tools');
    }
  });

  it('lists every story id on the CLI gate even when the MCP docs gate is off', async () => {
    const d = deps();
    d.resolveSkillInputs.mockResolvedValue({
      ...(await d.resolveSkillInputs()),
      docsEnabled: false,
      docsEnabledForCli: true,
    });

    const cli = await runSkillsCommand({ tokens: ['ui-review'], target: {} }, d);
    expect(cli.output).toContain('npx storybook tools docs list --withStoryIds true');

    const mcp = await runSkillsCommand({ tokens: ['ui-review'], mcp: true, target: {} }, d);
    expect(mcp.output).not.toContain('docs-list');

    d.resolveSkillInputs.mockResolvedValue({ ...(await d.resolveSkillInputs()), composed: true });
    const composed = await runSkillsCommand({ tokens: ['ui-review'], mcp: true, target: {} }, d);
    expect(composed.output).toContain('`docs-list` with `withStoryIds: true`');
  });

  it('lists every story id on the CLI for composed Storybooks without local manifests', async () => {
    const d = deps();
    d.resolveSkillInputs.mockResolvedValue({
      ...(await d.resolveSkillInputs()),
      docsEnabledForCli: false,
      composed: true,
    });

    const { output } = await runSkillsCommand({ tokens: ['ui-review'], target: {} }, d);

    expect(output).toContain('npx storybook tools docs list --withStoryIds true');
  });

  it('--mcp names the MCP tools', async () => {
    const d = deps();
    d.resolveSkillInputs.mockResolvedValue({
      ...(await d.resolveSkillInputs()),
      docsEnabled: true,
    });
    for (const id of ['component-docs', 'test-stories', 'ui-review']) {
      const { output } = await runSkillsCommand({ tokens: [id], mcp: true, target: {} }, d);
      expect(output).toContain('The tools named here are tools of the Storybook MCP server.');
      expect(output).not.toContain('npx storybook tools');
    }
    const uiReview = await runSkillsCommand({ tokens: ['ui-review'], mcp: true, target: {} }, d);
    expect(uiReview.output).toContain('Call `review-create` with:');
  });

  it('--mcp leaves out the tools of the other toolsets main.ts turns off, and says when its own is off', async () => {
    const d = deps();
    d.resolveSkillInputs.mockResolvedValue({
      ...(await d.resolveSkillInputs()),
      docsEnabled: true,
      docsEnabledForCli: true,
      mcpToolsets: { dev: false, docs: false, test: true },
    });

    const testStories = await runSkillsCommand(
      { tokens: ['test-stories'], mcp: true, target: {} },
      d
    );
    expect(testStories.output).toContain('`test-run` with `files');
    expect(testStories.output).not.toContain('stories-changed');

    // A client that turns the toolset on with the `X-MCP-Toolsets` header has the tool.
    const uiReview = await runSkillsCommand({ tokens: ['ui-review'], mcp: true, target: {} }, d);
    expect(uiReview.output).toContain('When the server does not give you `review-create`, skip');
    expect(uiReview.output).toContain('Call `review-create` with:');

    const cli = await runSkillsCommand({ tokens: ['ui-review'], target: {} }, d);
    expect(cli.output).toContain('## Publish the review');
    expect(cli.output).not.toContain('skip this step');

    d.resolveSkillInputs.mockResolvedValue({
      ...(await d.resolveSkillInputs()),
      mcpToolsets: { dev: true, docs: true, test: false },
    });
    const withoutTests = await runSkillsCommand(
      { tokens: ['test-stories'], mcp: true, target: {} },
      d
    );
    expect(withoutTests.output).toContain('When the server does not give you `test-run`, skip');
    expect(withoutTests.output).toContain('Call it after every change');
  });

  it('--all prints each skill once', async () => {
    const result = await runSkillsCommand({ tokens: [], all: true, target: {} }, deps());

    for (const title of [
      '# Storybook component docs',
      '# Write the component and its stories',
      '# Test the stories',
      '# Storybook UI review',
      '# Storybook Setup',
    ]) {
      expect(result.output.split(title)).toHaveLength(2);
    }
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
    const result = await runSkillsCommand({ tokens: ['ui-review'], target: {} }, d);
    expect(result.exitCode).toBe(1);
    expect(result.errorOutput).toBe(
      'Could not load the Storybook configuration for this project: Cannot find module .storybook/main.ts'
    );
  });

  it('unknown id exits nonzero and names the valid ids', async () => {
    const result = await runSkillsCommand({ tokens: ['nope'], target: {} }, deps());
    expect(result.exitCode).toBe(1);
    expect(result.errorOutput).toContain(
      'Available skills: component-docs, write-stories, test-stories, ui-review, setup.'
    );
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

import { describe, expect, it } from 'vitest';

import { defineFocusJob, selectChromaticSiblings, selectFocusSandbox } from './focus.ts';

describe('selectFocusSandbox', () => {
  it.each([
    ['code/frameworks/angular-vite/src/preset.ts', 'angular-vite/default-ts'],
    ['code/frameworks/angular/src/server/index.ts', 'angular-cli/default-ts'],
    ['code/frameworks/nextjs-vite/src/preset.ts', 'nextjs-vite/default-ts'],
    ['code/frameworks/nextjs/src/preset.ts', 'nextjs/default-ts'],
    ['code/frameworks/react-webpack5/src/preset.ts', 'react-vite/default-ts'],
    ['code/frameworks/vue3-vite/src/preset.ts', 'vue3-vite/default-ts'],
    ['code/frameworks/svelte-vite/src/preset.ts', 'svelte-vite/default-ts'],
    ['code/frameworks/preact-vite/src/preset.ts', 'react-vite/default-ts'],
    ['code/frameworks/html-vite/src/preset.ts', 'react-vite/default-ts'],
    ['code/frameworks/web-components-vite/src/preset.ts', 'react-vite/default-ts'],
    ['code/frameworks/react-native-web-vite/src/preset.ts', 'react-native-web-vite/expo-ts'],
    ['code/frameworks/react-vite/src/preset.ts', 'react-vite/default-ts'],
    ['code/renderers/vue3/src/render.ts', 'vue3-vite/default-ts'],
    ['code/renderers/svelte/src/render.ts', 'svelte-vite/default-ts'],
    ['code/renderers/preact/src/render.ts', 'react-vite/default-ts'],
    ['code/renderers/html/src/render.ts', 'react-vite/default-ts'],
    ['code/renderers/web-components/src/render.ts', 'react-vite/default-ts'],
    ['code/renderers/react/src/render.ts', 'react-vite/default-ts'],
    ['code/builders/builder-webpack5/src/index.ts', 'react-vite/default-ts'],
    ['code/builders/builder-vite/src/index.ts', 'react-vite/default-ts'],
  ])('maps %s to %s', (changedFile, expectedSandbox) => {
    expect(selectFocusSandbox([changedFile])).toBe(expectedSandbox);
  });

  it('prefers a framework match over a shared builder match', () => {
    expect(
      selectFocusSandbox([
        'code/builders/builder-vite/src/index.ts',
        'code/frameworks/angular-vite/src/preset.ts',
      ])
    ).toBe('angular-vite/default-ts');
  });

  it('prefers React Vite over a changed Webpack builder', () => {
    expect(
      selectFocusSandbox([
        'code/builders/builder-webpack5/src/index.ts',
        'code/frameworks/react-vite/src/preset.ts',
      ])
    ).toBe('react-vite/default-ts');
  });

  it('uses the React Vite sandbox when no renderer, builder, or framework changed', () => {
    expect(selectFocusSandbox(['docs/get-started/introduction.mdx'])).toBe('react-vite/default-ts');
  });
});

describe('selectChromaticSiblings', () => {
  it('selects every other React Chromatic template when the React renderer changed', () => {
    expect(
      selectChromaticSiblings('react-vite/default-ts', ['code/renderers/react/src/render.ts'])
    ).toEqual([
      'nextjs/default-ts',
      'nextjs-vite/default-ts',
      'bench/react-vite-default-ts-test-build',
      'bench/react-webpack-18-ts-test-build',
      'react-rsbuild/default-ts',
      'tanstack-react-router/default-ts',
      'tanstack-react-start/default-ts',
    ]);
  });

  it.each([
    ['core', 'code/core/src/manager/App.tsx'],
    ['a builder', 'code/builders/builder-vite/src/index.ts'],
    ['the React Vite framework', 'code/frameworks/react-vite/src/preset.ts'],
  ])('selects nothing when only %s changed', (_, changedFile) => {
    expect(selectChromaticSiblings('react-vite/default-ts', [changedFile])).toEqual([]);
  });

  it('selects the renderer siblings when a framework change picked the focused sandbox', () => {
    const siblings = selectChromaticSiblings('nextjs/default-ts', [
      'code/frameworks/nextjs/src/preset.ts',
      'code/renderers/react/src/render.ts',
    ]);

    expect(siblings).toContain('react-vite/default-ts');
    expect(siblings).not.toContain('nextjs/default-ts');
  });

  it('selects templates with the changed renderer under a different framework', () => {
    expect(
      selectChromaticSiblings('svelte-vite/default-ts', ['code/renderers/svelte/src/render.ts'])
    ).toEqual(['svelte-kit/skeleton-ts']);
  });
});

describe('defineFocusJob', () => {
  it('puts the complete focused workflow in one xlarge job', () => {
    const job = defineFocusJob('react-vite/default-ts', []);

    expect(job.requires).toEqual([]);
    const implementation = job.implementation('focus');

    if ('type' in implementation) {
      throw new Error('The focus job must have executable steps');
    }

    expect(implementation).toMatchObject({
      executor: {
        name: 'sb_playwright',
        class: 'xlarge',
      },
    });
    expect(implementation.steps).toEqual(
      expect.arrayContaining([
        { run: expect.objectContaining({ name: 'Compile' }) },
        {
          run: expect.objectContaining({
            name: 'Run tests',
            background: true,
            command: expect.stringContaining('--testTimeout=30000'),
          }),
        },
        {
          run: expect.objectContaining({
            name: 'Setup Corepack',
            command: ['corepack enable', 'which yarn', 'yarn --version'].join('\n'),
          }),
        },
        { run: expect.objectContaining({ name: 'Create sandbox react-vite/default-ts' }) },
        { run: expect.objectContaining({ name: 'Build sandbox react-vite/default-ts' }) },
        { run: expect.objectContaining({ name: 'Run dev E2E tests' }) },
        { run: expect.objectContaining({ name: 'Run build E2E tests' }) },
        {
          run: expect.objectContaining({
            name: 'Copy sandboxes for Chromatic',
            command: expect.stringContaining(
              'rm -rf /tmp/project/sandbox/react-vite-default-ts/.git'
            ),
          }),
        },
        { run: expect.objectContaining({ name: 'Run Chromatic react-vite/default-ts' }) },
        { run: expect.objectContaining({ name: 'Wait for tests' }) },
      ])
    );
  });

  it('builds every sibling and runs Chromatic on it after the tests pass', () => {
    const implementation = defineFocusJob('svelte-vite/default-ts', [
      'svelte-kit/skeleton-ts',
    ]).implementation('focus');

    if ('type' in implementation) {
      throw new Error('The focus job must have executable steps');
    }

    const runSteps = implementation.steps.flatMap((step) => {
      const { run } = step as { run?: { name: string; command?: string } };
      return run ? [run] : [];
    });
    const stepNames = runSteps.map(({ name }) => name);

    expect(stepNames).toEqual(
      expect.arrayContaining([
        'Generate Sandbox',
        'Run prepare',
        'Build sandbox svelte-kit/skeleton-ts',
      ])
    );
    expect(stepNames.indexOf('Build sandbox svelte-kit/skeleton-ts')).toBeLessThan(
      stepNames.indexOf('Copy sandboxes for Chromatic')
    );
    expect(stepNames.indexOf('Wait for tests')).toBeLessThan(
      stepNames.indexOf('Run Chromatic svelte-kit/skeleton-ts')
    );
    expect(runSteps.find(({ name }) => name === 'Copy sandboxes for Chromatic')?.command).toContain(
      'rm -rf /tmp/project/sandbox/svelte-kit-skeleton-ts/.git'
    );
  });

  it('rejects a sandbox that skips a required focused task', () => {
    expect(() => defineFocusJob('react-webpack/18-ts', [])).toThrow(
      'react-webpack/18-ts does not support every task required by focused CI'
    );
  });
});

import { describe, expect, it } from 'vitest';

import { getFocusJobs, selectChromaticSiblings, selectFocusSandbox } from './focus.ts';

describe('selectFocusSandbox', () => {
  it.each([
    ['code/frameworks/angular-vite/src/preset.ts', 'angular-vite/default-ts'],
    ['code/frameworks/angular/src/server/index.ts', 'angular-cli/default-ts'],
    ['code/frameworks/nextjs-vite/src/preset.ts', 'nextjs-vite/default-ts'],
    ['code/frameworks/nextjs/src/preset.ts', 'nextjs/default-ts'],
    ['code/frameworks/react-webpack5/src/preset.ts', 'react-webpack/18-ts'],
    ['code/frameworks/vue3-vite/src/preset.ts', 'vue3-vite/default-ts'],
    ['code/frameworks/svelte-vite/src/preset.ts', 'svelte-vite/default-ts'],
    ['code/frameworks/preact-vite/src/preset.ts', 'preact-vite/default-ts'],
    ['code/frameworks/html-vite/src/preset.ts', 'html-vite/default-ts'],
    ['code/frameworks/web-components-vite/src/preset.ts', 'lit-vite/default-ts'],
    ['code/frameworks/react-native-web-vite/src/preset.ts', 'react-native-web-vite/expo-ts'],
    ['code/frameworks/react-vite/src/preset.ts', 'react-vite/default-ts'],
    ['code/renderers/vue3/src/render.ts', 'vue3-vite/default-ts'],
    ['code/renderers/svelte/src/render.ts', 'svelte-vite/default-ts'],
    ['code/renderers/preact/src/render.ts', 'preact-vite/default-ts'],
    ['code/renderers/html/src/render.ts', 'html-vite/default-ts'],
    ['code/renderers/web-components/src/render.ts', 'lit-vite/default-ts'],
    ['code/renderers/react/src/render.ts', 'react-vite/default-ts'],
    ['code/builders/builder-webpack5/src/index.ts', 'react-webpack/18-ts'],
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

  it('uses the React Vite sandbox when no renderer, builder, or framework changed', () => {
    expect(selectFocusSandbox(['docs/get-started/introduction.mdx'])).toBe('react-vite/default-ts');
  });
});

describe('selectChromaticSiblings', () => {
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

describe('getFocusJobs', () => {
  const jobIds = (changedFiles: string[]) => getFocusJobs(changedFiles).map(({ id }) => id);

  it('runs the build, unit tests, and every React Vite sandbox job for a core change', () => {
    expect(jobIds(['code/core/src/manager/App.tsx'])).toEqual([
      'build--linux',
      'tests--linux',
      'sandboxes',
      'react-latest--vite---typescript---create',
      'react-latest--vite---typescript---dev',
      'react-latest--vite---typescript---chromatic',
      'react-latest--vite---typescript---vitest',
      'react-latest--vite---typescript---e2e',
    ]);
  });

  it('adds only the create and Chromatic jobs of each sibling', () => {
    const ids = jobIds(['code/renderers/svelte/src/render.ts']);

    expect(ids).toEqual(
      expect.arrayContaining([
        'sveltekit-latest--vite---typescript---create',
        'sveltekit-latest--vite---typescript---chromatic',
      ])
    );
    expect(ids.filter((id) => id.startsWith('sveltekit-'))).toHaveLength(2);
  });

  it('leaves out siblings that skip Chromatic', () => {
    const ids = jobIds(['code/renderers/react/src/render.ts']);

    expect(ids).toContain('next-js-latest--webpack---typescript---chromatic');
    expect(ids.some((id) => id.startsWith('bench--react-vite-default-ts--no-docs'))).toBe(false);
  });
});

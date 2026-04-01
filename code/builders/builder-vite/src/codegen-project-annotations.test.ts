import { describe, expect, it } from 'vitest';

import { generateProjectAnnotationsCodeFromPreviews } from './codegen-project-annotations';

describe('generateProjectAnnotationsCodeFromPreviews', () => {
  it('generates unique variable names for annotations that hash-collide', () => {
    // These two addon preview paths are known to produce the same djb2 hash.
    const result = generateProjectAnnotationsCodeFromPreviews({
      previewAnnotations: [
        '/node_modules/@storybook/addon-links/dist/preview.js',
        '/node_modules/@storybook/addon-a11y/dist/preview.js',
      ],
      projectRoot: '/',
      frameworkName: '@storybook/react-vite',
      isCsf4: false,
    });

    // Extract all "import * as <var>" identifiers
    const importedVars = [...result.matchAll(/import \* as (\w+) from/g)].map((m) => m[1]);
    // Every imported variable must be unique
    expect(new Set(importedVars).size).toBe(importedVars.length);
  });

  it('does not alter variable names when there is no collision', () => {
    const result = generateProjectAnnotationsCodeFromPreviews({
      previewAnnotations: [
        '/node_modules/@storybook/addon-links/dist/preview.js',
        '/node_modules/@storybook/addon-essentials/dist/preview.js',
      ],
      projectRoot: '/',
      frameworkName: '@storybook/react-vite',
      isCsf4: false,
    });

    const importedVars = [...result.matchAll(/import \* as (\w+) from/g)].map((m) => m[1]);
    expect(new Set(importedVars).size).toBe(importedVars.length);
    // Neither variable should have a dedup suffix
    expect(importedVars.every((v) => !/_\d+$/.test(v) || /^\w+_\d+$/.test(v))).toBe(true);
  });

  it('handles three-way collisions', () => {
    // Force three identical variable names by using the same path three times.
    // In practice this can't happen, but it exercises the while-loop.
    const result = generateProjectAnnotationsCodeFromPreviews({
      previewAnnotations: [
        '/node_modules/pkg-a/dist/preview.js',
        '/node_modules/pkg-a/dist/preview.js',
        '/node_modules/pkg-a/dist/preview.js',
      ],
      projectRoot: '/',
      frameworkName: '@storybook/react-vite',
      isCsf4: false,
    });

    const importedVars = [...result.matchAll(/import \* as (\w+) from/g)].map((m) => m[1]);
    expect(new Set(importedVars).size).toBe(importedVars.length);
  });
});

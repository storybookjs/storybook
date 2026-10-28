import { describe, expect, it } from 'vitest';

import type { InstallationMetadata } from 'storybook/internal/common';

import { getDuplicatedDepsWarnings } from './getDuplicatedDepsWarnings.ts';

const metadata = (duplicatedDependencies: Record<string, string[]>): InstallationMetadata =>
  ({
    duplicatedDependencies,
    dedupeCommand: 'yarn dedupe',
    infoCommand: 'yarn why',
  }) as unknown as InstallationMetadata;

describe('getDuplicatedDepsWarnings', () => {
  it.each<{ name: string; input: Record<string, string[]>; expected: string }>([
    {
      name: 'storybook across majors',
      input: { storybook: ['8.0.0', '11.0.0'] },
      expected: 'Critical:',
    },
    {
      name: 'core across majors',
      input: { '@storybook/core': ['8.0.0', '11.0.0'] },
      expected: 'Critical:',
    },
    {
      name: 'ui across majors',
      input: { '@storybook/ui': ['8.0.0', '11.0.0'] },
      expected: 'Critical:',
    },
    {
      name: 'manager across majors',
      input: { '@storybook/manager': ['8.0.0', '11.0.0'] },
      expected: 'Critical:',
    },
    {
      name: 'core within a major',
      input: { '@storybook/core': ['11.0.0', '11.0.1'] },
      expected: 'Attention:',
    },
    {
      name: 'ui within a major',
      input: { '@storybook/ui': ['11.0.0', '11.0.1'] },
      expected: 'Attention:',
    },
    {
      name: 'manager within a major',
      input: { '@storybook/manager': ['11.0.0', '11.0.1'] },
      expected: 'Attention:',
    },
    {
      name: 'open-service within a major',
      input: { '@storybook/open-service': ['11.0.0', '11.0.1'] },
      expected: 'Attention:',
    },
  ])('warns for $name with $expected', ({ input, expected }) => {
    expect(getDuplicatedDepsWarnings(metadata(input))?.[0]).toContain(expected);
  });
});

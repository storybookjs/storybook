import { beforeEach, describe, expect, it, vi } from 'vitest';

import { once } from 'storybook/internal/node-logger';
import type { Options } from 'storybook/internal/types';

import {
  MISSING_REACT_DOCGEN,
  type ReactDocgenPlan,
  type ReactDocgenPlanInput,
  getReactDocgenPlan,
  planReactDocgen,
} from './engine.ts';

const both = { reactDocgen: true, typescript: true };
const jsOnly = { reactDocgen: true, typescript: false };
const tsOnly = { reactDocgen: false, typescript: true };
const neither = { reactDocgen: false, typescript: false };
const base = { docgenServer: false, experimentalReactComponentMeta: false };

const off = { reactDocgen: false, reactDocgenTypescript: false } as const;

describe('planReactDocgen', () => {
  it.each<[string, ReactDocgenPlanInput, ReactDocgenPlan]>([
    [
      'JavaScript project',
      { ...base, reactDocgen: 'react-docgen', installed: jsOnly },
      {
        builder: { reactDocgen: 'all', reactDocgenTypescript: false },
        manifest: 'react-docgen',
        argTypes: 'react-docgen',
        missingReactDocgen: false,
      },
    ],
    [
      'JavaScript project without react-docgen',
      { ...base, reactDocgen: 'react-docgen', installed: neither },
      {
        builder: off,
        manifest: 'react-docgen-missing',
        argTypes: 'react-docgen-missing',
        missingReactDocgen: true,
      },
    ],
    [
      'TypeScript project with docgen server',
      { ...base, docgenServer: true, reactDocgen: 'react-docgen', installed: tsOnly },
      {
        builder: off,
        manifest: 'server',
        argTypes: 'react-docgen-typescript',
        missingReactDocgen: false,
      },
    ],
    [
      'docgen server with reactDocgen false',
      { ...base, docgenServer: true, reactDocgen: false, installed: both },
      { builder: off, manifest: 'server', argTypes: 'disabled', missingReactDocgen: false },
    ],
    [
      'docgen server without typescript',
      { ...base, docgenServer: true, reactDocgen: 'react-docgen', installed: jsOnly },
      { builder: off, manifest: 'server', argTypes: 'react-docgen', missingReactDocgen: false },
    ],
    [
      'TypeScript project that turned docgen server off, without react-docgen',
      { ...base, reactDocgen: 'react-docgen', installed: tsOnly },
      {
        builder: off,
        manifest: 'react-docgen-missing',
        argTypes: 'react-docgen-missing',
        missingReactDocgen: true,
      },
    ],
    [
      'react-docgen-typescript',
      { ...base, reactDocgen: 'react-docgen-typescript', installed: both },
      {
        builder: { reactDocgen: 'js', reactDocgenTypescript: true },
        manifest: 'react-docgen-typescript',
        argTypes: 'react-docgen-typescript',
        missingReactDocgen: false,
      },
    ],
    [
      'react-docgen-typescript without react-docgen',
      { ...base, reactDocgen: 'react-docgen-typescript', installed: tsOnly },
      {
        builder: { reactDocgen: false, reactDocgenTypescript: true },
        manifest: 'react-docgen-typescript',
        argTypes: 'react-docgen-typescript',
        missingReactDocgen: false,
      },
    ],
    [
      'react-docgen-typescript without typescript',
      { ...base, reactDocgen: 'react-docgen-typescript', installed: jsOnly },
      {
        builder: { reactDocgen: 'js', reactDocgenTypescript: false },
        manifest: 'react-docgen',
        argTypes: 'react-docgen',
        missingReactDocgen: false,
      },
    ],
    [
      'reactDocgen false',
      { ...base, reactDocgen: false, installed: neither },
      { builder: off, manifest: 'disabled', argTypes: 'disabled', missingReactDocgen: false },
    ],
    [
      'experimentalReactComponentMeta',
      {
        ...base,
        experimentalReactComponentMeta: true,
        reactDocgen: 'react-docgen',
        installed: both,
      },
      {
        builder: { reactDocgen: 'all', reactDocgenTypescript: false },
        manifest: 'react-component-meta',
        argTypes: 'react-docgen',
        missingReactDocgen: false,
      },
    ],
  ])('%s', (_name, input, plan) => {
    expect(planReactDocgen(input)).toEqual(plan);
  });
});

describe('getReactDocgenPlan', () => {
  const presetsWith = (typescript: object, features: object = {}) =>
    ({
      apply: async (extension: string) => (extension === 'typescript' ? typescript : features),
    }) as Options['presets'];

  beforeEach(() => {
    vi.spyOn(once, 'warn').mockImplementation(() => undefined);
  });

  it('warns about a missing react-docgen, without the deprecation', async () => {
    await getReactDocgenPlan(presetsWith({ reactDocgen: 'react-docgen' }), () => false);

    expect(vi.mocked(once.warn).mock.calls).toEqual([[MISSING_REACT_DOCGEN]]);
  });

  it('prints only the deprecation when builder docgen runs', async () => {
    await getReactDocgenPlan(presetsWith({ reactDocgen: 'react-docgen' }), () => true);

    expect(once.warn).toHaveBeenCalledOnce();
    expect(vi.mocked(once.warn).mock.calls[0][0]).toContain('Builder docgen');
  });

  it.each([
    ['reactDocgen is false', presetsWith({ reactDocgen: false })],
    ['docgen server is on', presetsWith({ reactDocgen: 'react-docgen' }, { docgenServer: true })],
  ])('stays silent when %s', async (_name, presets) => {
    await getReactDocgenPlan(presets, (pkg) => pkg === 'typescript');

    expect(once.warn).not.toHaveBeenCalled();
  });
});

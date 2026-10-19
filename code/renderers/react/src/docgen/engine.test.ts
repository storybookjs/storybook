import { beforeEach, describe, expect, it, vi } from 'vitest';

import { once } from 'storybook/internal/node-logger';
import type { Options } from 'storybook/internal/types';

import {
  MISSING_REACT_DOCGEN,
  type ReactDocgenPlan,
  type ReactDocgenPlanInput,
  getArgTypesEngine,
  getReactDocgenPlan,
  planReactDocgen,
} from './engine.ts';

beforeEach(() => {
  vi.spyOn(once, 'warn').mockImplementation(() => undefined);
});

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
        argTypes: { typescript: 'react-docgen', javascript: 'react-docgen' },
        missingReactDocgen: false,
      },
    ],
    [
      'JavaScript project without react-docgen',
      { ...base, reactDocgen: 'react-docgen', installed: neither },
      {
        builder: off,
        manifest: 'react-docgen-missing',
        argTypes: { typescript: 'react-docgen-missing', javascript: 'react-docgen-missing' },
        missingReactDocgen: true,
      },
    ],
    [
      'TypeScript project with docgen server',
      { ...base, docgenServer: true, reactDocgen: 'react-docgen', installed: tsOnly },
      {
        builder: off,
        manifest: 'server',
        // A `.jsx` component without stories still needs react-docgen.
        argTypes: { typescript: 'react-docgen-typescript', javascript: 'react-docgen-missing' },
        missingReactDocgen: false,
      },
    ],
    [
      'TypeScript project with docgen server and react-docgen',
      { ...base, docgenServer: true, reactDocgen: 'react-docgen', installed: both },
      {
        builder: off,
        manifest: 'server',
        argTypes: { typescript: 'react-docgen-typescript', javascript: 'react-docgen' },
        missingReactDocgen: false,
      },
    ],
    [
      'docgen server with reactDocgen false',
      { ...base, docgenServer: true, reactDocgen: false, installed: both },
      {
        builder: off,
        manifest: 'server',
        argTypes: { typescript: 'disabled', javascript: 'disabled' },
        missingReactDocgen: false,
      },
    ],
    [
      'docgen server without typescript',
      { ...base, docgenServer: true, reactDocgen: 'react-docgen', installed: jsOnly },
      {
        builder: off,
        manifest: 'server',
        argTypes: { typescript: 'react-docgen', javascript: 'react-docgen' },
        missingReactDocgen: false,
      },
    ],
    [
      'TypeScript project that turned docgen server off, without react-docgen',
      { ...base, reactDocgen: 'react-docgen', installed: tsOnly },
      {
        builder: off,
        manifest: 'react-docgen-missing',
        argTypes: { typescript: 'react-docgen-missing', javascript: 'react-docgen-missing' },
        missingReactDocgen: true,
      },
    ],
    [
      'react-docgen-typescript',
      { ...base, reactDocgen: 'react-docgen-typescript', installed: both },
      {
        builder: { reactDocgen: 'js', reactDocgenTypescript: true },
        manifest: 'react-docgen-typescript',
        argTypes: { typescript: 'react-docgen-typescript', javascript: 'react-docgen' },
        missingReactDocgen: false,
      },
    ],
    [
      'react-docgen-typescript without react-docgen',
      { ...base, reactDocgen: 'react-docgen-typescript', installed: tsOnly },
      {
        builder: { reactDocgen: false, reactDocgenTypescript: true },
        manifest: 'react-docgen-typescript',
        argTypes: { typescript: 'react-docgen-typescript', javascript: 'react-docgen-missing' },
        missingReactDocgen: false,
      },
    ],
    [
      'react-docgen-typescript without typescript',
      { ...base, reactDocgen: 'react-docgen-typescript', installed: jsOnly },
      {
        builder: { reactDocgen: 'js', reactDocgenTypescript: false },
        manifest: 'react-docgen',
        argTypes: { typescript: 'react-docgen', javascript: 'react-docgen' },
        missingReactDocgen: false,
      },
    ],
    [
      'reactDocgen false',
      { ...base, reactDocgen: false, installed: neither },
      {
        builder: off,
        manifest: 'disabled',
        argTypes: { typescript: 'disabled', javascript: 'disabled' },
        missingReactDocgen: false,
      },
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
        argTypes: { typescript: 'react-docgen', javascript: 'react-docgen' },
        missingReactDocgen: false,
      },
    ],
  ])('%s', (_name, input, plan) => {
    expect(planReactDocgen(input)).toEqual(plan);
  });
});

describe('getArgTypesEngine', () => {
  const plan = planReactDocgen({
    ...base,
    docgenServer: true,
    reactDocgen: 'react-docgen',
    installed: both,
  });

  it.each([
    ['/app/Button.tsx', 'react-docgen-typescript'],
    ['/app/Button.mts', 'react-docgen-typescript'],
    ['/app/Button.jsx', 'react-docgen'],
    ['/app/Button.js', 'react-docgen'],
    ['/app/Button.cjs', 'react-docgen'],
  ])('%s uses %s', (filePath, engine) => {
    expect(getArgTypesEngine(plan, filePath)).toBe(engine);
  });
});

const presetsWith = (typescript: object, features: object = {}) =>
  ({
    apply: async (extension: string) => (extension === 'typescript' ? typescript : features),
  }) as Options['presets'];

describe('getReactDocgenPlan', () => {
  it('warns about a missing react-docgen, without the deprecation', async () => {
    await getReactDocgenPlan(
      { presets: presetsWith({ reactDocgen: 'react-docgen' }) },
      () => false
    );

    expect(vi.mocked(once.warn).mock.calls).toEqual([[MISSING_REACT_DOCGEN]]);
  });

  it('prints only the deprecation when builder docgen runs', async () => {
    await getReactDocgenPlan({ presets: presetsWith({ reactDocgen: 'react-docgen' }) }, () => true);

    expect(once.warn).toHaveBeenCalledOnce();
    expect(vi.mocked(once.warn).mock.calls[0][0]).toContain('Builder docgen');
  });

  it.each([
    ['reactDocgen is false', presetsWith({ reactDocgen: false })],
    ['docgen server is on', presetsWith({ reactDocgen: 'react-docgen' }, { docgenServer: true })],
  ])('stays silent when %s', async (_name, presets) => {
    await getReactDocgenPlan({ presets }, (pkg) => pkg === 'typescript');

    expect(once.warn).not.toHaveBeenCalled();
  });

  it('reads presets and warns once per preset list', async () => {
    const presets = presetsWith({});
    const apply = vi.spyOn(presets, 'apply');
    const presetsList: NonNullable<Options['presetsList']> = [];

    await getReactDocgenPlan({ presets, presetsList }, () => false);
    await getReactDocgenPlan({ presets: { ...presets }, presetsList }, () => false);

    expect(apply).toHaveBeenCalledTimes(2);
    expect(once.warn).toHaveBeenCalledOnce();
  });
});

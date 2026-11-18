import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { DocgenProvider, DocgenProviderInput } from 'storybook/internal/types';

import { VueComponentMetaManager } from './component-docgen/component-meta/vue-project-manager.ts';
import { createDocgenProvider } from './docgen-worker.ts';

const fixturesDir = join(
  dirname(fileURLToPath(import.meta.url)),
  'component-docgen/__testfixtures__/declaration-order'
);

const inputFor = (name: string): DocgenProviderInput => ({
  entry: {
    type: 'story',
    subtype: 'story',
    id: `${name.toLowerCase()}--default`,
    name: 'Default',
    title: name,
    importPath: `./${name}.stories.ts`,
  },
});

const passthrough: DocgenProvider = async (inputs) =>
  inputs.map(() => ({ status: 'fulfilled', value: undefined }));

const managers: VueComponentMetaManager[] = [];

beforeEach(() => {
  vi.spyOn(process, 'cwd').mockReturnValue(fixturesDir);
  vi.spyOn(VueComponentMetaManager.prototype, 'startWatching').mockImplementation(function (
    this: VueComponentMetaManager
  ) {
    managers.push(this);
  });
});

afterEach(() => {
  managers.splice(0).forEach((manager) => manager.dispose());
  vi.restoreAllMocks();
});

describe('createDocgenProvider', () => {
  it('documents the components of one call with the same props and types as each on its own', async () => {
    const inputs = ['Sizes', 'Avatar', 'Legacy', 'Warmup', 'Computed'].map(inputFor);

    const inOneCall = await createDocgenProvider()(passthrough)(inputs);
    const oneAtATime = [];
    for (const input of inputs) {
      oneAtATime.push(...(await createDocgenProvider()(passthrough)([input])));
    }

    expect(inOneCall).toEqual(oneAtATime);
    expect(inOneCall.map((result) => result.status)).toEqual([
      'fulfilled',
      'fulfilled',
      'fulfilled',
      'fulfilled',
      'fulfilled',
    ]);
    expect(managers).toHaveLength(inputs.length + 1);
  }, 60_000);
});

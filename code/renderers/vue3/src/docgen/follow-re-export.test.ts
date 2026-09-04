import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterAll, describe, expect, it } from 'vitest';

import type { IndexEntry } from 'storybook/internal/types';

import ts from 'typescript';

import { buildDocgenPayload } from './build-docgen.ts';
import { VueComponentMetaManager } from './vue-project-manager.ts';

const barrelDir = join(dirname(fileURLToPath(import.meta.url)), '__testfixtures__/barrel');

const manager = new VueComponentMetaManager(ts);
afterAll(() => manager.dispose());

const docgenFor = (importPath: string, title: string) =>
  buildDocgenPayload(
    {
      entry: {
        type: 'story',
        subtype: 'story',
        id: title,
        name: 'Default',
        title,
        importPath,
      } as unknown as IndexEntry,
    },
    {
      getChecker: (componentPath: string) => manager.getCheckerForFile(componentPath),
      resolvePath: (path: string) => join(barrelDir, path),
      typescript: ts,
    }
  );

describe('a component imported through a barrel', () => {
  it('documents the same props as a direct import of it', async () => {
    const direct = await docgenFor('./src/Direct.stories.ts', 'Barrel/Direct');
    const barrel = await docgenFor('./src/Barrel.stories.ts', 'Barrel/ViaIndex');

    expect(direct?.error).toBeUndefined();
    expect(barrel?.error).toBeUndefined();
    expect(Object.keys(barrel?.argTypes ?? {})).toEqual(Object.keys(direct?.argTypes ?? {}));
    expect(barrel?.argTypes?.text).toMatchObject({
      description: 'Badge text.',
      type: { name: 'string', required: true },
    });
    expect(barrel?.argTypes?.tone?.type).toEqual({
      name: 'enum',
      value: ['info', 'warn'],
      required: false,
    });
  });
});

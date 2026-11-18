import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, describe, expect, it } from 'vitest';

import type { IndexEntry, StrictArgTypes } from 'storybook/internal/types';

import ts from 'typescript';

import { buildDocgenPayload } from '../build-docgen.ts';
import { VueComponentMetaManager } from './vue-project-manager.ts';

const fixturesDir = join(
  dirname(fileURLToPath(import.meta.url)),
  '../__testfixtures__/declaration-order'
);

const managers: VueComponentMetaManager[] = [];
afterEach(() => {
  managers.splice(0).forEach((manager) => manager.dispose());
});

const createManager = () => {
  const manager = new VueComponentMetaManager(ts);
  managers.push(manager);
  return manager;
};

const docgen = (manager: VueComponentMetaManager, name: string) =>
  buildDocgenPayload(
    {
      entry: {
        type: 'story',
        subtype: 'story',
        id: `${name.toLowerCase()}--default`,
        name: 'Default',
        title: name,
        importPath: `./${name}.stories.ts`,
      } as unknown as IndexEntry,
    },
    {
      getChecker: (componentPath) => manager.getCheckerForFile(componentPath),
      resolvePath: (path) => join(fixturesDir, path),
      typescript: ts,
    }
  );

const summarize = (argTypes: StrictArgTypes | undefined) =>
  Object.values(argTypes ?? {}).map(({ name, type, table }) => {
    const members = type && 'value' in type && Array.isArray(type.value) ? type.value : [];
    const values = members.map((member) =>
      typeof member === 'object' && 'value' in member ? member.value : member
    );
    return `${name}: ${values.join(', ')} (${table?.type?.summary})`;
  });

describe('docgen in declaration order', () => {
  it('lists union members as declared, whatever the checker extracted before', async () => {
    const shared = createManager();
    await docgen(shared, 'Sizes');

    const afterSizes = await docgen(shared, 'Avatar');
    const alone = await docgen(createManager(), 'Avatar');

    expect(afterSizes?.argTypes).toEqual(alone?.argTypes);
    expect(summarize(afterSizes?.argTypes)).toMatchInlineSnapshot(`
      [
        "tone: loud, quiet ("loud" | "quiet")",
        "ring: thin, thick ("thin" | "thick")",
        "size: xs, sm, md, lg, xl ("xs" | "sm" | "md" | "lg" | "xl")",
        "shape: square, circle (Shape)",
        "count: 3, 1, 2 (3 | 1 | 2)",
      ]
    `);
  });

  it('lists the members a prop reads through keys, elements, aliases and enums as declared', async () => {
    const shared = createManager();
    await docgen(shared, 'Warmup');

    const afterWarmup = await docgen(shared, 'Computed');
    const alone = await docgen(createManager(), 'Computed');

    expect(afterWarmup).toEqual(alone);
    expect(summarize(afterWarmup?.argTypes)).toMatchInlineSnapshot(`
      [
        "size: md, xl, sm ("md" | "xl" | "sm")",
        "tone: quiet, loud ("quiet" | "loud")",
        "placement: top, bottom, top-start, top-end, bottom-start, bottom-end (Side | "top-start" | "top-end" | "bottom-start" | "bottom-end")",
        "status: warn, info, custom (Tone | "custom")",
      ]
    `);
  });

  it('lists the members a PropType names as declared', async () => {
    const shared = createManager();
    await docgen(shared, 'Sizes');

    const payload = await docgen(shared, 'Legacy');

    expect(summarize(payload?.argTypes)).toMatchInlineSnapshot(`
      [
        "size: xl, md, xs ("xl" | "md" | "xs")",
        "count: 3, 1, 2 (3 | 1 | 2)",
      ]
    `);
  });
});

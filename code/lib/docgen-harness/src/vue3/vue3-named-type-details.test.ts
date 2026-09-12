import { readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import ts from 'typescript';
import { createCheckerByJson } from 'vue-component-meta';

import {
  CHECKER_OPTIONS,
  collectComponentMetaSources,
} from '../../../../renderers/vue3/src/docgen/component-meta.ts';
import { createNamedTypeDetailResolver } from '../../../../renderers/vue3/src/docgen/named-type-detail.ts';
import { extractArgTypes } from '../../../../renderers/vue3/src/extractArgTypes.ts';
import type { StrictArgTypes, StrictInputType } from 'storybook/internal/types';

/**
 * Pins the docgen-server named-type expansion (storybookjs/storybook#13459) against a real
 * vue-component-meta checker: the same collectComponentMetaSources + extractArgTypes pipeline
 * the docgen worker runs, with a resolver built from the checker's underlying TS program.
 * `table.type` is asserted strictly so the detail text format, the 20-line cap and the flat
 * cases (absent detail key) are all pinned byte for byte.
 */

const fixturesDir = join(dirname(fileURLToPath(import.meta.url)), '__testfixtures__');
const checker = createCheckerByJson(fixturesDir, { include: ['**/*'] }, CHECKER_OPTIONS);

/** The committed-snapshot gates prove the argType exists; fail loudly if it ever drifts. */
function tableTypeOf(
  argTypes: StrictArgTypes,
  name: string
): NonNullable<NonNullable<StrictInputType['table']>['type']> {
  const table = argTypes[name]?.table;
  if (!table?.type) {
    throw new Error(`argType "${name}" has no table.type`);
  }
  return table.type;
}

async function serverArgTypesFor(fixtureCase: string) {
  const testDir = join(fixturesDir, fixtureCase);
  const [sfcFile] = readdirSync(testDir).filter((file) => file.endsWith('.vue'));
  const sfcPath = join(testDir, sfcFile);

  const sources = await collectComponentMetaSources(checker, sfcPath, ts);
  const meta = sources.find((source) => source.exportName === 'default');
  expect(meta, `no default export found in ${fixtureCase}`).toBeDefined();

  const resolver = createNamedTypeDetailResolver({
    checker,
    typescript: ts,
    componentPath: sfcPath,
  });
  return { resolver, argTypes: extractArgTypes({ __docgenInfo: meta! }, resolver)! };
}

describe('vue3 docgen-server named-type details', () => {
  let argTypes: Awaited<ReturnType<typeof serverArgTypesFor>>['argTypes'];
  let resolver: Awaited<ReturnType<typeof serverArgTypesFor>>['resolver'];

  it('expands cross-file interfaces with their property lines', async () => {
    ({ argTypes, resolver } = await serverArgTypesFor('named-type-details'));
    expect(tableTypeOf(argTypes, 'user')).toEqual({
      summary: 'User',
      detail: 'User {\n  name: string — The display name.\n  age: number\n}',
    });
    // summary and sbType are untouched by the expansion
    expect(argTypes.user.type).toEqual({ name: 'object', value: {}, required: true });
  });

  it('renders optional members with the ? marker, their union text, and member JSDoc', () => {
    expect(tableTypeOf(argTypes, 'prefs')).toEqual({
      summary: 'Prefs',
      detail:
        'Prefs {\n  theme?: string\n  density?: "cozy" | "compact"\n  locale: string — Where it is stored.\n}',
    });
  });

  it('expands mapped-type aliases over local types by member origin', () => {
    // Pick resolves through the alias name to an instantiated mapped type whose members are
    // the user's in-project properties — the expansion gate must judge member origins, not
    // the resolved symbol (lib.d.ts declares the mapped type itself).
    expect(tableTypeOf(argTypes, 'picked')).toEqual({
      summary: 'Picked',
      detail: 'Picked {\n  name: string — The display name.\n}',
    });
    // vue-component-meta renders this alias as its instantiated text, which the plain-name
    // gate keeps flat in production; the direct resolver call pins the member-origin fix.
    expect(tableTypeOf(argTypes, 'partialed')).toEqual({ summary: 'Partial<User>' });
    expect(resolver('Picked')).toBe('Picked {\n  name: string — The display name.\n}');
    expect(resolver('Partialed')).toBe(
      'Partialed {\n  name?: string — The display name.\n  age?: number\n}'
    );
  });

  it('expands string TS enums to their member lines', () => {
    expect(tableTypeOf(argTypes, 'color')).toEqual({
      summary: 'Color',
      detail: "Color {\n  Red = 'red'\n  Green = 'green'\n}",
    });
  });

  it('expands numeric TS enums to their member lines', () => {
    expect(tableTypeOf(argTypes, 'level')).toEqual({
      summary: 'Level',
      detail: 'Level {\n  Low = 0\n  High = 1\n}',
    });
  });

  it('expands namespace-qualified references', () => {
    expect(tableTypeOf(argTypes, 'namespaced')).toEqual({
      summary: 'AppTypes.Nested',
      detail: 'AppTypes.Nested {\n  key: string\n  count: number\n}',
    });
  });

  it('caps member lines at 20 with an "… N more" summary', () => {
    expect(tableTypeOf(argTypes, 'big')).toEqual({
      summary: 'BigInterface',
      detail: `BigInterface {\n${Array.from(
        { length: 20 },
        (_, i) => `  p${String(i).padStart(2, '0')}: string`
      ).join('\n')}\n… 3 more\n}`,
    });
  });

  it('stays flat for scalar aliases', () => {
    // vue-component-meta normalizes the alias to its scalar before extraction, so the resolver
    // never sees "ID" at all
    expect(tableTypeOf(argTypes, 'scalarAlias')).toEqual({ summary: 'string' });
  });

  it('stays flat for literal-union aliases', () => {
    expect(tableTypeOf(argTypes, 'shapes')).toEqual({ summary: 'Shapes' });
  });

  it('stays flat for index-signature-only aliases', () => {
    expect(tableTypeOf(argTypes, 'dict')).toEqual({ summary: 'Dict' });
  });

  it('stays flat for inline object literals', () => {
    expect(tableTypeOf(argTypes, 'inlined')).toEqual({ summary: '{ foo: string; bar: number; }' });
  });

  it('stays flat for types declared in node_modules', () => {
    expect(tableTypeOf(argTypes, 'builtin')).toEqual({ summary: 'Date' });
  });

  it('stays flat for a local alias naming a library type', () => {
    // vue-component-meta normalizes the prop to the library name before the resolver runs
    // (summary "Date"), so the production path is already flat. The direct resolver call pins
    // the alias-branch exclusion: a local alias whose target is a lib declaration must not
    // expand the library's members.
    expect(tableTypeOf(argTypes, 'localDate')).toEqual({ summary: 'Date' });
    expect(resolver('LocalDate')).toBeUndefined();
  });

  it('expands mutually recursive object aliases one hop without hanging', () => {
    // A pure alias-to-alias cycle is unrepresentable in valid TS (TS2456), so the cycle guard's
    // residual value is defensive; the compiled cyclic graph must still resolve bounded output.
    expect(tableTypeOf(argTypes, 'cyclic')).toEqual({
      summary: 'AliasA',
      detail: 'AliasA {\n  peer: AliasB\n}',
    });
  });

  it('expands self-referential interfaces one hop', async () => {
    ({ argTypes } = await serverArgTypesFor('recursive-type'));
    expect(tableTypeOf(argTypes, 'node')).toEqual({
      summary: 'TreeNode',
      detail:
        'TreeNode {\n  value: string — Node label.\n  children: TreeNode[] — Nested children of this node.\n}',
    });
  });

  it('keeps the no-resolver extraction free of details', async () => {
    const testDir = join(fixturesDir, 'named-type-details');
    const sfcPath = join(testDir, 'NamedTypeDetails.vue');
    const sources = await collectComponentMetaSources(checker, sfcPath, ts);
    const meta = sources.find((source) => source.exportName === 'default')!;

    const plainArgTypes = extractArgTypes({ __docgenInfo: meta })!;
    for (const [name, argType] of Object.entries(plainArgTypes)) {
      // the legacy client and Vite-plugin paths get exactly this shape
      expect(argType.table?.type, name).not.toHaveProperty('detail');
    }
  });
});

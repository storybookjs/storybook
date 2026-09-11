import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, parse as parsePath } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
  type ComponentMeta,
  type MetaCheckerOptions,
  type PropertyMetaSchema,
  TypeMeta,
  createCheckerByJson,
} from 'vue-component-meta';

import { applyVueDocgenApiTempFixes } from '../../../../renderers/vue3/src/docgen/component-meta.ts';
import { extractArgTypes } from '../../../../renderers/vue3/src/extractArgTypes.ts';
import { generateSourceCode } from '../../../../renderers/vue3/src/docs/sourceDecorator.ts';
import { expectCurrentOrBetter } from '../compare/expect-current-or-better.ts';
import { recordArgTypesSnapshot } from '../compare/record-argtypes-snapshot.ts';

const fixturesDir = join(dirname(fileURLToPath(import.meta.url)), '__testfixtures__');

const fixtureCases = readdirSync(fixturesDir, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort();

// Mirrors the checker construction in the production vite plugin
// (frameworks/vue3-vite/src/plugins/vue-component-meta.ts): no fixture tsconfig exists,
// so production falls back to createCheckerByJson over the project root with the same options.
const checkerOptions: MetaCheckerOptions = {
  forceUseTs: true,
  noDeclarations: true,
  printer: { newLine: 1 },
  schema: true,
};
const checker = createCheckerByJson(fixturesDir, { include: ['**/*'] }, checkerOptions);

// Copy of the production plugin's nested-schema pruning.
function removeNestedSchemas(schema: PropertyMetaSchema) {
  if (typeof schema !== 'object') {
    return;
  }
  if (schema.kind === 'enum') {
    schema.schema?.forEach((enumSchema) => removeNestedSchemas(enumSchema));
    return;
  }
  if (schema.kind === 'literal') {
    return;
  }
  delete schema.schema;
}

const lowercaseFirstLetter = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

// Replicates the production plugin's meta processing so a recording represents what a real build
// attaches, the undefined case included.
async function buildComponentMetaDocgen(sfcPath: string): Promise<object | undefined> {
  let meta: ComponentMeta;
  try {
    const exportNames = checker.getExportNames(sfcPath);
    const defaultIndex = exportNames.indexOf('default');
    if (defaultIndex === -1) {
      return undefined;
    }
    meta = checker.getComponentMeta(sfcPath, 'default');

    // The shared temp-fix pass pairs metas with parseMulti results by export name, so hand it
    // every extractable export the way collectComponentMetaSources does.
    const entries = exportNames.flatMap((name) => {
      if (name === 'default') {
        return [{ name, meta }];
      }
      try {
        return [{ name, meta: checker.getComponentMeta(sfcPath, name) }];
      } catch {
        return [];
      }
    });
    await applyVueDocgenApiTempFixes(
      sfcPath,
      entries.map((entry) => entry.meta),
      entries.map((entry) => entry.name)
    );
  } catch {
    // the production transform swallows checker failures and attaches nothing
    return undefined;
  }

  const isEmpty =
    !meta.props.length && !meta.events.length && !meta.slots.length && !meta.exposed.length;
  if (isEmpty || meta.type === TypeMeta.Unknown) {
    return undefined;
  }

  (['props', 'events', 'slots', 'exposed'] as const).forEach((key) => {
    meta[key].forEach((value) => {
      if (Array.isArray(value.schema)) {
        value.schema.forEach((eventSchema) => removeNestedSchemas(eventSchema));
      } else {
        removeNestedSchemas(value.schema);
      }
    });
  });

  const exposed = meta.exposed
    .filter((expose) => {
      if (!/^on[A-Z]/.test(expose.name)) {
        return true;
      }
      const eventName = lowercaseFirstLetter(expose.name.slice('on'.length));
      return !meta.events.some((event) => event.name === eventName);
    })
    .filter((expose) => {
      if (expose.name === '$slots') {
        const slotNames = meta.slots.map((slot) => slot.name);
        return !slotNames.every((slotName) => expose.type.includes(slotName));
      }
      return true;
    });

  return {
    exportName: 'default',
    displayName: parsePath(sfcPath).name,
    ...meta,
    exposed,
    // production records the absolute module id; argTypes/snippets never read it, and an
    // absolute path must not leak into snapshots
    sourceFiles: '<sfc>',
  };
}

type DocgenComponent = {
  name?: string;
  __name?: string;
  __docgenInfo?: unknown;
};

describe('vue3 vue-component-meta baselines', () => {
  it.each(fixtureCases)('%s', async (fixtureCase) => {
    const testDir = join(fixturesDir, fixtureCase);
    const sfcFiles = readdirSync(testDir).filter((file) => file.endsWith('.vue'));
    expect(sfcFiles).toHaveLength(1);

    const docgen = await buildComponentMetaDocgen(join(testDir, sfcFiles[0]));

    const storiesModule = await import(`./__testfixtures__/${fixtureCase}/input.stories.ts`);
    const { default: meta, ...stories } = storiesModule;

    const component: DocgenComponent = meta.component;
    if (docgen) {
      component.__docgenInfo = Object.assign(
        { displayName: component.name ?? component.__name },
        JSON.parse(JSON.stringify(docgen))
      );
    } else {
      delete component.__docgenInfo;
    }

    const argTypes = extractArgTypes(component);
    await recordArgTypesSnapshot({
      path: join(testDir, 'cm-argtypes.snapshot'),
      label: `${fixtureCase}/cm-argtypes.snapshot`,
      candidate: argTypes!,
    });

    for (const [exportName, story] of Object.entries<{ args?: Record<string, unknown> }>(stories)) {
      const ctx = {
        title: meta.title,
        component,
        args: { ...meta.args, ...story.args },
      };
      const snippetPath = join(testDir, `cm-snippet-${exportName}.snapshot`);
      const committedSnippet = existsSync(snippetPath)
        ? readFileSync(snippetPath, 'utf8')
        : undefined;
      const snippet = generateSourceCode(ctx);
      if (committedSnippet !== undefined) {
        expectCurrentOrBetter({
          kind: 'snippet',
          framework: 'vue3',
          baseline: committedSnippet,
          candidate: snippet,
        });
      }
      await expect(snippet).toMatchFileSnapshot(snippetPath);
    }

    // same stale-file guard as the legacy recorder, scoped to the cm- prefix
    const snippetFilesOnDisk = readdirSync(testDir)
      .filter((file) => file.startsWith('cm-snippet-') && file.endsWith('.snapshot'))
      .sort();
    const expectedSnippetFiles = Object.keys(stories)
      .map((exportName) => `cm-snippet-${exportName}.snapshot`)
      .sort();
    expect(snippetFilesOnDisk).toEqual(expectedSnippetFiles);
  });
});

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
import { parseMulti } from 'vue-docgen-api';

import { extractArgTypes } from '../../../../renderers/vue3/src/extractArgTypes.ts';
import { generateSourceCode } from '../../../../renderers/vue3/src/docs/sourceDecorator.ts';
import { expectCurrentOrBetter } from '../compare/expect-current-or-better.ts';
import { isSnapshotUpdateRun } from '../compare/is-snapshot-update-run.ts';
import { parseArgTypesSnapshot } from '../compare/parse-snapshot.ts';

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

/** Copy of the production plugin's nested-schema pruning. */
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

/**
 * Replicates the production plugin's meta processing for the fixture SFC's default export:
 * empty-meta skip, event-description backfill via vue-docgen-api, nested-schema pruning, and the
 * exposed de-duplication filters. Returns undefined where production would attach no __docgenInfo.
 */
async function buildComponentMetaDocgen(sfcPath: string): Promise<object | undefined> {
  let meta: ComponentMeta;
  try {
    const exportNames = checker.getExportNames(sfcPath);
    const defaultIndex = exportNames.indexOf('default');
    if (defaultIndex === -1) {
      return undefined;
    }
    meta = checker.getComponentMeta(sfcPath, 'default');

    // production's applyTempFixForEventDescriptions
    if (meta.events.length) {
      try {
        const parsed = await parseMulti(sfcPath);
        const eventsWithDescription = parsed[defaultIndex]?.events;
        if (eventsWithDescription?.length) {
          meta.events = meta.events.map((event) => {
            const description = eventsWithDescription.find(
              (i) => i.name === event.name
            )?.description;
            if (description) {
              (event as typeof event & { description: string }).description = description;
            }
            return event;
          });
        }
      } catch {
        // noop, as in production
      }
    }
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
      let nameWithoutOnPrefix = expose.name;
      if (nameWithoutOnPrefix.startsWith('on')) {
        nameWithoutOnPrefix = lowercaseFirstLetter(expose.name.replace('on', ''));
      }
      return !meta.events.find((event) => event.name === nameWithoutOnPrefix);
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

    const argTypesPath = join(testDir, 'cm-argtypes.snapshot');
    const committedArgTypes = existsSync(argTypesPath)
      ? readFileSync(argTypesPath, 'utf8')
      : undefined;

    const argTypes = extractArgTypes(component);
    await expect(argTypes).toMatchFileSnapshot(argTypesPath);

    if (committedArgTypes !== undefined) {
      const parsed = parseArgTypesSnapshot(
        committedArgTypes,
        `${fixtureCase}/cm-argtypes.snapshot`
      );
      if (!isSnapshotUpdateRun()) {
        // Round-trip proof: the tokenizer must reconstruct exactly what pretty-format wrote.
        expect(parsed).toEqual(argTypes);
      }
      expectCurrentOrBetter({ kind: 'argTypes', baseline: parsed, candidate: argTypes! });
    }

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
      await expect(snippet).toMatchFileSnapshot(snippetPath);
      if (committedSnippet !== undefined) {
        expectCurrentOrBetter({
          kind: 'snippet',
          framework: 'vue3',
          baseline: committedSnippet,
          candidate: snippet,
        });
      }
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

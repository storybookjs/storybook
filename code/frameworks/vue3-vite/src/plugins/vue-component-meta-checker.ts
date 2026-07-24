import { readFile, stat } from 'node:fs/promises';
import { join, parse } from 'node:path';

import { getProjectRoot } from 'storybook/internal/common';

import {
  type ComponentMeta,
  type MetaCheckerOptions,
  type PropertyMetaSchema,
  createChecker,
  createCheckerByJson,
} from 'vue-component-meta';
import { parseMulti } from 'vue-docgen-api';

/**
 * Shared `vue-component-meta` (Volar) plumbing used by BOTH the Vite docgen plugin
 * (`vue-component-meta.ts`) and the build-time components-manifest generator
 * (`../docs/vueComponentManifest.ts`).
 *
 * The checker builds a full TypeScript program, so it is expensive to construct — callers must create
 * it ONCE and reuse `getComponentMeta` per component. The helpers here (`removeNestedSchemas`,
 * `applyTempFixForEventDescriptions`, `filterExposed`) are the production-hardening the plugin already
 * relied on; keeping a single copy means the manifest generator inherits the exact same behavior.
 */

/** The Volar checker instance type (either a tsconfig- or JSON-backed checker). */
export type VueComponentMetaChecker = Awaited<ReturnType<typeof createVueComponentMetaChecker>>;

/**
 * Creates the `vue-component-meta` checker to use for extracting component meta/docs. Considers the
 * given tsconfig file (will use a fallback checker if it does not exist or is not supported).
 *
 * `projectRoot` defaults to {@link getProjectRoot} (the plugin's behavior). The manifest generator
 * passes its own working directory so the checker's program is scoped to that directory rather than
 * the whole repo.
 */
export async function createVueComponentMetaChecker(
  tsconfigPath = 'tsconfig.json',
  projectRoot = getProjectRoot()
) {
  const checkerOptions: MetaCheckerOptions = {
    forceUseTs: true,
    noDeclarations: true,
    printer: { newLine: 1 },
  };

  const projectTsConfigPath = join(projectRoot, tsconfigPath);

  const defaultChecker = createCheckerByJson(projectRoot, { include: ['**/*'] }, checkerOptions);

  // prefer the tsconfig.json file of the project to support alias resolution etc.
  if (await fileExists(projectTsConfigPath)) {
    // vue-component-meta does currently not resolve tsconfig references (see https://github.com/vuejs/language-tools/issues/3896)
    // so we will return the defaultChecker if references are used.
    // Otherwise vue-component-meta might not work at all for the Storybook docgen.
    const references = await getTsConfigReferences(projectTsConfigPath);

    if (references.length > 0) {
      return defaultChecker;
    }
    return createChecker(projectTsConfigPath, checkerOptions);
  }

  return defaultChecker;
}

/** Gets the filename without file extension. */
export function getFilenameWithoutExtension(filename: string) {
  return parse(filename).name;
}

/** Lowercases the first letter. */
function lowercaseFirstLetter(string: string) {
  return string.charAt(0).toLowerCase() + string.slice(1);
}

/** Checks whether the given file path exists. */
async function fileExists(fullPath: string) {
  try {
    await stat(fullPath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Filters the `exposed` array of a component meta the same way the docgen plugin does:
 *
 * - removes the duplicated "on"-prefixed entries that mirror events (e.g. `onClick` for the `click`
 *   event), and
 * - removes the duplicated `$slots` expose when it merely re-lists the component's slots.
 */
export function filterExposed(meta: ComponentMeta): ComponentMeta['exposed'] {
  return (
    meta.exposed
      // the meta also includes duplicated entries in the "exposed" array with "on"
      // prefix (e.g. onClick instead of click), so we need to filter them out here
      .filter((expose) => {
        let nameWithoutOnPrefix = expose.name;

        if (nameWithoutOnPrefix.startsWith('on')) {
          nameWithoutOnPrefix = lowercaseFirstLetter(expose.name.replace('on', ''));
        }

        const hasEvent = meta.events.find((event) => event.name === nameWithoutOnPrefix);
        return !hasEvent;
      })
      // remove unwanted duplicated "$slots" expose
      .filter((expose) => {
        if (expose.name === '$slots') {
          const slotNames = meta.slots.map((slot) => slot.name);
          return !slotNames.every((slotName) => expose.type.includes(slotName));
        }
        return true;
      })
  );
}

/**
 * Applies a temporary workaround/fix for missing event descriptions because Volar is currently not
 * able to extract them. Will modify the events of the passed meta. Performance note: Based on some
 * quick tests, calling "parseMulti" only takes a few milliseconds (8-20ms) so it should not
 * decrease performance that much. Especially because it is only execute if the component actually
 * has events.
 *
 * Check status of this Volar issue: https://github.com/vuejs/language-tools/issues/3893 and
 * update/remove this workaround once Volar supports it:
 *
 * - Delete this function
 * - Uninstall vue-docgen-api dependency
 */
export async function applyTempFixForEventDescriptions(
  filename: string,
  componentMeta: ComponentMeta[]
) {
  // do not apply temp fix if no events exist for performance reasons
  const hasEvents = componentMeta.some((meta) => meta.events.length);

  if (!hasEvents) {
    return componentMeta;
  }

  try {
    const parsedComponentDocs = await parseMulti(filename);

    // add event descriptions to the existing Volar meta if available
    componentMeta.map((meta, index) => {
      const eventsWithDescription = parsedComponentDocs[index].events;

      if (!meta.events.length || !eventsWithDescription?.length) {
        return meta;
      }

      meta.events = meta.events.map((event) => {
        const description = eventsWithDescription.find((i) => i.name === event.name)?.description;
        if (description) {
          (event as typeof event & { description: string }).description = description;
        }
        return event;
      });

      return meta;
    });
  } catch {
    // noop
  }

  return componentMeta;
}

/**
 * Gets a list of tsconfig references for the given tsconfig This is only needed for the temporary
 * workaround/fix for: https://github.com/vuejs/language-tools/issues/3896
 */
async function getTsConfigReferences(tsConfigPath: string) {
  try {
    const content = JSON.parse(await readFile(tsConfigPath, 'utf-8'));

    if (!('references' in content) || !Array.isArray(content.references)) {
      return [];
    }
    return content.references as unknown[];
  } catch {
    // invalid project tsconfig
    return [];
  }
}

/**
 * Removes any nested schemas from the given main schema (e.g. from a prop, event, slot or exposed).
 * Useful to drastically reduce build size and prevent out of memory issues when large schemas (e.g.
 * HTMLElement, MouseEvent) are used.
 */
export function removeNestedSchemas(schema: PropertyMetaSchema) {
  if (typeof schema !== 'object') {
    return;
  }
  if (schema.kind === 'enum') {
    // for enum types, we do not want to remove the schemas because otherwise the controls will be missing
    // instead we remove the nested schemas for the enum entries to prevent out of memory errors for types like "HTMLElement | MouseEvent"
    schema.schema?.forEach((enumSchema) => removeNestedSchemas(enumSchema));
    return;
  }
  delete schema.schema;
}

/**
 * Applies {@link removeNestedSchemas} to every prop/event/slot/exposed schema of a component meta.
 * Mirrors the loop the docgen plugin runs before serializing meta into the bundle.
 */
export function stripNestedSchemas(meta: ComponentMeta): void {
  (['props', 'events', 'slots', 'exposed'] as const).forEach((key) => {
    meta[key].forEach((value) => {
      if (Array.isArray(value.schema)) {
        value.schema.forEach((eventSchema) => removeNestedSchemas(eventSchema));
      } else {
        removeNestedSchemas(value.schema);
      }
    });
  });
}

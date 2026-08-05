/**
 * Shared `vue-component-meta` extraction used by both Vue docgen paths.
 *
 * The legacy path is the Vite plugin in `@storybook/vue3-vite`, which injects the
 * extracted meta into the preview bundle as `__docgenInfo`. The server path is the docgen provider in
 * `./docgen-worker.ts`, which keeps the meta on the server and ships converted argTypes over the
 * `core/docgen` open service. Both must see identical meta, so all checker setup and normalization
 * lives here rather than in either caller.
 */
import { readFile, stat } from 'node:fs/promises';
import { join, parse } from 'node:path';

import { getProjectRoot } from 'storybook/internal/common';

import {
  type ComponentMeta,
  type ComponentMetaChecker,
  type MetaCheckerOptions,
  type PropertyMetaSchema,
  TypeMeta,
  createChecker,
  createCheckerByJson,
} from 'vue-component-meta';
import { parseMulti } from 'vue-docgen-api';

type Serializable<T> = T extends object
  ? { [K in keyof T]: Serializable<T[K]> }
  : T extends Function
    ? never
    : T;

/** One component's normalized `vue-component-meta` output, tagged with the export it came from. */
export type MetaSource = {
  exportName: string;
  displayName: string;
  sourceFiles: string;
} & Serializable<ComponentMeta> &
  MetaCheckerOptions['schema'];

function toSerializableMeta<T>(obj: T): Serializable<T> {
  return JSON.parse(JSON.stringify(obj)) as Serializable<T>;
}

/** Checker options shared by every path so legacy and server extraction produce identical meta. */
export const CHECKER_OPTIONS: MetaCheckerOptions = {
  forceUseTs: true,
  noDeclarations: true,
  printer: { newLine: 1 },
  schema: true,
};

/**
 * Creates the `vue-component-meta` checker to use for extracting component meta/docs. Considers the
 * given tsconfig file (will use a fallback checker if it does not exist or is not supported).
 */
export async function createVueComponentMetaChecker(
  tsconfigPath = 'tsconfig.json'
): Promise<ComponentMetaChecker> {
  const projectRoot = getProjectRoot();

  const projectTsConfigPath = join(projectRoot, tsconfigPath);

  const defaultChecker = createCheckerByJson(projectRoot, { include: ['**/*'] }, CHECKER_OPTIONS);

  // prefer the tsconfig.json file of the project to support alias resolution etc.
  if (await fileExists(projectTsConfigPath)) {
    // vue-component-meta does currently not resolve tsconfig references (see https://github.com/vuejs/language-tools/issues/3896)
    // so we will return the defaultChecker if references are used.
    // Otherwise vue-component-meta might not work at all for the Storybook docgen.
    const references = await getTsConfigReferences(projectTsConfigPath);

    if (references.length > 0) {
      return defaultChecker;
    }
    return createChecker(projectTsConfigPath, CHECKER_OPTIONS);
  }

  return defaultChecker;
}

/**
 * Extracts and normalizes the meta of every documentable export in one file.
 *
 * Exports whose meta is empty or of an unknown type are dropped, so a file with one non-component
 * export cannot suppress the docgen of its siblings.
 */
export async function collectComponentMetaSources(
  checker: ComponentMetaChecker,
  id: string
): Promise<MetaSource[]> {
  const exportNames: string[] = [];
  let componentsMeta: ComponentMeta[] = [];

  for (const name of checker.getExportNames(id)) {
    try {
      const meta = checker.getComponentMeta(id, name);
      exportNames.push(name);
      componentsMeta.push(meta);
    } catch {}
  }

  if (componentsMeta.length === 0) {
    return [];
  }

  componentsMeta = await applyTempFixForEventDescriptions(id, componentsMeta);

  const metaSources: MetaSource[] = [];

  componentsMeta.forEach((meta, index) => {
    // filter out empty meta
    const isEmpty =
      !meta.props.length && !meta.events.length && !meta.slots.length && !meta.exposed.length;

    if (isEmpty || meta.type === TypeMeta.Unknown) {
      return;
    }

    const exportName = exportNames[index];

    // we remove nested object schemas here since they are not used inside Storybook (we don't generate controls for object properties)
    // and they can cause "out of memory" issues for large/complex schemas (e.g. HTMLElement)
    // it also reduced the bundle size when running "storybook build" when such schemas are used
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

        const hasEvent = meta.events.find((event) => event.name === nameWithoutOnPrefix);
        return !hasEvent;
      })
      // remove duplicated "$slots" expose
      .filter((expose) => {
        if (expose.name === '$slots') {
          const slotNames = meta.slots.map((slot) => slot.name);
          return !slotNames.every((slotName) => expose.type.includes(slotName));
        }
        return true;
      });

    metaSources.push(
      toSerializableMeta({
        exportName,
        displayName: exportName === 'default' ? getFilenameWithoutExtension(id) : exportName,
        ...meta,
        exposed,
        sourceFiles: id,
      })
    );
  });

  return metaSources;
}

/** Gets the filename without file extension. */
function getFilenameWithoutExtension(filename: string) {
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
async function applyTempFixForEventDescriptions(filename: string, componentMeta: ComponentMeta[]) {
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
function removeNestedSchemas(schema: PropertyMetaSchema) {
  if (typeof schema !== 'object') {
    return;
  }
  if (schema.kind === 'enum') {
    // for enum types, we do not want to remove the schemas because otherwise the controls will be missing
    // instead we remove the nested schemas for the enum entries to prevent out of memory errors for types like "HTMLElement | MouseEvent"
    schema.schema?.forEach((enumSchema) => removeNestedSchemas(enumSchema));
    return;
  }
  if (schema.kind === 'literal') {
    // a TS enum member: a qualified name plus the runtime value it stands for, nothing nested
    return;
  }
  delete schema.schema;
}

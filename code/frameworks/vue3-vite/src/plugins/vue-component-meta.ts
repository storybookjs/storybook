import { readFile, stat } from 'node:fs/promises';
import { dirname, join, parse, relative, resolve } from 'node:path';

import findPackageJson from 'find-package-json';
import MagicString from 'magic-string';
import type { PluginOption } from 'vite';
import {
  type ComponentMeta,
  type MetaCheckerOptions,
  type PropertyMetaSchema,
  TypeMeta,
  createChecker,
  createCheckerByJson,
} from 'vue-component-meta';
import { parseMulti } from 'vue-docgen-api';

type MetaSource = {
  exportName: string;
  displayName: string;
  sourceFiles: string;
} & ComponentMeta &
  MetaCheckerOptions['schema'];

export async function vueComponentMeta(tsconfigPath = 'tsconfig.json'): Promise<PluginOption> {
  const { createFilter } = await import('vite');

  // exclude stories, virtual modules and storybook internals
  const exclude =
    /\.stories\.(ts|tsx|js|jsx)$|^\/virtual:|^\/sb-preview\/|\.storybook\/.*\.(ts|js)$/;
  const include = /\.(vue|ts|js|tsx|jsx)$/;
  const filter = createFilter(include, exclude);

  const checker = await createVueComponentMetaChecker(tsconfigPath);

  return {
    name: 'storybook:vue-component-meta-plugin',
    async transform(src, id) {
      if (!filter(id)) {
        return undefined;
      }

      try {
        const exportNames = checker.getExportNames(id);
        let componentsMeta = exportNames.map((name) => checker.getComponentMeta(id, name));
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

          const exposed =
            // the meta also includes duplicated entries in the "exposed" array with "on"
            // prefix (e.g. onClick instead of click), so we need to filter them out here
            meta.exposed
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
              });

          metaSources.push({
            exportName,
            displayName: exportName === 'default' ? getFilenameWithoutExtension(id) : exportName,
            ...meta,
            exposed,
            sourceFiles: id,
          });
        });

        // if there is no component meta, return undefined

        // if there is no component meta, return undefined
        if (metaSources.length === 0) {
          return undefined;
        }

        const s = new MagicString(src);

        metaSources.forEach((meta) => {
          const isDefaultExport = meta.exportName === 'default';
          const name = isDefaultExport ? '_sfc_main' : meta.exportName;

          // we can only add the "__docgenInfo" to variables that are actually defined in the current file
          // so e.g. re-exports like "export { default as MyComponent } from './MyComponent.vue'" must be ignored
          // to prevent runtime errors
          if (
            new RegExp(`export {.*${name}.*}`).test(src) ||
            new RegExp(`export \\* from ['"]\\S*${name}['"]`).test(src) ||
            // when using re-exports, some exports might be resolved via checker.getExportNames
            // but are not directly exported inside the current file so we need to ignore them too
            !src.includes(name)
          ) {
            return;
          }

          if (!id.endsWith('.vue') && isDefaultExport) {
            // we can not add the __docgenInfo if the component is default exported directly
            // so we need to safe it to a variable instead and export default it instead
            s.replace('export default ', 'const _sfc_main = ');
            s.append('\nexport default _sfc_main;');
          }

          s.append(`\n;${name}.__docgenInfo = ${JSON.stringify(meta)}`);
        });

        return {
          code: s.toString(),
          map: s.generateMap({ hires: true, source: id }),
        };
      } catch (e) {
        return undefined;
      }
    },
  };
}

/**
 * Creates the `vue-component-meta` checker to use for extracting component meta/docs. Considers the
 * given tsconfig file (will use a fallback checker if it does not exist or is not supported).
 */
async function createVueComponentMetaChecker(tsconfigPath = 'tsconfig.json') {
  const checkerOptions: MetaCheckerOptions = {
    forceUseTs: true,
    noDeclarations: true,
    printer: { newLine: 1 },
  };

  const projectRoot = getProjectRoot();
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

/** Gets the absolute path to the project root. */
function getProjectRoot() {
  const projectRoot = findPackageJson().next().value?.path ?? '';

  const currentFileDir = dirname(__filename);
  const relativePathToProjectRoot = relative(currentFileDir, projectRoot);

  return resolve(currentFileDir, relativePathToProjectRoot);
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
  delete schema.schema;
}

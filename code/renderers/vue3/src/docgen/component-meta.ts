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
  extractComponentJsDocInfo,
  resolveExportedSymbol,
  type ComponentJsDocInfo,
} from 'storybook/internal/component-meta';

import type ts from 'typescript';
import {
  TypeMeta,
  createChecker,
  createCheckerByJson,
  type ComponentMeta,
  type ComponentMetaChecker,
  type MetaCheckerOptions,
  type PropertyMetaSchema,
  type SlotMeta,
} from 'vue-component-meta';
import { parseMulti, type ComponentDoc } from 'vue-docgen-api';

// Mirrors the JSON round-trip in toSerializableMeta: methods (e.g. `getDeclarations`) do not
// survive it, so their keys are dropped rather than kept as unconstructible phantom fields.
type AnyFunction = (...args: never[]) => unknown;

type Serializable<T> = T extends AnyFunction
  ? never
  : T extends readonly (infer E)[]
    ? Serializable<E>[]
    : T extends object
      ? { [K in keyof T as T[K] extends AnyFunction ? never : K]: Serializable<T[K]> }
      : T;

type MetaSourceEntry = {
  name: string;
  meta: ComponentMeta;
  jsDocInfo: ComponentJsDocInfo | undefined;
};

/** One component's normalized `vue-component-meta` output, tagged with the export it came from. */
export type MetaSource = {
  exportName: string;
  displayName: string;
  sourceFiles: string;
  jsDocTags?: Record<string, string[]>;
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
  id: string,
  typescript?: typeof ts
): Promise<MetaSource[]> {
  let entries: MetaSourceEntry[] = [];

  for (const name of checker.getExportNames(id)) {
    let meta: ComponentMeta | undefined;
    try {
      meta = checker.getComponentMeta(id, name);
    } catch {}

    if (!meta) {
      continue;
    }

    entries.push({
      name,
      meta,
      jsDocInfo: typescript
        ? extractVueComponentJsDocInfo(typescript, checker, id, name)
        : undefined,
    });
  }

  if (entries.length === 0) {
    return [];
  }

  const fixedComponentsMeta = await applyVueDocgenApiTempFixes(
    id,
    entries.map((entry) => entry.meta)
  );
  entries = entries.map((entry, index) => ({ ...entry, meta: fixedComponentsMeta[index]! }));

  const metaSources: MetaSource[] = [];

  entries.forEach(({ name, meta, jsDocInfo }) => {
    // filter out empty meta
    const isEmpty =
      !meta.props.length && !meta.events.length && !meta.slots.length && !meta.exposed.length;

    if (isEmpty || meta.type === TypeMeta.Unknown) {
      return;
    }

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
      // Drop `onX` handler entries duplicating a declared event. Only the prefixed form is a
      // duplicate: an exposed member merely named like an event (`focus` beside a `focus` event)
      // is an authored `defineExpose` member and has to stay.
      .filter((expose) => {
        if (!/^on[A-Z]/.test(expose.name)) {
          return true;
        }

        const eventName = lowercaseFirstLetter(expose.name.slice('on'.length));
        return !meta.events.some((event) => event.name === eventName);
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
        exportName: name,
        displayName: name === 'default' ? getFilenameWithoutExtension(id) : name,
        ...meta,
        description: jsDocInfo?.description,
        jsDocTags: jsDocInfo?.jsDocTags,
        exposed,
        sourceFiles: id,
      })
    );
  });

  return metaSources;
}

function extractVueComponentJsDocInfo(
  typescript: typeof ts,
  checker: ComponentMetaChecker,
  id: string,
  exportName: string
): ComponentJsDocInfo | undefined {
  const program = checker.getProgram();
  const sourceFile = program?.getSourceFile(id.replace(/\\/g, '/'));
  if (!program || !sourceFile) {
    return undefined;
  }

  const typeChecker = program.getTypeChecker();
  const symbol = resolveExportedSymbol(typescript, typeChecker, sourceFile, exportName);
  if (!symbol) {
    return undefined;
  }

  return extractComponentJsDocInfo(typescript, typeChecker, symbol);
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
 * Fills the gaps Volar cannot extract yet from a `vue-docgen-api` parse of the same file:
 *
 * - Event descriptions: https://github.com/vuejs/language-tools/issues/3893
 * - Template-declared slots: Volar only infers slots for `<script setup>` components, so an
 *   Options API component loses every template slot, and `@slot` comment descriptions are never
 *   read for anyone
 *
 * Performance note: `parseMulti` takes a few milliseconds (8-20ms) and only runs when a gap is
 * actually present in the extracted meta. Delete each merge once Volar covers it, and uninstall
 * the vue-docgen-api dependency when both are gone.
 */
export async function applyVueDocgenApiTempFixes(
  filename: string,
  componentsMeta: ComponentMeta[]
): Promise<ComponentMeta[]> {
  const hasEvents = componentsMeta.some((meta) => meta.events.length > 0);
  const needsSlots = await hasTemplateSlotGap(filename, componentsMeta);

  if (!hasEvents && !needsSlots) {
    return componentsMeta;
  }

  try {
    const parsedComponentDocs = await parseMulti(filename);

    componentsMeta.forEach((meta, index) => {
      const parsed = parsedComponentDocs[index];
      if (!parsed) {
        return;
      }
      if (hasEvents) {
        mergeEventDescriptions(meta, parsed.events);
      }
      if (needsSlots) {
        mergeTemplateSlots(meta, parsed.slots);
      }
    });
  } catch {
    // noop
  }

  return componentsMeta;
}

function mergeEventDescriptions(meta: ComponentMeta, events: ComponentDoc['events']): void {
  if (!meta.events.length || !events?.length) {
    return;
  }

  meta.events = meta.events.map((event) => {
    const description = events.find((i) => i.name === event.name)?.description;
    if (description) {
      (event as typeof event & { description: string }).description = description;
    }
    return event;
  });
}

/**
 * Whether the SFC template declares slots that the extracted meta misses, entirely or by
 * description. Reading the source keeps `parseMulti` away from the common slot-less component.
 */
async function hasTemplateSlotGap(
  filename: string,
  componentsMeta: ComponentMeta[]
): Promise<boolean> {
  if (!filename.endsWith('.vue')) {
    return false;
  }

  const hasGap = componentsMeta.some(
    (meta) => meta.slots.length === 0 || meta.slots.some((slot) => !slot.description)
  );
  if (!hasGap) {
    return false;
  }

  try {
    const source = await readFile(filename, 'utf-8');
    return /<slot[\s/>]/.test(source);
  } catch {
    return false;
  }
}

/** Merges template-derived slots into the meta: descriptions onto known slots, missing slots whole. */
function mergeTemplateSlots(meta: ComponentMeta, slots: ComponentDoc['slots']): void {
  for (const slot of slots ?? []) {
    const existing = meta.slots.find((candidate) => candidate.name === slot.name);
    if (existing) {
      if (!existing.description && slot.description) {
        existing.description = slot.description;
      }
      continue;
    }

    const bindings = (slot.bindings ?? [])
      .filter((binding) => binding.name)
      .map((binding) => `${binding.name}: ${binding.type?.name ?? 'unknown'}`);
    const type = bindings.length > 0 ? `{ ${bindings.join('; ')} }` : '{}';
    meta.slots.push({
      name: slot.name,
      description: slot.description ?? '',
      type,
      schema: type,
      tags: [],
    } as unknown as SlotMeta);
  }
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

/** Extraction and normalization of one file's `vue-component-meta` output. */
import { readFile } from 'node:fs/promises';
import { parse } from 'node:path';

import {
  extractComponentJsDocInfo,
  resolveExportedSymbol,
  type ComponentJsDocInfo,
} from 'storybook/internal/component-meta';

import type ts from 'typescript';
import {
  TypeMeta,
  type ComponentMeta,
  type ComponentMetaChecker,
  type MetaCheckerOptions,
  type PropertyMetaSchema,
} from 'vue-component-meta';

import { applyVueDocgenApiTempFixes } from './vue-docgen-api-fixes.ts';

/** One component's normalized `vue-component-meta` output, tagged with the export it came from. */
export type MetaSource = {
  exportName: string;
  displayName: string;
  /** Component-level TypeScript type parameters declared by the SFC. */
  typeParams?: string;
  sourceFiles: string;
  jsDocTags?: Record<string, string[]>;
} & Serializable<ComponentMeta> &
  MetaCheckerOptions['schema'];

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

  const typeParams = await extractVueSfcTypeParams(id);
  const fixedComponentsMeta = await applyVueDocgenApiTempFixes(
    id,
    entries.map((entry) => entry.meta),
    entries.map((entry) => entry.name)
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
        typeParams,
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

async function extractVueSfcTypeParams(id: string): Promise<string | undefined> {
  if (!id.endsWith('.vue')) {
    return undefined;
  }

  try {
    const source = await readFile(id, 'utf-8');
    // Scan open tags one by one: only the `<script setup>` block may declare `generic`, and the
    // attribute value may be unquoted.
    for (const [openTag] of source.matchAll(/<script\b(?:"[^"]*"|'[^']*'|[^'">])*>/gi)) {
      if (!/\bsetup\b/.test(openTag)) {
        continue;
      }
      const generic = openTag.match(/\bgeneric\s*=\s*(?:(["'])(.*?)\1|([^\s'">]+))/);
      return generic?.[2] ?? generic?.[3];
    }
    return undefined;
  } catch {
    return undefined;
  }
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

function toSerializableMeta<T>(obj: T): Serializable<T> {
  return JSON.parse(JSON.stringify(obj)) as Serializable<T>;
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

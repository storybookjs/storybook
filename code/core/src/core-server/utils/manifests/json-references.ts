import { readFile } from 'node:fs/promises';

import {
  docgenManifestRef,
  docgenPayloadJsonPointer,
  docgenStaticStorePath,
} from '../../../shared/open-service/services/docgen/paths.ts';
import type { DocgenPayload } from '../../../shared/open-service/services/docgen/types.ts';
import type { ComponentManifest, ComponentsManifest } from '../../../types/modules/core-common.ts';

import { join } from 'pathe';

/** Version for ref-based `manifests/components.json` (nested `docgen.$ref` index rows). */
export const COMPONENTS_REF_MANIFEST_VERSION = 1;

export type JsonRef = { $ref: string };

/**
 * One component row in the ref-based `manifests/components.json` index.
 *
 * Summary fields are inlined for cheap listing; full docgen lives behind nested `docgen.$ref`.
 */
export type ComponentManifestIndexEntry = {
  id: string;
  name: string;
  description?: string;
  summary?: string;
  docgen?: JsonRef;
};

export type ComponentsRefManifest = {
  v: number;
  components: Record<string, ComponentManifestIndexEntry>;
  meta?: ComponentsManifest['meta'];
};

export function isJsonRef(value: unknown): value is JsonRef {
  return (
    typeof value === 'object' &&
    value !== null &&
    '$ref' in value &&
    typeof (value as JsonRef).$ref === 'string'
  );
}

/** Splits an RFC 6901 JSON Pointer into unescaped reference tokens (without the leading empty segment). */
export function parseJsonPointer(pointer: string): string[] {
  if (pointer === '') {
    return [];
  }
  if (!pointer.startsWith('/')) {
    throw new Error(`JSON Pointer must start with "/" or be empty, got: ${pointer}`);
  }

  return pointer
    .slice(1)
    .split('/')
    .map((token) => token.replaceAll('~1', '/').replaceAll('~0', '~'));
}

/** Resolves an RFC 6901 pointer against a JSON document (read-only). */
export function resolveJsonPointer(document: unknown, pointer: string): unknown {
  const tokens = parseJsonPointer(pointer);
  let current: unknown = document;

  for (const token of tokens) {
    if (current === null || typeof current !== 'object') {
      throw new Error(`JSON Pointer segment "${token}" reached a non-object value`);
    }
    if (!(token in (current as Record<string, unknown>))) {
      throw new Error(`JSON Pointer segment "${token}" not found in document`);
    }
    current = (current as Record<string, unknown>)[token];
  }

  return current;
}

function splitJsonRef(ref: string): { filePath: string; pointer: string } {
  const hashIndex = ref.indexOf('#');
  if (hashIndex === -1) {
    return { filePath: ref, pointer: '' };
  }
  return {
    filePath: ref.slice(0, hashIndex),
    pointer: ref.slice(hashIndex + 1),
  };
}

function resolveJsonRef(ref: string, resolveFile: (filePath: string) => unknown): unknown {
  const { filePath, pointer } = splitJsonRef(ref);
  const document = resolveFile(filePath);
  return pointer ? resolveJsonPointer(document, pointer) : document;
}

/**
 * Walks a JSON value and replaces every `{ "$ref": "<path>#<pointer>" }` leaf with the resolved
 * value. Single-hop only: resolved values are not scanned for further refs.
 */
export function followJsonReferences<T>(
  root: T,
  resolveFile: (filePath: string) => unknown
): T {
  const fileCache = new Map<string, unknown>();

  const cachedResolveFile = (filePath: string) => {
    const cached = fileCache.get(filePath);
    if (cached !== undefined) {
      return cached;
    }
    const document = resolveFile(filePath);
    fileCache.set(filePath, document);
    return document;
  };

  const walk = (value: unknown): unknown => {
    if (isJsonRef(value)) {
      return resolveJsonRef(value.$ref, cachedResolveFile);
    }

    if (Array.isArray(value)) {
      return value.map(walk);
    }

    if (value !== null && typeof value === 'object') {
      return Object.fromEntries(
        Object.entries(value as Record<string, unknown>).map(([key, entry]) => [key, walk(entry)])
      );
    }

    return value;
  };

  return walk(root) as T;
}

function pickIndexFieldsFromPayload(
  payload: unknown,
  componentId: string
): ComponentManifestIndexEntry {
  if (!payload || typeof payload !== 'object') {
    return { id: componentId, name: componentId };
  }

  const docgen = payload as DocgenPayload;

  return {
    id: docgen.id ?? componentId,
    name: docgen.name ?? componentId,
    ...(docgen.description !== undefined ? { description: docgen.description } : {}),
    ...(docgen.summary !== undefined ? { summary: docgen.summary } : {}),
  };
}

function hasDocgenPayload(payload: unknown): payload is DocgenPayload {
  return payload !== null && typeof payload === 'object';
}

/**
 * Reads built docgen service snapshots from disk and builds index entries for
 * `manifests/components.json`.
 *
 * When a snapshot is missing or has no payload for the component id, writes summary fields only
 * (no `docgen` ref).
 */
export async function loadComponentManifestIndexEntriesFromDisk(
  outputDir: string,
  manifestComponentIds: string[]
): Promise<Record<string, ComponentManifestIndexEntry>> {
  const entries = await Promise.all(
    manifestComponentIds.map(async (componentId) => {
      const snapshotPath = join(outputDir, 'services', ...docgenStaticStorePath(componentId).split('/'));

      try {
        const document = JSON.parse(await readFile(snapshotPath, 'utf8')) as unknown;
        const payload = resolveJsonPointer(document, docgenPayloadJsonPointer(componentId));
        const indexEntry = pickIndexFieldsFromPayload(payload, componentId);

        if (!hasDocgenPayload(payload)) {
          return [componentId, indexEntry] as const;
        }

        return [
          componentId,
          {
            ...indexEntry,
            docgen: { $ref: docgenManifestRef(componentId) },
          },
        ] as const;
      } catch {
        return [componentId, { id: componentId, name: componentId }] as const;
      }
    })
  );

  return Object.fromEntries(entries);
}

/** Builds a ref-based components manifest index (paths relative to `manifests/`). */
export function buildComponentsRefManifest(
  components: Record<string, ComponentManifestIndexEntry>,
  meta?: ComponentsManifest['meta']
): ComponentsRefManifest {
  return {
    v: COMPONENTS_REF_MANIFEST_VERSION,
    components,
    ...(meta ? { meta } : {}),
  };
}

/**
 * Follows nested `docgen.$ref` entries in a ref-based components manifest and returns a
 * {@link ComponentsManifest} for consumers that need fully materialized component rows.
 */
export function dereferenceComponentsManifest(
  refManifest: ComponentsRefManifest,
  resolveFile: (filePath: string) => unknown
): ComponentsManifest {
  const deref = followJsonReferences(refManifest, resolveFile);
  const components: Record<string, ComponentManifest> = {};

  for (const [componentId, entry] of Object.entries(deref.components)) {
    const docgen = entry.docgen;
    if (docgen && !isJsonRef(docgen)) {
      components[componentId] = docgen;
    }
  }

  return {
    v: refManifest.v,
    components,
    ...(refManifest.meta ? { meta: refManifest.meta } : {}),
  };
}

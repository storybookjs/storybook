import { readFile } from 'node:fs/promises';

import {
  docgenManifestRef,
  docgenStaticStorePath,
} from '../../../shared/open-service/services/docgen/paths.ts';
import type { DocgenPayload } from '../../../shared/open-service/services/docgen/types.ts';
import type { ComponentsManifest } from '../../../types/modules/core-common.ts';

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

/** Reads one component's docgen payload out of a built snapshot document, if present. */
function readSnapshotPayload(document: unknown, id: string): DocgenPayload | undefined {
  const components = (document as { components?: Record<string, unknown> } | null)?.components;
  const payload = components?.[id];
  return payload !== null && typeof payload === 'object' ? (payload as DocgenPayload) : undefined;
}

/**
 * Reads the built docgen service snapshots for the given component ids from disk.
 *
 * Returns only the ids with a readable payload; missing files and empty snapshots are skipped. The
 * same payloads back both `manifests/components.json` and the components HTML debugger, so the static
 * build reads docgen once instead of re-extracting it from the live service.
 */
export async function loadDocgenPayloadsFromDisk(
  outputDir: string,
  componentIds: string[]
): Promise<Record<string, DocgenPayload>> {
  const entries = await Promise.all(
    componentIds.map(async (id) => {
      const snapshotPath = join(outputDir, 'services', ...docgenStaticStorePath(id).split('/'));

      try {
        const document = JSON.parse(await readFile(snapshotPath, 'utf8')) as unknown;
        const payload = readSnapshotPayload(document, id);
        return payload ? ([id, payload] as const) : null;
      } catch {
        return null;
      }
    })
  );

  return Object.fromEntries(entries.filter((entry) => entry !== null));
}

/**
 * Builds `manifests/components.json` index rows for the given component ids.
 *
 * Components with a docgen payload get inlined summary fields plus a nested `docgen.$ref`; components
 * without one (no readable snapshot) get summary fields only.
 */
export function toComponentManifestIndexEntries(
  componentIds: string[],
  payloads: Record<string, DocgenPayload>
): Record<string, ComponentManifestIndexEntry> {
  const entries: Record<string, ComponentManifestIndexEntry> = {};

  for (const id of componentIds) {
    const payload = payloads[id];
    entries[id] = payload
      ? {
          id: payload.id ?? id,
          name: payload.name ?? id,
          ...(payload.description !== undefined ? { description: payload.description } : {}),
          ...(payload.summary !== undefined ? { summary: payload.summary } : {}),
          docgen: { $ref: docgenManifestRef(id) },
        }
      : { id, name: id };
  }

  return entries;
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

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

/** Index row used when a component has no readable docgen snapshot (no `docgen` ref). */
function minimalIndexEntry(id: string): ComponentManifestIndexEntry {
  return { id, name: id };
}

/** Reads one component's docgen payload out of a built snapshot document, if present. */
function readSnapshotPayload(document: unknown, id: string): DocgenPayload | undefined {
  const components = (document as { components?: Record<string, unknown> } | null)?.components;
  const payload = components?.[id];
  return payload !== null && typeof payload === 'object' ? (payload as DocgenPayload) : undefined;
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
    manifestComponentIds.map(async (id) => {
      const snapshotPath = join(outputDir, 'services', ...docgenStaticStorePath(id).split('/'));

      try {
        const document = JSON.parse(await readFile(snapshotPath, 'utf8')) as unknown;
        const payload = readSnapshotPayload(document, id);

        if (!payload) {
          return [id, minimalIndexEntry(id)] as const;
        }

        return [
          id,
          {
            id: payload.id ?? id,
            name: payload.name ?? id,
            ...(payload.description !== undefined ? { description: payload.description } : {}),
            ...(payload.summary !== undefined ? { summary: payload.summary } : {}),
            docgen: { $ref: docgenManifestRef(id) },
          },
        ] as const;
      } catch {
        return [id, minimalIndexEntry(id)] as const;
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

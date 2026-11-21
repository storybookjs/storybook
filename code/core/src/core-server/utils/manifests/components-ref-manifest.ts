import { readFile } from 'node:fs/promises';

import {
  docgenManifestRef,
  docgenStaticStorePath,
} from '../../../shared/open-service/services/docgen/paths.ts';
import type { DocgenPayload } from '../../../shared/open-service/services/docgen/types.ts';
import {
  storyDocsManifestRef,
  storyDocsStaticStorePath,
} from '../../../shared/open-service/services/story-docs/paths.ts';
import type { StoryDocsPayload } from '../../../shared/open-service/services/story-docs/types.ts';
import { getOwn } from '../../../shared/open-service/plain-object.ts';
import { readComponent } from '../../../shared/open-service/services/component-state-key.ts';
import type { ComponentManifest, ComponentsManifest } from '../../../types/modules/core-common.ts';

import { join } from 'pathe';

import type { DocsManifestEntry, JsonRef } from './mdx-manifest.ts';

/** Version for ref-based `manifests/components.json` (nested `docgen.$ref` index rows). */
export const COMPONENTS_REF_MANIFEST_VERSION = 1;

/**
 * One component row in the ref-based `manifests/components.json` index.
 *
 * Summary fields are inlined for cheap listing; full docgen, story-docs, and MDX live behind nested
 * `$ref`s.
 */
export type ComponentManifestIndexEntry = {
  id: string;
  name: string;
  description?: string;
  summary?: string;
  docgen?: JsonRef;
  stories?: JsonRef;
  docs?: Record<string, DocsManifestEntry>;
};

export type ComponentsRefManifest = {
  v: number;
  components: Record<string, ComponentManifestIndexEntry>;
  meta?: ComponentsManifest['meta'];
};

export type ComponentManifestWithStoryDocs = Omit<ComponentManifest, 'stories'> & {
  stories: StoryDocsPayload['stories'];
};

function readDocgenSnapshotPayload(document: unknown, id: string): DocgenPayload | undefined {
  const components = (document as { components?: Record<string, unknown> } | null)?.components;
  const payload = components && readComponent(components, id);
  return payload !== null && typeof payload === 'object' ? (payload as DocgenPayload) : undefined;
}

function readStoryDocsSnapshotPayload(document: unknown, id: string): StoryDocsPayload | undefined {
  const components = (document as { components?: Record<string, unknown> } | null)?.components;
  const payload = components && readComponent(components, id);
  return payload !== null && typeof payload === 'object'
    ? (payload as StoryDocsPayload)
    : undefined;
}

/**
 * Merges docgen and story-docs open-service payloads into the combined {@link ComponentManifest}
 * shape expected by the HTML debugger.
 */
export function mergeManifestPayloads(
  docgen: DocgenPayload,
  storyDocs?: StoryDocsPayload
): ComponentManifestWithStoryDocs {
  // `docsDescription` is for the Docs `Description` block only; the manifest renders `description`
  // and `jsDocTags` itself.
  const { docsDescription: _docsDescription, ...component } = docgen;
  return {
    ...component,
    stories: storyDocs?.stories ?? {},
    ...(storyDocs?.import ? { import: storyDocs.import } : {}),
  };
}

/**
 * Reads the built docgen service snapshots for the given component ids from disk.
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
        const payload = readDocgenSnapshotPayload(document, id);
        return payload ? ([id, payload] as const) : null;
      } catch {
        return null;
      }
    })
  );

  return Object.fromEntries(entries.filter((entry) => entry !== null));
}

/**
 * Reads the built story-docs service snapshots for the given component ids from disk.
 */
export async function loadStoryDocsPayloadsFromDisk(
  outputDir: string,
  componentIds: string[]
): Promise<Record<string, StoryDocsPayload>> {
  const entries = await Promise.all(
    componentIds.map(async (id) => {
      const snapshotPath = join(outputDir, 'services', ...storyDocsStaticStorePath(id).split('/'));

      try {
        const document = JSON.parse(await readFile(snapshotPath, 'utf8')) as unknown;
        const payload = readStoryDocsSnapshotPayload(document, id);
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
 */
export function toComponentManifestIndexEntries(
  componentIds: string[],
  docgenPayloads: Record<string, DocgenPayload>,
  storyDocsPayloads: Record<string, StoryDocsPayload> = {},
  docsByComponentId: Record<string, Record<string, DocsManifestEntry>> = {}
): Record<string, ComponentManifestIndexEntry> {
  const entries: Record<string, ComponentManifestIndexEntry> = {};

  for (const id of componentIds) {
    const payload = getOwn(docgenPayloads, id);
    const storyDocs = getOwn(storyDocsPayloads, id);
    const docs = getOwn(docsByComponentId, id);
    entries[id] = {
      id: payload?.id ?? id,
      name: payload?.name ?? id,
      ...(payload?.description !== undefined ? { description: payload.description } : {}),
      ...(payload?.summary !== undefined ? { summary: payload.summary } : {}),
      ...(payload ? { docgen: { $ref: docgenManifestRef(id) } } : {}),
      // Stories are indexed whether or not a component was extracted, so the ref does not hang off
      // the docgen payload: dropping it hid every story of a componentless component.
      ...(storyDocs ? { stories: { $ref: storyDocsManifestRef(id) } } : {}),
      ...(docs ? { docs } : {}),
    };
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

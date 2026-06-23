/**
 * Resolves MDX `$ref` rows in docs/component manifests to their full payloads.
 *
 * A single traversal (`resolveDocsRecord`) is parameterized by:
 *
 * - a {@link RefLoader} — where the referenced document comes from (an on-disk snapshot for the
 *   static build, or the live service for dev), and
 * - an {@link EntryTransform} — how much of the resolved payload to keep (the full payload for the
 *   HTML debugger, or just the summary for the shallow JSON index).
 *
 * The `$ref` is always the source of truth: both loaders resolve the same JSON pointer against the
 * same document shape (`{ components: Record<id, MdxPayload> }`), so disk and service paths never
 * diverge.
 */
import { readFile } from 'node:fs/promises';

import type { Manifests } from 'storybook/internal/types';

import { join } from 'pathe';
import invariant from 'tiny-invariant';

import { getService } from '../../../shared/open-service/server.ts';
import type { DocgenPayload } from '../../../shared/open-service/services/docgen/types.ts';
import type { ComponentManifestWithStoryDocs } from './components-ref-manifest.ts';
import {
  MDX_SERVICE_ID,
  type DocsManifestEntry,
  type DocsManifestRefEntry,
  type JsonRef,
  type MdxDocPayload,
  type MdxPayload,
  type MdxRefDocument,
  type MdxServiceContract,
} from './mdx-manifest.ts';
import type { DocsManifest } from './render-components-manifest.ts';

type ComponentsWithDocs = {
  components?: Record<string, { docs?: Record<string, DocsManifestEntry> }>;
};

/** Loads the referenced document for one `$ref` relative path (cached per pass to dedupe reads). */
type RefLoader = (relativePath: string) => Promise<unknown> | unknown;

/** Projects a resolved payload onto the manifest entry that replaces the `$ref` row. */
type EntryTransform = (entry: DocsManifestRefEntry, resolved: MdxDocPayload) => DocsManifestEntry;

/** Keeps the full resolved payload (HTML debugger). */
export const fullTransform: EntryTransform = (_entry, resolved) => resolved;

/** Keeps the shallow `$ref` row, layering in the resolved summary (JSON index). */
export const shallowSummaryTransform: EntryTransform = (entry, resolved) =>
  resolved.summary !== undefined ? { ...entry, summary: resolved.summary } : entry;

export function hasMdxRef(entry: DocsManifestEntry | undefined): entry is DocsManifestRefEntry {
  return typeof entry?.mdx?.$ref === 'string';
}

/** Reads MDX snapshots from `outputDir/manifests/<relativePath>`, deduping repeated reads. */
export function createDiskLoader(outputDir: string): RefLoader {
  const cache = new Map<string, Promise<unknown>>();
  return (relativePath) => {
    let pending = cache.get(relativePath);
    if (!pending) {
      pending = readFile(join(outputDir, 'manifests', relativePath), 'utf8').then(
        (raw) => JSON.parse(raw) as unknown
      );
      cache.set(relativePath, pending);
    }
    return pending;
  };
}

/** Serves every ref from the in-memory service output, ignoring the per-component relative path. */
export function createServiceLoader(mdxPayloads: Record<string, MdxPayload>): RefLoader {
  const document: MdxRefDocument = { components: mdxPayloads };
  return () => document;
}

function getJsonPointerValue(document: unknown, pointer: string): unknown {
  if (pointer === '' || pointer === '/') {
    return document;
  }

  return pointer
    .split('/')
    .slice(1)
    .map((part) => part.replace(/~1/g, '/').replace(/~0/g, '~'))
    .reduce((value, key) => (value as Record<string, unknown> | undefined)?.[key], document);
}

async function resolveRef(ref: JsonRef, load: RefLoader): Promise<MdxDocPayload> {
  const [relativePath, pointer = ''] = ref.$ref.split('#');
  invariant(relativePath, `Invalid MDX manifest ref "${ref.$ref}"`);
  const document = await load(relativePath);
  const value = getJsonPointerValue(document, pointer);
  invariant(
    value && typeof value === 'object',
    `MDX manifest ref "${ref.$ref}" did not resolve to an object`
  );
  return value as MdxDocPayload;
}

async function resolveDocsRecord(
  docs: Record<string, DocsManifestEntry> = {},
  load: RefLoader,
  transform: EntryTransform
): Promise<Record<string, DocsManifestEntry>> {
  const entries = await Promise.all(
    Object.entries(docs).map(async ([id, entry]) =>
      hasMdxRef(entry)
        ? ([id, transform(entry, await resolveRef(entry.mdx, load))] as const)
        : ([id, entry] as const)
    )
  );

  return Object.fromEntries(entries);
}

/** Attached docs (`$ref` rows) grouped by their owning component id. */
export function getAttachedDocsByComponent(
  manifest: Manifests['components']
): Record<string, Record<string, DocsManifestEntry>> {
  const components = (manifest as ComponentsWithDocs | undefined)?.components ?? {};
  return Object.fromEntries(
    Object.entries(components).flatMap(([id, component]) =>
      component.docs ? ([[id, component.docs] as const] as const) : []
    )
  );
}

export function hasMdxRefs(manifests: Manifests, docsManifest?: DocsManifest): boolean {
  const hasUnattachedRefs = Object.values(docsManifest?.docs ?? {}).some((entry) =>
    hasMdxRef(entry as DocsManifestEntry)
  );
  const hasAttachedRefs = Object.values(getAttachedDocsByComponent(manifests.components)).some(
    (docs) => Object.values(docs).some((entry) => hasMdxRef(entry))
  );

  return hasUnattachedRefs || hasAttachedRefs;
}

/** Minimal docgen payload for components that only have attached MDX docs. */
export function createDocsOnlyDocgenPayload(id: string): DocgenPayload {
  return { id, name: id, path: '', jsDocTags: {}, stories: [] };
}

/** Resolves attached doc `$ref`s on each component payload (HTML debugger). */
export async function resolveComponentDocs(
  components: Record<string, ComponentManifestWithStoryDocs>,
  manifests: Manifests,
  load: RefLoader,
  transform: EntryTransform
): Promise<Record<string, ComponentManifestWithStoryDocs>> {
  const docsByComponentId = getAttachedDocsByComponent(manifests.components);
  const allIds = new Set([...Object.keys(components), ...Object.keys(docsByComponentId)]);

  const entries = await Promise.all(
    [...allIds].map(async (id) => {
      const docs = docsByComponentId[id];
      const component =
        components[id] ??
        ({
          ...createDocsOnlyDocgenPayload(id),
          stories: {},
        } satisfies ComponentManifestWithStoryDocs);

      if (!docs) {
        return [id, component] as const;
      }

      return [id, { ...component, docs: await resolveDocsRecord(docs, load, transform) }] as const;
    })
  );

  return Object.fromEntries(entries);
}

/** Resolves unattached doc `$ref`s in the docs manifest. */
export async function resolveDocsManifestRefs(
  docsManifest: DocsManifest | undefined,
  load: RefLoader,
  transform: EntryTransform
): Promise<DocsManifest | undefined> {
  if (!docsManifest) {
    return undefined;
  }

  return {
    ...docsManifest,
    docs: (await resolveDocsRecord(
      docsManifest.docs as Record<string, DocsManifestEntry>,
      load,
      transform
    )) as DocsManifest['docs'],
  };
}

/** Layers resolved summaries into attached `$ref` rows (shallow `components.json` index). */
export async function injectAttachedDocsSummaries(
  attachedByComponent: Record<string, Record<string, DocsManifestEntry>>,
  load: RefLoader
): Promise<Record<string, Record<string, DocsManifestEntry>>> {
  const entries = await Promise.all(
    Object.entries(attachedByComponent).map(
      async ([id, docs]) =>
        [id, await resolveDocsRecord(docs, load, shallowSummaryTransform)] as const
    )
  );

  return Object.fromEntries(entries);
}

/** Loads every MDX payload from the live service, or `{}` when no `$ref`s are present (dev). */
export async function loadMdxPayloadsFromServiceIfNeeded(
  manifests: Manifests,
  docsManifest?: DocsManifest
): Promise<Record<string, MdxPayload>> {
  if (!hasMdxRefs(manifests, docsManifest)) {
    return {};
  }

  const mdxService = getService<MdxServiceContract>(MDX_SERVICE_ID);
  return mdxService.queries.getMdxForAllComponents.loaded();
}

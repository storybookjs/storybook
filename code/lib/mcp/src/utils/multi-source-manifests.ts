/**
 * The package's published multi-source manifest API.
 *
 * The docs tools no longer go through this — they read composed sources through the shared toolset
 * — but embedders import it directly, so it stays part of the public surface with its original
 * signature and flat result shape.
 */

import {
  createCompositionDocsSources,
  listSources,
  type ManifestProvider,
  type Source,
  type SourceListing,
} from 'storybook/internal/toolsets-docs';

import type { SourceManifests } from '../types.ts';

/**
 * Flattens a source listing into this package's published shape.
 *
 * The toolset nests a source's manifests under `manifests`; every consumer of this package reads
 * `componentManifest` and `docsManifest` directly off the source, and that is contractual.
 */
export function toSourceManifests(listing: SourceListing): SourceManifests {
  const { source, manifests, error, notice } = listing;
  return {
    source,
    componentManifest: manifests?.componentManifest ?? { v: 1 as const, components: {} },
    ...(manifests?.docsManifest ? { docsManifest: manifests.docsManifest } : {}),
    ...(error ? { error } : {}),
    ...(notice ? { notice } : {}),
  };
}

/**
 * Fetches every source's manifests, capturing a failure as that source's own outcome rather than
 * losing the whole listing. Throws only when no source produced anything usable.
 */
export async function getMultiSourceManifests(
  sources: Source[],
  request?: Request,
  manifestProvider?: ManifestProvider
): Promise<SourceManifests[]> {
  const listings = await listSources(
    createCompositionDocsSources({ sources, manifestProvider, getRequest: () => request }),
    { withStoryIds: false }
  );

  return listings.map(toSourceManifests);
}

/**
 * Composition support for the docs toolset.
 *
 * A composed Storybook is not a different kind of docs engine — it is several of the same one. So
 * composition is modelled as a set of {@link DocsAccess} instances, one per source, rather than a
 * parallel implementation: whatever backs a single Storybook (manifests over HTTP, the open
 * services in-process) backs one source of a composition unchanged.
 *
 * What composition does add is per-source failure isolation when listing; routing a lookup to the
 * source the caller named is the toolset's job, since only it knows how to explain a bad id.
 */

import { createProviderDocsAccess, type ManifestProvider } from './access-provider.ts';
import type { DocsAccess, ResolvedDocsEntry } from './access.ts';
import {
  ManifestGetError,
  RequiresOwnMcpError,
  type Source,
  type SourceListing,
} from './sources.ts';

/** One composed source and the access that reads it. */
export type DocsSource = {
  source: Source;
  access: DocsAccess;
};

export type CompositionDocsSourcesOptions = {
  sources: Source[];
  manifestProvider?: ManifestProvider;
  getRequest?: () => Request | undefined;
  /**
   * Reads the local Storybook — the source with no `url` — instead of fetching manifests from it.
   * The dev server passes its service-backed access here when `experimentalDocgenServer` is on,
   * where the local `/manifests/*.json` are deliberately 404'd and the data lives in the services.
   */
  localAccess?: DocsAccess;
  /**
   * Resolves a single entry in-process, short-cutting the manifest index. Part of the hosted
   * package's public context, so it stays available to embedders that supply one.
   */
  resolveEntry?: (id: string, source?: Source) => Promise<ResolvedDocsEntry | undefined>;
};

/**
 * Builds one access per composed source.
 *
 * Remote sources are read through the same provider access a single hosted Storybook uses, which is
 * what lets a composition reuse that implementation rather than a parallel one. The local source
 * may instead be handed a ready-made access, so the dev server reads itself the same way in a
 * composition as it does alone.
 */
export function createCompositionDocsSources({
  sources,
  manifestProvider,
  getRequest,
  localAccess,
  resolveEntry,
}: CompositionDocsSourcesOptions): DocsSource[] {
  return sources.map((source) => ({
    source,
    access:
      localAccess && !source.url
        ? localAccess
        : createProviderDocsAccess({ source, manifestProvider, getRequest, resolveEntry }),
  }));
}

/**
 * Lists every source concurrently, turning a failure into that source's own outcome.
 *
 * One unreachable or private source must not cost the agent the entire listing, which is the whole
 * reason each result is captured rather than awaited together.
 */
export async function listSources(
  sources: DocsSource[],
  options: { withStoryIds: boolean }
): Promise<SourceListing[]> {
  const listings = await Promise.all(
    sources.map(async ({ source, access }): Promise<SourceListing> => {
      try {
        return { source, manifests: await access.list(options) };
      } catch (error) {
        if (error instanceof RequiresOwnMcpError) {
          return { source, notice: { kind: 'requires-own-mcp', endpoint: error.endpoint } };
        }
        return { source, error: error instanceof Error ? error.message : String(error) };
      }
    })
  );

  // Isolation is only worth it while something still reads. If no source produced output at all,
  // a page of repeated errors buries the reason, so report the failure itself.
  const usable = listings.filter((listing) => !listing.error);
  if (usable.length === 0) {
    throw new ManifestGetError(
      `Failed to fetch manifests from any source. Errors:\n${listings
        .map((listing) => `- ${listing.source.title}: ${listing.error}`)
        .join('\n')}`
    );
  }

  return listings;
}

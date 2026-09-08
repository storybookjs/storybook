/**
 * The docs toolset's one environment-specific dependency.
 *
 * Everything that differs between runtimes — live open services, the manifests core builds itself,
 * or manifest files fetched from a hosted Storybook — is hidden behind this seam, so the toolset
 * definition stays a pure mapping from ids to formatted output.
 */

import type {
  AllManifests,
  ComponentManifest,
  ComponentManifestV1,
  Doc,
  DocV1,
} from './manifest-formatter/manifest-types.ts';

/**
 * One fully-assembled entry: docgen, stories, and MDX content already merged. This is the shape the
 * Markdown formatters consume, which is why it uses the inline manifest types rather than the
 * shallow index rows `list` returns.
 */
export type ResolvedDocsEntry =
  | { kind: 'component'; component: ComponentManifest }
  | { kind: 'doc'; doc: Doc };

export type DocsAccess = {
  /** Shallow component + standalone-docs index. Story ids are resolved only when requested. */
  list(options: { withStoryIds: boolean }): Promise<AllManifests>;
  /** One component or standalone docs entry, fully assembled; undefined when the id is unknown. */
  resolve(id: string): Promise<ResolvedDocsEntry | undefined>;
};

/** A listing with no components and no standalone docs. */
export function emptyManifests(): AllManifests {
  return { componentManifest: { v: 1, components: {} } };
}

/**
 * Assembles a shallow (v1) listing. The docs manifest is omitted entirely when there are no
 * standalone docs — the formatters read its absence as "print no Docs section".
 */
export function toShallowManifests(
  components: Record<string, ComponentManifestV1>,
  docs: Record<string, DocV1>
): AllManifests {
  return {
    componentManifest: { v: 1, components },
    ...(Object.keys(docs).length > 0 ? { docsManifest: { v: 1, docs } } : {}),
  };
}

/** Open-service id for the story-docs service (also the on-disk directory under `services/`). */
export const STORY_DOCS_SERVICE_ID = 'core/story-docs';

/**
 * Relative path segment for one component's static snapshot file, as returned by the `getStoryDocs`
 * query's `staticPath`. Must stay aligned with {@link storyDocsServiceDef} and manifest `$ref`s.
 */
export function storyDocsQueryStaticPath(id: string): string {
  return `${id}.json`;
}

/** Logical static-store key: `core/story-docs/<id>.json`. */
export function storyDocsStaticStorePath(id: string): string {
  return `${STORY_DOCS_SERVICE_ID}/${storyDocsQueryStaticPath(id)}`;
}

/** JSON Pointer from a story-docs snapshot file root to one component payload in service state. */
export function storyDocsPayloadJsonPointer(id: string): string {
  return `/components/${id}`;
}

/**
 * `$ref` target for one component in `manifests/components.json`, relative to the `manifests/`
 * directory.
 */
export function storyDocsManifestRef(id: string): string {
  return `../services/${storyDocsStaticStorePath(id)}#${storyDocsPayloadJsonPointer(id)}`;
}

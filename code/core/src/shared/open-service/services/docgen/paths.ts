/** Open-service id for the docgen service (also the on-disk directory under `services/`). */
export const DOCGEN_SERVICE_ID = 'core/docgen';

/**
 * Relative path segment for one component's static snapshot file, as returned by the `docgen`
 * query's `staticPath`. Must stay aligned with {@link docgenServiceDef} and manifest `$ref`s.
 */
export function docgenQueryStaticPath(id: string): string {
  return `${id}.json`;
}

/** Logical static-store key: `core/docgen/<id>.json`. */
export function docgenStaticStorePath(id: string): string {
  return `${DOCGEN_SERVICE_ID}/${docgenQueryStaticPath(id)}`;
}

/** JSON Pointer from a docgen snapshot file root to one component payload in service state. */
export function docgenPayloadJsonPointer(id: string): string {
  return `/components/${id}`;
}

/**
 * `$ref` target for one component in `manifests/components.json`, relative to the `manifests/`
 * directory.
 */
export function docgenManifestRef(id: string): string {
  return `../services/${docgenStaticStorePath(id)}#${docgenPayloadJsonPointer(id)}`;
}

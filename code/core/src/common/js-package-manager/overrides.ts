/** Override entries keyed by selector; npm nests entries under a parent package. */
export type Overrides = { [selector: string]: string | Overrides };

/** One field of a manifest or workspace file that forces dependency versions. */
export interface OverrideSource {
  /** File declaring the overrides. */
  path: string;
  /** Field holding them, e.g. `overrides`, `resolutions` or `pnpm.overrides`. */
  field: string;
  /** The field's entries. */
  overrides: Overrides;
}

/**
 * Keeps the entries of an override field that are ranges or nested scopes, or returns `undefined`
 * when the field is not an object.
 */
export function toOverrides(value: unknown): Overrides | undefined {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return undefined;
  }

  return Object.fromEntries(
    Object.entries(value).flatMap(([selector, entry]): [string, string | Overrides][] => {
      // YAML parses a bare pin such as `10` as a number.
      if (typeof entry === 'string' || typeof entry === 'number') {
        return [[selector, String(entry)]];
      }
      const nested = toOverrides(entry);
      return nested ? [[selector, nested]] : [];
    })
  );
}

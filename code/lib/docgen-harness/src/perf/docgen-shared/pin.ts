/**
 * Version pinning, for any engine whose child imports its docgen package by specifier.
 *
 * A pinned engine is the same child harness loading a second, explicitly-versioned copy of that
 * package, installed under an alias in this package's `package.json`
 * (`"vue-component-meta-next": "npm:vue-component-meta@3.3.8"`). `--pin` names the specifier to
 * import; it defaults to the canonical package, so an unpinned run is unchanged.
 */
import { z } from 'zod';

/** Add to a harness's `parseArgs` table to accept `--pin`. */
export const PIN_OPTION = { pin: { type: 'string' } } as const;

/**
 * A pin may only name the canonical package or an alias of it, which are named
 * `<package>-<suffix>` by convention. Checking that is what stops a typo in the registry from
 * silently measuring a different package under the engine's name.
 */
export const isPinOf = (canonical: string, specifier: string): boolean =>
  specifier === canonical || specifier.startsWith(`${canonical}-`);

const pinMessage = (canonical: string) =>
  `must be "${canonical}" or an alias of it ("${canonical}-<suffix>")`;

/** Extends a harness's option schema with `--pin`, defaulting to the canonical package. */
export const pinOption = (canonical: string) =>
  z
    .string()
    .default(canonical)
    .refine((specifier) => isPinOf(canonical, specifier), {
      message: pinMessage(canonical),
    });

/** For an engine that takes its pin straight from the registry rather than through a flag. */
export function assertPin(canonical: string, specifier: string): string {
  if (!isPinOf(canonical, specifier)) {
    throw new Error(`pin "${specifier}" ${pinMessage(canonical)}`);
  }
  return specifier;
}

/**
 * Only the pinned copy is imported. Loading both would leave the unmeasured one's module graph on
 * the heap of every run, shifting a memory number that has nothing to do with the comparison.
 */
export function importPinned<T>(specifier: string): Promise<T> {
  return import(specifier) as Promise<T>;
}

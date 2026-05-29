import type { Options, PresetPropertyFn } from '../../../../types/modules/core-common.ts';
import type { DocgenProvider, DocgenProviderInput, DocgenPayload } from './types.ts';

/**
 * Middleware factory for the `experimental_docgenProvider` preset.
 *
 * Receives the previously accumulated provider as `next` (always defined — core's services
 * preset seeds the chain with an identity provider) and the resolved preset options, and returns
 * a new {@link DocgenProvider}.
 */
export type DocgenProviderMiddleware = (
  next: DocgenProvider,
  options: Options
) => DocgenProvider | Promise<DocgenProvider>;

/**
 * Helper for authoring an `experimental_docgenProvider` preset.
 *
 * Wraps a middleware factory so it conforms to Storybook's preset surface, with two ergonomic
 * upgrades over writing the raw `PresetPropertyFn` by hand:
 *
 * 1. **`next` is non-nullable.** Core's services preset always seeds the chain with an identity
 *    provider, so `next?.(input)` is impossible-state defense. This helper throws clearly if the
 *    seed is ever missing — signaling a preset misconfiguration instead of silently degrading
 *    payloads into empty strings.
 * 2. **One documented merge idiom for providers.** When wrapping `next`, return
 *    `{ ...downstream, ...yourOverrides }` and reach for `downstream?.field ?? yours` (not `||`)
 *    when filling gaps. The spread guarantees that {@link DocgenPayload} fields added by future
 *    providers — or future schema growth — are not silently dropped by a provider that doesn't
 *    know about them. `??` preserves any explicit value downstream produced (including empty
 *    strings), so a downstream provider that intentionally set a field to "" is not overridden
 *    by your own defaults.
 *
 * @example
 *   export const experimental_docgenProvider = defineDocgenProvider((next) => async (input) => {
 *     const downstream = await next(input);
 *     if (!downstream) return undefined; // I'm an enricher, nothing to enrich
 *     return {
 *       ...downstream,
 *       description: `${downstream.description} (enriched)`,
 *     };
 *   });
 */
export function defineDocgenProvider(
  middleware: DocgenProviderMiddleware
): PresetPropertyFn<'experimental_docgenProvider'> {
  return async (next, options) => {
    if (!next) {
      throw new Error(
        '`experimental_docgenProvider` was applied without a downstream provider. ' +
          "The core 'services' preset seeds the chain with an identity provider — if this fires, " +
          'the docgen preset chain is misconfigured.'
      );
    }
    return middleware(next, options);
  };
}

// Re-exporting these so provider authors only need one import path.
export type { DocgenPayload, DocgenProvider, DocgenProviderInput };

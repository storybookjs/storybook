/**
 * Custom matcher that asserts a container includes an aria-live region matching the provided
 * options.
 *
 * Usage:
 *
 * ```ts
 * import { toHaveLiveRegion } from '../path/to/manager/utils/toHaveLiveRegion';
 *
 * expect.extend({ toHaveLiveRegion });
 *
 * expect(canvas).toHaveLiveRegion({ text: 'Tests passed' });
 * expect(canvas).toHaveLiveRegion({ text: /3 tests/, level: 'assertive' });
 * ```
 */

export interface LiveRegionMatcherOptions {
  /** Expected text content (string for exact match, RegExp for pattern). */
  text: string | RegExp;
  /** Expected `aria-live` politeness level. If omitted any level matches. */
  level?: 'polite' | 'assertive';
}

export function toHaveLiveRegion(
  container: HTMLElement,
  options: LiveRegionMatcherOptions
): { pass: boolean; message: () => string } {
  const { text, level } = options;

  // Find all live region elements: elements with explicit aria-live,
  // or implicit live-region roles (status → polite, alert → assertive).
  const liveRegionSelectors = ['[aria-live]', '[role="status"]', '[role="alert"]', '[role="log"]'];
  const candidates = container.querySelectorAll<HTMLElement>(liveRegionSelectors.join(','));

  const matchingRegions: HTMLElement[] = [];

  for (const el of candidates) {
    // Determine the effective politeness level.
    const ariaLive = el.getAttribute('aria-live');
    const role = el.getAttribute('role');

    let effectiveLevel: string | null = ariaLive;
    if (!effectiveLevel) {
      if (role === 'status' || role === 'log') {
        effectiveLevel = 'polite';
      }
      if (role === 'alert') {
        effectiveLevel = 'assertive';
      }
    }

    // Filter by level if provided.
    if (level && effectiveLevel !== level) {
      continue;
    }

    // Filter by text content.
    const content = el.textContent ?? '';
    const textMatches = typeof text === 'string' ? content.includes(text) : text.test(content);

    if (textMatches) {
      matchingRegions.push(el);
    }
  }

  const pass = matchingRegions.length > 0;

  const candidateDetails = Array.from(candidates)
    .map((el) => {
      const ariaLive = el.getAttribute('aria-live') ?? '(implicit)';
      return `  - [aria-live="${ariaLive}"] "${el.textContent?.trim()}"`;
    })
    .join('\n');

  return {
    pass,
    message: () =>
      pass
        ? `Expected container NOT to have a live region matching ${JSON.stringify(options)}, but found one.`
        : `Expected container to have a live region matching ${JSON.stringify(options)}.\n\nFound live regions:\n${candidateDetails || '  (none)'}`,
  };
}

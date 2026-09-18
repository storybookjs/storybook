/**
 * Derives a short docs summary from MDX so ref-based docs manifests can expose `summary` in the
 * same shape `@storybook/mcp` expects.
 *
 * Keep in sync with the fallback copy at
 * `code/lib/mcp/src/utils/manifest-formatter/extract-docs-summary.ts`. Dual copy is intentional:
 * addon-docs must not depend on `@storybook/mcp`, and mcp must not depend on addon-docs.
 */
export const MAX_SUMMARY_LENGTH = 90;

export function extractDocsSummary(content: string): string | undefined {
  let result = content;

  result = result.replace(/^\s*import\s+(?:[\s\S]*?from\s+)?['"][^'"]+['"];?\s*$/gm, '');

  let prevResult = '';
  while (prevResult !== result) {
    prevResult = result;
    result = result.replace(/\{[^{}]*\}/g, '');
  }

  result = result.replace(/<[^>]+\/>/g, '');

  prevResult = '';
  while (prevResult !== result) {
    prevResult = result;
    result = result.replace(/<(\w+)[^>]*>([\s\S]*?)<\/\1>/g, '$2');
  }

  result = result.replace(/<[^>]+>/g, '');
  result = result.replace(/\s+/g, ' ').trim();

  if (!result) {
    return undefined;
  }

  if (result.length > MAX_SUMMARY_LENGTH) {
    return `${result.slice(0, MAX_SUMMARY_LENGTH)}...`;
  }

  return result;
}

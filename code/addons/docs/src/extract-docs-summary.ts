/**
 * Ported from Storybook MCP's manifest formatter so ref-based docs manifests expose summaries in
 * the same shape MCP previously derived itself.
 *
 * Source:
 * https://github.com/storybookjs/mcp/blob/main/packages/mcp/src/utils/manifest-formatter/extract-docs-summary.ts
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

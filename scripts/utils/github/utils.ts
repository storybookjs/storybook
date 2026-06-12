import type { IssueOrPrId } from './types.ts';

const HTML_COMMENT_RE = /<!--[\s\S]*?-->/g;

/**
 * Strip `<!-- ... -->` blocks from a PR body. The Storybook PR template
 * embeds example issue references (e.g. `#1000`, `#1001`) inside comment
 * blocks; without stripping those, every assessment would attribute the
 * template examples as real linked issues. Applied at the fetch boundary so
 * every downstream consumer (linked-issue parser, LLM prompts) sees the
 * cleaned body.
 */
export function stripHtmlComments(body: string): string {
  return body.replace(HTML_COMMENT_RE, '');
}

export function canonical(r: IssueOrPrId): string {
  return `${r.owner}/${r.repo}#${r.number}`;
}

/**
 * Check if a fetch failed due to a specific HTTP status code. Used to distinguish "not found" (404) from other errors in `fetchIssue` and `fetchPr`.
 * @param err The error object thrown by the fetch operation.
 * @param status The HTTP status code to check against (e.g., 404, 410).
 * @returns True if the error is an HTTP error with the specified status code, false otherwise.
 */
export function isHttpError(err: unknown, status: number): boolean {
  if (!err || typeof err !== 'object' || !('status' in err)) return false;
  return (err as { status: unknown }).status === status;
}

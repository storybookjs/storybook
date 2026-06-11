import { getGithubClient } from './client.ts';
import type { GithubRefCoords } from './pr.ts';

function isHttpError(err: unknown, status: number): boolean {
  if (!err || typeof err !== 'object' || !('status' in err)) return false;
  return (err as { status: unknown }).status === status;
}

/**
 * Add labels to a PR or issue. No-op when `labels` is empty so callers can
 * invoke unconditionally with the result of a diff. Uses the issues endpoint
 * — PRs share the issue ID space, so the same path works for both.
 */
export async function addLabels(target: GithubRefCoords, labels: string[]): Promise<void> {
  if (labels.length === 0) return;
  const client = getGithubClient();
  await client.rest('POST /repos/{owner}/{repo}/issues/{issue_number}/labels', {
    owner: target.owner,
    repo: target.repo,
    issue_number: target.number,
    labels,
  });
}

/**
 * Remove labels from a PR or issue. Each label is deleted with its own DELETE
 * call; 404s on a label that isn't present are silently swallowed so callers
 * can pass a "should-not-be-there" set without first checking what's there.
 */
export async function removeLabels(target: GithubRefCoords, labels: string[]): Promise<void> {
  if (labels.length === 0) return;
  const client = getGithubClient();
  for (const label of labels) {
    try {
      await client.rest('DELETE /repos/{owner}/{repo}/issues/{issue_number}/labels/{name}', {
        owner: target.owner,
        repo: target.repo,
        issue_number: target.number,
        name: label,
      });
    } catch (err: unknown) {
      if (isHttpError(err, 404)) continue;
      throw err;
    }
  }
}

import { getGithubClient } from './client.ts';
import type { Issue } from './issue.ts';
import type { PrWithFiles } from './pr.ts';
import type { IssueOrPrId } from './types.ts';

function isHttpError(err: unknown, status: number): boolean {
  if (!err || typeof err !== 'object' || !('status' in err)) return false;
  return (err as { status: unknown }).status === status;
}

/**
 * Add labels to a PR or issue. No-op when `labels` is empty so callers can
 * invoke unconditionally with the result of a diff. Uses the issues endpoint
 * — PRs share the issue ID space, so the same path works for both.
 */
export async function addLabels(target: IssueOrPrId, labels: string[]): Promise<void> {
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
export async function removeLabels(target: IssueOrPrId, labels: string[]): Promise<void> {
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

interface LabelsResponse {
  repository: {
    labels: {
      nodes: Array<{ id: string; name: string; description: string | null }>;
    };
  };
}

const REPO_RE = /^[\w.-]+\/[\w.-]+$/;

/**
 * Resolve a set of label names to their GraphQL node IDs. Useful when a
 * caller needs label IDs to attach via the GraphQL mutation (e.g., the
 * release `addLabelsToLabelable` mutation), as opposed to the REST endpoint
 * which accepts names directly.
 *
 * Throws on a malformed `repo` argument (expects `owner/name`) so misuse
 * fails loudly at the call site rather than producing an empty mapping.
 */
export async function getLabelIds({
  repo: fullRepo,
  labelNames,
}: {
  labelNames: string[];
  repo: string;
}): Promise<Record<string, string>> {
  if (!REPO_RE.test(fullRepo)) {
    throw new Error(
      `getLabelIds: repo must be in the form owner/name (got ${JSON.stringify(fullRepo)}).`
    );
  }
  const client = getGithubClient();
  const [owner, repo] = fullRepo.split('/');
  const result = await client.graphql<LabelsResponse>(
    `
      query ($owner: String!, $repo: String!, $q: String!) {
        repository(owner: $owner, name: $repo) {
          labels(query: $q, first: 10) {
            nodes { id name description }
          }
        }
      }
    `,
    { owner, repo, q: labelNames.join('+') }
  );
  const labelToId: Record<string, string> = {};
  for (const label of result.repository.labels.nodes) {
    labelToId[label.name] = label.id;
  }
  return labelToId;
}

export function getMostSevereLabel(issueOrPr: Issue | PrWithFiles): string | null {
  const severityLabels = issueOrPr.labels.filter((l) => /^sev:S[1-4]$/.test(l));
  return severityLabels.sort()[0] ?? null;
}

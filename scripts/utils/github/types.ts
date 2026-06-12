/**
 * Coordinates for a PR or an issue. The GitHub REST and GraphQL APIs use the
 * same `{owner, repo, number}` shape for both — they share an ID space within
 * a repo — so there's one type for both.
 */
export interface IssueOrPrId {
  owner: string;
  repo: string;
  number: number;
}
/**
 * Common fields for issues and PRs.
 */
export interface FetchedIssueOrPr extends IssueOrPrId {
  url: string;
  title: string;
  body: string;
  state: 'open' | 'closed';
  labels: string[];
  author: string;
}

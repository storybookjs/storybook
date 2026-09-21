export interface PullRequestCoordinates {
  owner: string;
  repo: string;
  number: number;
}

export interface OpinionatedReview {
  authorLogin: string;
  state: 'APPROVED' | 'CHANGES_REQUESTED';
}

type Graphql = <Response>(
  query: string,
  variables: Record<string, string | number>
) => Promise<Response>;

interface LatestOpinionatedReviewsResponse {
  repository: {
    pullRequest: {
      latestOpinionatedReviews: {
        nodes: Array<{
          author: { login: string } | null;
          state: OpinionatedReview['state'];
        } | null>;
      };
    } | null;
  } | null;
}

/**
 * Return each writer's latest approval or change request. GitHub performs the per-user reduction,
 * so an older approval cannot override that user's newer request for changes.
 */
export async function getLatestOpinionatedReviews(
  graphql: Graphql,
  pullRequest: PullRequestCoordinates
): Promise<OpinionatedReview[]> {
  const result = await graphql<LatestOpinionatedReviewsResponse>(
    `
      query LatestOpinionatedReviews($owner: String!, $repo: String!, $number: Int!) {
        repository(owner: $owner, name: $repo) {
          pullRequest(number: $number) {
            latestOpinionatedReviews(first: 100, writersOnly: true) {
              nodes {
                author {
                  login
                }
                state
              }
            }
          }
        }
      }
    `,
    { ...pullRequest }
  );

  return (
    result.repository?.pullRequest?.latestOpinionatedReviews.nodes.flatMap((review) =>
      review?.author ? [{ authorLogin: review.author.login, state: review.state }] : []
    ) ?? []
  );
}

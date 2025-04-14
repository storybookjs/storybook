/**
 * This file is soft-forked from @changesets/get-github-info
 * https://github.com/changesets/changesets/tree/main/packages/get-github-info
 *
 * The only modification is that it also returns the PR title and labels
 */
import DataLoader from 'dataloader';

const validRepoNameRegex = /^[\w.-]+\/[\w.-]+$/;

type RequestData =
  | { kind: 'commit'; repo: string; commit: string }
  | { kind: 'pull'; repo: string; pull: number };

type ReposWithCommitsAndPRsToFetch = Record<
  string,
  ({ kind: 'commit'; commit: string } | { kind: 'pull'; pull: number })[]
>;

function makeQuery(repos: ReposWithCommitsAndPRsToFetch) {
  const query = `
      query {
        ${Object.keys(repos)
          .map(
            (repo, i) =>
              `a${i}: repository(
            owner: ${JSON.stringify(repo.split('/')[0])}
            name: ${JSON.stringify(repo.split('/')[1])}
          ) {
            ${repos[repo]
              .map((data) =>
                data.kind === 'commit'
                  ? `a${data.commit}: object(expression: ${JSON.stringify(data.commit)}) {
            ... on Commit {
            commitUrl
            associatedPullRequests(first: 50) {
              nodes {
                number
                id
                title
                state
                url
                mergedAt
                labels(first: 50) {
                  nodes {
                    name
                  }
                }
                author {
                  login
                  url
                }
              }
            }
            author {
              user {
                login
                url
              }
            }
          }}`
                  : `pr__${data.pull}: pullRequest(number: ${data.pull}) {
                    url
                    title
                    state
                    author {
                      login
                      url
                    }
                    labels(first: 50) {
                      nodes {
                        name
                      }
                    }
                    mergeCommit {
                      commitUrl
                      oid
                    }
                  }`
              )
              .join('\n')}
          }`
          )
          .join('\n')}
        }
    `;
  return query;
}

// why are we using dataloader?
// it provides use with two things
// 1. caching
// since getInfo will be called inside of changeset's getReleaseLine
// and there could be a lot of release lines for a single commit
// caching is important so we don't do a bunch of requests for the same commit
// 2. batching
// getReleaseLine will be called a large number of times but it'll be called at the same time
// so instead of doing a bunch of network requests, we can do a single one.
const GHDataLoader = new DataLoader(
  async (requests: readonly RequestData[]) => {
    if (!process.env.GH_TOKEN) {
      throw new Error(
        'Please create a GitHub personal access token at https://github.com/settings/tokens/new with `read:user` and `repo:status` permissions and add it as the GH_TOKEN environment variable'
      );
    }
    const repos: ReposWithCommitsAndPRsToFetch = {};
    requests.forEach(({ repo, ...data }) => {
      if (repos[repo] === undefined) {
        repos[repo] = [];
      }
      repos[repo].push(data);
    });

    const data = await fetch('https://api.github.com/graphql', {
      method: 'POST',
      headers: {
        Authorization: `Token ${process.env.GH_TOKEN}`,
      },
      body: JSON.stringify({ query: makeQuery(repos) }),
    }).then((x: any) => x.json());

    if (data.errors) {
      throw new Error(
        `An error occurred when fetching data from GitHub\n${JSON.stringify(data.errors, null, 2)}`
      );
    }

    // this is mainly for the case where there's an authentication problem
    if (!data.data) {
      throw new Error(`An error occurred when fetching data from GitHub\n${JSON.stringify(data)}`);
    }

    const cleanedData: Record<string, { commit: Record<string, any>; pull: Record<string, any> }> =
      {};
    Object.keys(repos).forEach((repo, index) => {
      const output: { commit: Record<string, any>; pull: Record<string, any> } = {
        commit: {},
        pull: {},
      };
      cleanedData[repo] = output;
      Object.entries(data.data[`a${index}`]).forEach(([field, value]) => {
        // this is "a" because that's how it was when it was first written, "a" means it's a commit not a pr
        // we could change it to commit__ but then we have to get new GraphQL results from the GH API to put in the tests
        if (field[0] === 'a') {
          output.commit[field.substring(1)] = value;
        } else {
          output.pull[field.replace('pr__', '')] = value;
        }
      });
    });

    return requests.map(
      ({ repo, ...rest }) =>
        cleanedData[repo][rest.kind][rest.kind === 'pull' ? rest.pull : rest.commit]
    );
  },
  { maxBatchSize: 50 }
);

export type PullRequestInfo = {
  user: string | null;
  id: string | null;
  title: string | null;
  state: string | null;
  commit: string | null;
  pull: number | null;
  labels: string[] | null;
  links: {
    commit: string | null;
    pull: string | null;
    user: string | null;
  };
};

export async function getPullInfoFromCommit(request: {
  commit: string;
  repo: string;
}): Promise<PullRequestInfo> {
  if (!request.commit) {
    throw new Error('Please pass a commit SHA to getInfo');
  }

  if (!request.repo) {
    throw new Error('Please pass a GitHub repository in the form of userOrOrg/repoName to getInfo');
  }

  if (!validRepoNameRegex.test(request.repo)) {
    throw new Error(
      `Please pass a valid GitHub repository in the form of userOrOrg/repoName to getInfo (it has to match the "${validRepoNameRegex.source}" pattern)`
    );
  }

  const data = await GHDataLoader.load({ kind: 'commit', ...request });
  if (!data) {
    return {
      id: null,
      user: null,
      pull: null,
      commit: request.commit,
      title: null,
      state: null,
      labels: null,
      links: {
        commit: request.commit,
        pull: null,
        user: null,
      },
    };
  }
  let user = data?.author?.user || null;

  const associatedPullRequest =
    data.associatedPullRequests &&
    data.associatedPullRequests.nodes &&
    data.associatedPullRequests.nodes.length
      ? (data.associatedPullRequests.nodes as any[]).sort((a, b) => {
          if (a.mergedAt === null && b.mergedAt === null) {
            return 0;
          }
          if (a.mergedAt === null) {
            return 1;
          }
          if (b.mergedAt === null) {
            return -1;
          }
          const aDate = new Date(a.mergedAt);
          const bDate = new Date(b.mergedAt);
          if (aDate > bDate) {
            return 1;
          }
          if (aDate < bDate) {
            return -1;
          }
          return 0;
        })[0]
      : null;
  if (associatedPullRequest) {
    user = associatedPullRequest.author;
  }

  return {
    user: user ? user.login : null,
    id: associatedPullRequest ? associatedPullRequest.id : null,
    pull: associatedPullRequest ? associatedPullRequest.number : null,
    commit: request.commit,
    title: associatedPullRequest ? associatedPullRequest.title : null,
    state: associatedPullRequest ? associatedPullRequest.state : null,
    labels: associatedPullRequest
      ? (associatedPullRequest.labels.nodes || []).map((label: { name: string }) => label.name)
      : null,
    links: {
      commit: `[\`${request.commit}\`](${data.commitUrl})`,
      pull: associatedPullRequest
        ? `[#${associatedPullRequest.number}](${associatedPullRequest.url})`
        : null,
      user: user ? `[@${user.login}](${user.url})` : null,
    },
  };
}

export async function getPullInfoFromPullRequest(request: {
  pull: number;
  repo: string;
}): Promise<PullRequestInfo> {
  if (request.pull === undefined) {
    throw new Error('Please pass a pull request number');
  }

  if (!request.repo) {
    throw new Error('Please pass a GitHub repository in the form of userOrOrg/repoName to getInfo');
  }

  if (!validRepoNameRegex.test(request.repo)) {
    throw new Error(
      `Please pass a valid GitHub repository in the form of userOrOrg/repoName to getInfo (it has to match the "${validRepoNameRegex.source}" pattern)`
    );
  }

  const data = await GHDataLoader.load({ kind: 'pull', ...request });
  const user = data?.author;
  const title = data?.title;
  const commit = data?.mergeCommit;

  return {
    user: user ? user.login : null,
    id: null,
    pull: request.pull,
    commit: commit ? commit.oid : null,
    title: title || null,
    state: data?.state || null,
    labels: data ? (data.labels.nodes || []).map((label: { name: string }) => label.name) : null,
    links: {
      commit: commit ? `[\`${commit.oid}\`](${commit.commitUrl})` : null,
      pull: `[#${request.pull}](https://github.com/${request.repo}/pull/${request.pull})`,
      user: user ? `[@${user.login}](${user.url})` : null,
    },
  };
}

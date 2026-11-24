import type { ExecFileSyncOptions } from 'node:child_process';

import { z } from 'zod';

import { gh, ghJson } from '../../scripts/utils/gh.ts';
import type { QaIssue } from './proposals.ts';

const QUIET: ExecFileSyncOptions = { stdio: ['ignore', 'pipe', 'inherit'] };

export const IssueItem = z.object({
  number: z.number(),
  title: z.string(),
  state: z.enum(['open', 'closed']),
  labels: z.array(z.object({ name: z.string() })),
  body: z.string().nullable(),
  comments: z.number(),
  closed_at: z.string().nullable().optional(),
  state_reason: z.string().nullable().optional(),
  pull_request: z.unknown().optional(),
});

export const ghText = (args: string[]): string => gh(args, QUIET).toString();

export const ghParse = <T>(schema: z.ZodType<T>, args: string[]): T =>
  schema.parse(ghJson<unknown>(args, QUIET));

export const pages = <T extends z.ZodType>(item: T, path: string): z.infer<T>[] =>
  ghParse(z.array(z.array(item)), ['api', '--paginate', '--slurp', path]).flat();

export const listRunArtifacts = (repo: string, runId: string) =>
  ghParse(
    z.array(
      z.object({ artifacts: z.array(z.object({ name: z.string(), expires_at: z.string() })) })
    ),
    ['api', '--paginate', '--slurp', `repos/${repo}/actions/runs/${runId}/artifacts?per_page=100`]
  ).flatMap((page) => page.artifacts);

// The filing job writes with the workflow token, so its comments come from this account. Anyone can
// comment on an issue, so no other comment may tie a fingerprint to it.
const HARNESS_LOGIN = 'github-actions[bot]';

export const IssueComment = z.object({
  body: z.string(),
  user: z.object({ login: z.string() }).nullable(),
});

export const harnessComments = (comments: z.infer<typeof IssueComment>[]): string[] =>
  comments
    .filter((comment) => comment.user?.login === HARNESS_LOGIN)
    .map((comment) => comment.body);

export const qaIssuesFrom = (
  items: z.infer<typeof IssueItem>[],
  commentsOf: (issue: number) => string[]
): QaIssue[] =>
  items
    .filter((item) => item.pull_request === undefined)
    .map((item) => ({
      number: item.number,
      title: item.title,
      state: item.state,
      labels: item.labels.map((label) => label.name),
      body: item.body ?? '',
      comments: item.comments > 0 ? commentsOf(item.number) : [],
      ...(item.state === 'closed' && item.state_reason === 'completed' && item.closed_at
        ? { completedAt: item.closed_at }
        : {}),
    }));

// List every issue of `repo` that carries `label`, with the comments the harness wrote on it.
//
// One listing replaces a search per fingerprint, which the search rate limit of 30 a minute cannot
// serve for a whole sweep, and a listing sees an issue the moment it exists while the search index lags.
// The comments take one more request for each issue that has any.
export const listQaIssues = (repo: string, label: string): QaIssue[] =>
  qaIssuesFrom(
    pages(IssueItem, `repos/${repo}/issues?labels=${label}&state=all&per_page=100`),
    (issue) =>
      harnessComments(pages(IssueComment, `repos/${repo}/issues/${issue}/comments?per_page=100`))
  );

const RELEASE_QUERY =
  'query($owner:String!,$name:String!,$tag:String!){repository(owner:$owner,name:$name){release(tagName:$tag){publishedAt}}}';

const ReleaseAnswer = z.object({
  data: z.object({
    repository: z.object({
      release: z.object({ publishedAt: z.string().nullable() }).nullable(),
    }),
  }),
});

export const publishedAtFrom = (answer: unknown): string | undefined =>
  ReleaseAnswer.parse(answer).data.repository.release?.publishedAt ?? undefined;

// Every variable goes as a raw field, so a value that starts with `@` is never read as a file.
const graphqlArgs = (fields: Record<string, string>, paginate = false): string[] => [
  'api',
  'graphql',
  ...(paginate ? ['--paginate', '--slurp'] : []),
  ...Object.entries(fields).flatMap(([key, value]) => ['-f', `${key}=${value}`]),
];

const ownerAndName = (repo: string) => {
  const [owner = '', name = ''] = repo.split('/');
  return { owner, name };
};

// Asked through GraphQL, which answers a missing release with null where REST answers 404.
export const releasePublishedAt = (repo: string, version: string): string | undefined =>
  publishedAtFrom(
    ghJson(graphqlArgs({ query: RELEASE_QUERY, ...ownerAndName(repo), tag: `v${version}` }), QUIET)
  );

export const Actor = z.object({ __typename: z.string(), login: z.string() }).nullable();
export type Actor = z.infer<typeof Actor>;

// GraphQL names the account of the workflow token by its app, without the `[bot]` that REST adds.
// Only an app can be a `Bot`, so no person can take that login.
export const byHarness = (actor: Actor): boolean =>
  actor?.__typename === 'Bot' && `${actor.login}[bot]` === HARNESS_LOGIN;

const ACTORS = 'author{__typename login} editor{__typename login}';

export const Discussion = z.object({
  id: z.string(),
  number: z.number(),
  url: z.string(),
  title: z.string(),
  body: z.string(),
  author: Actor,
  authorAssociation: z.string(),
  editor: Actor,
});
export type Discussion = z.infer<typeof Discussion>;

export const DiscussionComment = z.object({
  id: z.string(),
  url: z.string(),
  body: z.string(),
  author: Actor,
  editor: Actor,
});
export type DiscussionComment = z.infer<typeof DiscussionComment>;

const CATEGORIES_QUERY =
  'query($owner:String!,$name:String!){repository(owner:$owner,name:$name){id discussionCategories(first:100){nodes{id name}}}}';

const CategoriesAnswer = z.object({
  data: z.object({
    repository: z.object({
      id: z.string(),
      discussionCategories: z.object({
        nodes: z.array(z.object({ id: z.string(), name: z.string() })),
      }),
    }),
  }),
});

export type DiscussionPlace = { repositoryId: string; categoryId: string };

export const discussionPlaceFrom = (
  answer: unknown,
  repo: string,
  category: string
): DiscussionPlace => {
  const { repository } = CategoriesAnswer.parse(answer).data;
  const found = repository.discussionCategories.nodes.find(({ name }) => name === category);
  if (!found) {
    throw new Error(
      `${repo} has no discussion category named "${category}". A maintainer adds it with the edit button of Categories on the Discussions tab, and the sweep writes its logbook there.`
    );
  }
  return { repositoryId: repository.id, categoryId: found.id };
};

export const discussionPlace = (repo: string, category: string): DiscussionPlace =>
  discussionPlaceFrom(
    ghJson(graphqlArgs({ query: CATEGORIES_QUERY, ...ownerAndName(repo) }), QUIET),
    repo,
    category
  );

const DISCUSSIONS_QUERY = `query($owner:String!,$name:String!,$category:ID!,$endCursor:String){repository(owner:$owner,name:$name){discussions(first:100,categoryId:$category,after:$endCursor){pageInfo{hasNextPage endCursor} nodes{id number url title body authorAssociation ${ACTORS}}}}}`;

const DiscussionPages = z.array(
  z.object({
    data: z.object({
      repository: z.object({ discussions: z.object({ nodes: z.array(Discussion) }) }),
    }),
  })
);

export const listDiscussions = (repo: string, categoryId: string): Discussion[] =>
  ghParse(
    DiscussionPages,
    graphqlArgs({ query: DISCUSSIONS_QUERY, ...ownerAndName(repo), category: categoryId }, true)
  ).flatMap((page) => page.data.repository.discussions.nodes);

const COMMENTS_QUERY = `query($id:ID!,$endCursor:String){node(id:$id){... on Discussion{comments(first:100,after:$endCursor){pageInfo{hasNextPage endCursor} nodes{id url body ${ACTORS}}}}}}`;

const CommentPages = z.array(
  z.object({
    data: z.object({
      node: z.object({ comments: z.object({ nodes: z.array(DiscussionComment) }) }),
    }),
  })
);

export const listDiscussionComments = (discussionId: string): DiscussionComment[] =>
  ghParse(CommentPages, graphqlArgs({ query: COMMENTS_QUERY, id: discussionId }, true)).flatMap(
    (page) => page.data.node.comments.nodes
  );

const Written = z.object({ id: z.string(), url: z.string() });

const CREATE_DISCUSSION = `mutation($repositoryId:ID!,$categoryId:ID!,$title:String!,$body:String!){createDiscussion(input:{repositoryId:$repositoryId,categoryId:$categoryId,title:$title,body:$body}){discussion{id url}}}`;

export const createDiscussion = (
  { repositoryId, categoryId }: DiscussionPlace,
  title: string,
  body: string
): z.infer<typeof Written> =>
  ghParse(
    z.object({ data: z.object({ createDiscussion: z.object({ discussion: Written }) }) }),
    graphqlArgs({ query: CREATE_DISCUSSION, repositoryId, categoryId, title, body })
  ).data.createDiscussion.discussion;

const ADD_COMMENT = `mutation($discussionId:ID!,$body:String!){addDiscussionComment(input:{discussionId:$discussionId,body:$body}){comment{id url}}}`;

export const addDiscussionComment = (discussionId: string, body: string): z.infer<typeof Written> =>
  ghParse(
    z.object({ data: z.object({ addDiscussionComment: z.object({ comment: Written }) }) }),
    graphqlArgs({ query: ADD_COMMENT, discussionId, body })
  ).data.addDiscussionComment.comment;

const UPDATE_COMMENT = `mutation($commentId:ID!,$body:String!){updateDiscussionComment(input:{commentId:$commentId,body:$body}){comment{id url}}}`;

export const updateDiscussionComment = (commentId: string, body: string): z.infer<typeof Written> =>
  ghParse(
    z.object({ data: z.object({ updateDiscussionComment: z.object({ comment: Written }) }) }),
    graphqlArgs({ query: UPDATE_COMMENT, commentId, body })
  ).data.updateDiscussionComment.comment;

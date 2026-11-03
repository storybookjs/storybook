# Queries for `check-pr`

## PR details and checks

```bash
gh pr view <number> --json title,body,state,labels,reviews,comments,headRefOid,statusCheckRollup
```

## Unresolved review threads

Repeat with `-f cursor=<endCursor>` while `hasNextPage` is `true`. A thread with more than 100 comments (`totalCount`) needs its own query for the rest.

```bash
gh api graphql -f query='
query($cursor: String) {
  repository(owner: "storybookjs", name: "storybook") {
    pullRequest(number: <number>) {
      reviewThreads(first: 100, after: $cursor) {
        pageInfo { hasNextPage endCursor }
        nodes {
          id
          isResolved
          isOutdated
          path
          line
          comments(first: 100) {
            totalCount
            nodes { author { login } body createdAt }
          }
        }
      }
    }
  }
}'
```

## Latest Greptile summary

PR comments are issue comments. Greptile edits its summary in place, so sort by `updated_at`.

```bash
gh api --paginate "repos/storybookjs/storybook/issues/<number>/comments?per_page=100" \
  | jq -s 'add
    | map(select(.user.login | test("greptile"; "i")))
    | sort_by(.updated_at)
    | last
    | {author: .user.login, updated_at, body}'
```

import { describe, expect, it } from 'vitest';

import { setupMsw } from '../test-helpers/msw.ts';
import { parseBodyReferences, resolveLinkedIssues } from './linked-issues.ts';

const ID = { owner: 'storybookjs', repo: 'storybook', number: 1 };

describe('parseBodyReferences', () => {
  it('extracts same-repo #N references with an ambiguous hint', () => {
    const refs = parseBodyReferences({ ...ID, body: 'Closes #42 and resolves #99.' });
    expect(refs).toEqual([
      { owner: 'storybookjs', repo: 'storybook', number: 42, hint: 'ambiguous' },
      { owner: 'storybookjs', repo: 'storybook', number: 99, hint: 'ambiguous' },
    ]);
  });

  it('extracts cross-repo storybookjs/x#N references as ambiguous', () => {
    const refs = parseBodyReferences({ ...ID, body: 'Tracks storybookjs/csf#7.' });
    expect(refs).toEqual([{ owner: 'storybookjs', repo: 'csf', number: 7, hint: 'ambiguous' }]);
  });

  it('extracts issue URLs with hint="issue"', () => {
    const refs = parseBodyReferences({
      ...ID,
      body: 'See https://github.com/storybookjs/csf/issues/12.',
    });
    expect(refs).toEqual([{ owner: 'storybookjs', repo: 'csf', number: 12, hint: 'issue' }]);
  });

  it('extracts PR URLs with hint="pull"', () => {
    const refs = parseBodyReferences({
      ...ID,
      body: 'Related https://github.com/storybookjs/storybook/pull/35138.',
    });
    expect(refs).toEqual([
      { owner: 'storybookjs', repo: 'storybook', number: 35138, hint: 'pull' },
    ]);
  });

  it('prefers a URL hint over an ambiguous duplicate', () => {
    const refs = parseBodyReferences({
      ...ID,
      body: '#5 mentioned, see https://github.com/storybookjs/storybook/pull/5 for context.',
    });
    expect(refs).toEqual([{ owner: 'storybookjs', repo: 'storybook', number: 5, hint: 'pull' }]);
  });

  it('ignores references outside storybookjs', () => {
    const refs = parseBodyReferences({
      ...ID,
      body: 'other/repo#1 https://github.com/example/x/issues/2',
    });
    expect(refs).toEqual([]);
  });
});

describe('resolveLinkedIssues', () => {
  const { server, http, HttpResponse } = setupMsw();

  it('splits results into linkedIssues / otherIssues / unresolved', async () => {
    server.use(
      http.post('https://api.github.com/graphql', () =>
        HttpResponse.json({
          data: {
            repository: {
              pullRequest: {
                closingIssuesReferences: {
                  nodes: [
                    {
                      number: 42,
                      repository: { owner: { login: 'storybookjs' }, name: 'storybook' },
                    },
                  ],
                },
              },
            },
          },
        })
      ),
      http.get('https://api.github.com/repos/storybookjs/storybook/issues/42', () =>
        HttpResponse.json({
          number: 42,
          title: 'Closing issue',
          body: 'b',
          state: 'open',
          labels: [{ name: 'bug' }],
          html_url: 'u',
        })
      ),
      // Body ref #50: a real issue not in the API set.
      http.get('https://api.github.com/repos/storybookjs/storybook/issues/50', () =>
        HttpResponse.json({
          number: 50,
          title: 'Mentioned issue',
          body: 'b',
          state: 'open',
          labels: [],
          html_url: 'u',
        })
      ),
      // Body ref #35138: a PR (has pull_request field). fetchIssue returns
      // null for PRs, so it lands in `unresolved` (debug info) — the check
      // consumer doesn't need PRs vs. typos disambiguated.
      http.get('https://api.github.com/repos/storybookjs/storybook/issues/35138', () =>
        HttpResponse.json({
          number: 35138,
          title: 'Related PR',
          body: 'b',
          state: 'open',
          labels: [],
          pull_request: { url: 'pr-url' },
          html_url: 'u',
        })
      ),
      // Body ref #999: not found.
      http.get('https://api.github.com/repos/storybookjs/storybook/issues/999', () =>
        HttpResponse.json({ message: 'Not Found' }, { status: 404 })
      )
    );

    const result = await resolveLinkedIssues({
      owner: 'storybookjs',
      repo: 'storybook',
      number: 1,
      body: 'see #50, related #35138, and the broken #999',
    });

    expect(result.linkedIssues).toHaveLength(1);
    expect(result.linkedIssues[0]).toMatchObject({ number: 42 });
    expect(result.otherIssues).toHaveLength(1);
    expect(result.otherIssues[0]).toMatchObject({ number: 50, title: 'Mentioned issue' });
    expect(result.unresolved.sort()).toEqual([
      'storybookjs/storybook#35138',
      'storybookjs/storybook#999',
    ]);
  });

  it('classifies PR-URL body references as unresolved (not otherIssues)', async () => {
    server.use(
      http.post('https://api.github.com/graphql', () =>
        HttpResponse.json({
          data: { repository: { pullRequest: { closingIssuesReferences: { nodes: [] } } } },
        })
      ),
      http.get('https://api.github.com/repos/storybookjs/storybook/issues/35138', () =>
        HttpResponse.json({
          number: 35138,
          title: 'A PR',
          body: 'b',
          state: 'open',
          labels: [],
          pull_request: { url: 'pr' },
          html_url: 'u',
        })
      )
    );
    const result = await resolveLinkedIssues({
      owner: 'storybookjs',
      repo: 'storybook',
      number: 1,
      body: 'see https://github.com/storybookjs/storybook/pull/35138',
    });
    expect(result.linkedIssues).toEqual([]);
    expect(result.otherIssues).toEqual([]);
    expect(result.unresolved).toEqual(['storybookjs/storybook#35138']);
  });
});

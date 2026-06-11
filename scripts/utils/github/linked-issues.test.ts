import { describe, expect, it } from 'vitest';

import { setupMsw } from '../test-helpers/msw.ts';
import { parseBodyReferences, resolveLinkedIssues } from './linked-issues.ts';

describe('parseBodyReferences', () => {
  it('extracts same-repo #N references', () => {
    const refs = parseBodyReferences('storybookjs', 'storybook', 'Closes #42 and resolves #99.');
    expect(refs).toEqual([
      { owner: 'storybookjs', repo: 'storybook', number: 42 },
      { owner: 'storybookjs', repo: 'storybook', number: 99 },
    ]);
  });

  it('extracts cross-repo storybookjs/x#N references', () => {
    const refs = parseBodyReferences('storybookjs', 'storybook', 'Tracks storybookjs/csf#7.');
    expect(refs).toEqual([{ owner: 'storybookjs', repo: 'csf', number: 7 }]);
  });

  it('extracts full URLs', () => {
    const refs = parseBodyReferences(
      'storybookjs',
      'storybook',
      'See https://github.com/storybookjs/csf/issues/12.'
    );
    expect(refs).toEqual([{ owner: 'storybookjs', repo: 'csf', number: 12 }]);
  });

  it('ignores references outside storybookjs', () => {
    const refs = parseBodyReferences(
      'storybookjs',
      'storybook',
      'other/repo#1 https://github.com/example/x/issues/2'
    );
    expect(refs).toEqual([]);
  });

  it('dedupes', () => {
    const refs = parseBodyReferences('storybookjs', 'storybook', '#1 #1 storybookjs/storybook#1');
    expect(refs).toHaveLength(1);
  });
});

describe('resolveLinkedIssues', () => {
  const { server, http, HttpResponse } = setupMsw();

  it('combines GraphQL closing refs with body refs, resolves each, and tracks broken links', async () => {
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
          title: 'A',
          body: 'b',
          state: 'open',
          labels: [{ name: 'bug' }],
          html_url: 'u',
        })
      ),
      http.get('https://api.github.com/repos/storybookjs/storybook/issues/99', () =>
        HttpResponse.json({ message: 'Not Found' }, { status: 404 })
      )
    );
    const { issues, broken } = await resolveLinkedIssues({
      owner: 'storybookjs',
      repo: 'storybook',
      number: 1,
      body: 'closes #99',
    });
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({
      owner: 'storybookjs',
      repo: 'storybook',
      number: 42,
      state: 'open',
    });
    expect(broken).toEqual(['storybookjs/storybook#99']);
  });
});

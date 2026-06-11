import { describe, expect, it } from 'vitest';

import { setupMsw } from '../test-helpers/msw.ts';
import { fetchPr, normalizeStorybookPr } from './pr.ts';

describe('normalizeStorybookPr', () => {
  it('accepts a bare number', () => {
    expect(normalizeStorybookPr('12345')).toEqual({
      owner: 'storybookjs',
      repo: 'storybook',
      number: 12345,
    });
  });

  it('accepts a full GitHub URL on storybookjs/storybook', () => {
    expect(normalizeStorybookPr('https://github.com/storybookjs/storybook/pull/12345')).toEqual({
      owner: 'storybookjs',
      repo: 'storybook',
      number: 12345,
    });
  });

  it('rejects URLs outside storybookjs', () => {
    expect(() => normalizeStorybookPr('https://github.com/example/other/pull/1')).toThrowError(
      /storybookjs/
    );
  });

  it('rejects garbage', () => {
    expect(() => normalizeStorybookPr('not-a-pr')).toThrowError(/PR/);
    expect(() => normalizeStorybookPr('')).toThrowError();
  });
});

describe('fetchPr', () => {
  const { server, http, HttpResponse } = setupMsw();

  it('returns a PrSnapshot with files paginated', async () => {
    server.use(
      http.get('https://api.github.com/repos/storybookjs/storybook/pulls/1', () =>
        HttpResponse.json({
          number: 1,
          title: 'fix x',
          body: 'closes #99',
          user: { login: 'someone' },
          draft: false,
          head: { sha: 'deadbeef' },
          labels: [{ id: 1, name: 'bug', color: '', default: false, description: '', node_id: '', url: '' }],
          html_url: 'https://github.com/storybookjs/storybook/pull/1',
        })
      ),
      http.get('https://api.github.com/repos/storybookjs/storybook/pulls/1/files', () =>
        HttpResponse.json([
          { filename: 'a.ts', additions: 3, deletions: 1, patch: '@@ ...', status: 'modified' },
        ])
      )
    );
    const coords = { owner: 'storybookjs' as const, repo: 'storybook' as const, number: 1 };
    const snapshot = await fetchPr(coords);
    expect(snapshot.title).toBe('fix x');
    expect(snapshot.author).toBe('someone');
    expect(snapshot.isDraft).toBe(false);
    expect(snapshot.headSha).toBe('deadbeef');
    expect(snapshot.labels).toEqual(['bug']);
    expect(snapshot.files).toHaveLength(1);
    expect(snapshot.files[0]).toMatchObject({ path: 'a.ts', additions: 3, deletions: 1 });
  });

  it('strips HTML comments from the PR body so template examples are ignored', async () => {
    server.use(
      http.get('https://api.github.com/repos/storybookjs/storybook/pulls/2', () =>
        HttpResponse.json({
          number: 2,
          title: 't',
          body: 'Fixes #42.\n<!-- Template example: closes #1000 and #1001 -->\nMore notes.',
          user: { login: 'someone' },
          draft: false,
          head: { sha: 'sha' },
          labels: [],
          html_url: 'u',
        })
      ),
      http.get('https://api.github.com/repos/storybookjs/storybook/pulls/2/files', () =>
        HttpResponse.json([])
      )
    );
    const snapshot = await fetchPr({ owner: 'storybookjs', repo: 'storybook', number: 2 });
    expect(snapshot.body).not.toContain('#1000');
    expect(snapshot.body).not.toContain('#1001');
    expect(snapshot.body).toContain('#42');
    expect(snapshot.body).toContain('More notes');
  });
});

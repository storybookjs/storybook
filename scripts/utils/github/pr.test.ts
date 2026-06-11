import { describe, expect, it, vi } from 'vitest';

import { fetchPr, parsePrArg } from './pr.ts';

describe('parsePrArg', () => {
  it('accepts a bare number', () => {
    expect(parsePrArg('12345')).toEqual({ owner: 'storybookjs', repo: 'storybook', number: 12345 });
  });

  it('accepts a full GitHub URL on storybookjs/storybook', () => {
    expect(parsePrArg('https://github.com/storybookjs/storybook/pull/12345')).toEqual({
      owner: 'storybookjs',
      repo: 'storybook',
      number: 12345,
    });
  });

  it('rejects URLs outside storybookjs', () => {
    expect(() => parsePrArg('https://github.com/example/other/pull/1')).toThrowError(/storybookjs/);
  });

  it('rejects garbage', () => {
    expect(() => parsePrArg('not-a-pr')).toThrowError(/PR/);
    expect(() => parsePrArg('')).toThrowError();
  });
});

describe('fetchPr', () => {
  it('returns a PrContext with files paginated', async () => {
    const calls: string[] = [];
    const client = {
      graphql: vi.fn(),
      rest: (async (route: string) => {
        calls.push(route);
        if (route === 'GET /repos/{owner}/{repo}/pulls/{pull_number}') {
          return {
            data: {
              number: 1,
              title: 'fix x',
              body: 'closes #99',
              user: { login: 'someone' },
              draft: false,
              head: { sha: 'deadbeef' },
              labels: [{ name: 'bug' }],
              html_url: 'https://github.com/storybookjs/storybook/pull/1',
            },
          };
        }
        if (route === 'GET /repos/{owner}/{repo}/pulls/{pull_number}/files') {
          return {
            data: [
              { filename: 'a.ts', additions: 3, deletions: 1, patch: '@@ ...', status: 'modified' },
            ],
          };
        }
        throw new Error(`unexpected ${route}`);
      }) as any,
    };
    const ctx = await fetchPr(client as any, { owner: 'storybookjs', repo: 'storybook', number: 1 });
    expect(ctx.title).toBe('fix x');
    expect(ctx.author).toBe('someone');
    expect(ctx.isDraft).toBe(false);
    expect(ctx.headSha).toBe('deadbeef');
    expect(ctx.labels).toEqual(['bug']);
    expect(ctx.files).toHaveLength(1);
    expect(ctx.files[0]).toMatchObject({ path: 'a.ts', additions: 3, deletions: 1 });
    expect(calls).toContain('GET /repos/{owner}/{repo}/pulls/{pull_number}/files');
  });
});

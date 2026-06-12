import { describe, expect, it } from 'vitest';

import { createGithubClient, requireGitHubToken } from './client.ts';

const SCOPES = ['repo'] as const;

describe('requireToken', () => {
  it('returns the token when present', () => {
    expect(requireGitHubToken(SCOPES, { GH_TOKEN: 'abc' })).toBe('abc');
    expect(requireGitHubToken(SCOPES, { GITHUB_TOKEN: 'def' })).toBe('def');
    expect(requireGitHubToken(SCOPES, { GH_TOKEN: 'abc', GITHUB_TOKEN: 'def' })).toBe('abc');
  });

  it('throws naming the scopes when no token is set', () => {
    expect(() => requireGitHubToken(SCOPES, {})).toThrowError(/repo/);
    expect(() => requireGitHubToken(['my-scope', 'another'], {})).toThrowError(/my-scope, another/);
  });
});

describe('createGithubClient', () => {
  it('returns an object exposing graphql and rest with defaults applied', () => {
    const client = createGithubClient('abc123');
    expect(typeof client.graphql).toBe('function');
    expect(typeof client.rest).toBe('function');
    expect(client.rest.endpoint.DEFAULTS.headers.authorization).toBe('token abc123');
  });
});

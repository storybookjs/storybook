import { describe, expect, it } from 'vitest';

import { createGithubClient, requireToken } from './client.ts';

const SCOPES = ['repo'] as const;

describe('requireToken', () => {
  it('returns the token when present', () => {
    expect(requireToken(SCOPES, { GH_TOKEN: 'abc' })).toBe('abc');
    expect(requireToken(SCOPES, { GITHUB_TOKEN: 'def' })).toBe('def');
    expect(requireToken(SCOPES, { GH_TOKEN: 'abc', GITHUB_TOKEN: 'def' })).toBe('abc');
  });

  it('throws naming the scopes when no token is set', () => {
    expect(() => requireToken(SCOPES, {})).toThrowError(/repo/);
    expect(() => requireToken(['my-scope', 'another'], {})).toThrowError(/my-scope, another/);
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

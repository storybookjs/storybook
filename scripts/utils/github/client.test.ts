import { describe, expect, it } from 'vitest';

import { createGithubClient, requireToken } from './client.ts';

describe('requireToken', () => {
  it('returns the token when present', () => {
    expect(requireToken({ GH_TOKEN: 'abc' })).toBe('abc');
    expect(requireToken({ GITHUB_TOKEN: 'def' })).toBe('def');
    expect(requireToken({ GH_TOKEN: 'abc', GITHUB_TOKEN: 'def' })).toBe('abc');
  });

  it('throws a usage error when neither var is set', () => {
    expect(() => requireToken({})).toThrowError(/GH_TOKEN|GITHUB_TOKEN/);
  });
});

describe('createGithubClient', () => {
  it('returns an object exposing graphql and rest with defaults applied', () => {
    const client = createGithubClient('abc123');
    expect(typeof client.graphql).toBe('function');
    expect(typeof client.rest).toBe('function');
    expect((client.rest as any).endpoint.DEFAULTS.headers.authorization).toBe('token abc123');
  });
});

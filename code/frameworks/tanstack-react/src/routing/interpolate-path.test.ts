import { describe, expect, it } from 'vitest';

import { interpolateStoryPath } from './interpolate-path.ts';

describe('interpolateStoryPath', () => {
  it('returns "/" for empty and root paths', () => {
    expect(interpolateStoryPath(undefined)).toBe('/');
    expect(interpolateStoryPath('/')).toBe('/');
    expect(interpolateStoryPath('/', { id: '1' })).toBe('/');
  });

  it('returns paths without params unchanged', () => {
    expect(interpolateStoryPath('/products')).toBe('/products');
    expect(interpolateStoryPath('/products', { id: '1' })).toBe('/products');
  });

  it('interpolates a required param', () => {
    expect(interpolateStoryPath('/users/$userId', { userId: '42' })).toBe('/users/42');
    expect(interpolateStoryPath('/$id', { id: '9' })).toBe('/9');
  });

  it('renders "undefined" for a missing required param', () => {
    expect(interpolateStoryPath('/users/$userId', {})).toBe('/users/undefined');
  });

  it('stringifies non-string param values as-is', () => {
    expect(interpolateStoryPath('/users/$userId', { userId: 42 })).toBe('/users/42');
    expect(interpolateStoryPath('/users/$userId', { userId: false })).toBe('/users/false');
  });

  it('URI-encodes string param values', () => {
    expect(interpolateStoryPath('/users/$userId', { userId: 'a b' })).toBe('/users/a%20b');
  });

  it('preserves a trailing slash and passes param-free paths through unchanged', () => {
    expect(interpolateStoryPath('/users/$userId/', { userId: '42' })).toBe('/users/42/');
    expect(interpolateStoryPath('/a//b')).toBe('/a//b');
  });

  it('skips empty segments when interpolating', () => {
    expect(interpolateStoryPath('/a//$id', { id: '1' })).toBe('/a/1');
  });

  it('interpolates a braced param with surrounding text', () => {
    expect(interpolateStoryPath('/files/v{$id}.json', { id: '3' })).toBe('/files/v3.json');
  });

  it('drops an absent optional param segment', () => {
    expect(interpolateStoryPath('/users/{-$id}/edit', {})).toBe('/users/edit');
  });

  it('interpolates a present optional param segment', () => {
    expect(interpolateStoryPath('/users/{-$id}/edit', { id: '5' })).toBe('/users/5/edit');
  });

  it('interpolates the splat param', () => {
    expect(interpolateStoryPath('/files/$', { _splat: 'a/b' })).toBe('/files/a/b');
    expect(interpolateStoryPath('/files/$', { _splat: 'a b/c' })).toBe('/files/a%20b/c');
  });

  it('drops the path segment of an absent splat', () => {
    expect(interpolateStoryPath('/files/$', {})).toBe('/files');
    expect(interpolateStoryPath('/files/{$}.json', {})).toBe('/files/.json');
  });

  it('keeps braces that are not param syntax literal', () => {
    expect(interpolateStoryPath('/weird/{not-a-param}')).toBe('/weird/{not-a-param}');
  });
});

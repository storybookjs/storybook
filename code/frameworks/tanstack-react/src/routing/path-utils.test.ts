import { describe, expect, it, vi } from 'vitest';

// interpolateStoryPath must be re-imported per describe block after mocking
// `@tanstack/react-router`'s `interpolatePath` export to each candidate
// shape, since the two `@tanstack/router-core` versions under test can't be
// installed side by side.

describe('interpolateStoryPath with the pre-1.171.30 object-argument signature', () => {
  it('interpolates a dynamic param via the legacy { path, params } call', async () => {
    vi.resetModules();
    vi.doMock('@tanstack/react-router', () => ({
      interpolatePath: ({ path, params }: { path: string; params: Record<string, unknown> }) => ({
        interpolatedPath: path.replace(/\$(\w+)/g, (_, key) => String(params[key])),
      }),
    }));
    const { interpolateStoryPath } = await import('./path-utils.ts');

    expect(interpolateStoryPath('/users/$userId', { userId: '42' })).toBe('/users/42');
  });
});

describe('interpolateStoryPath with the 1.171.30+ positional signature', () => {
  // A trimmed reimplementation of @tanstack/router-core@1.171.30's
  // `interpolatePath(path, segments, params)`, since that version can't be
  // installed alongside the one the rest of the workspace resolves. It
  // exercises the same segment tuple shape `interpolateStoryPath` builds.
  function newInterpolatePath(
    path: string,
    segments: ReadonlyArray<string | readonly [number, string, string, string | undefined]>,
    params: Record<string, unknown>
  ) {
    const trailingSlash = path.endsWith('/') ? '/' : '';
    let joined = '';
    for (const part of segments) {
      if (typeof part === 'string') {
        joined += part;
        continue;
      }
      const [kind, key, prefix, suffix] = part;
      const value = kind === 2 ? params._splat : params[key];
      joined += prefix + String(value) + (suffix ?? '');
    }
    return joined + trailingSlash || '/';
  }

  it('interpolates a dynamic param via the positional call', async () => {
    vi.resetModules();
    vi.doMock('@tanstack/react-router', () => ({ interpolatePath: newInterpolatePath }));
    const { interpolateStoryPath } = await import('./path-utils.ts');

    expect(interpolateStoryPath('/users/$userId', { userId: '42' })).toBe('/users/42');
  });

  it('interpolates a splat param', async () => {
    vi.resetModules();
    vi.doMock('@tanstack/react-router', () => ({ interpolatePath: newInterpolatePath }));
    const { interpolateStoryPath } = await import('./path-utils.ts');

    expect(interpolateStoryPath('/files/$', { _splat: 'reports/q2.pdf' })).toBe(
      '/files/reports/q2.pdf'
    );
  });

  it('resolves the root path with no params', async () => {
    vi.resetModules();
    vi.doMock('@tanstack/react-router', () => ({ interpolatePath: newInterpolatePath }));
    const { interpolateStoryPath } = await import('./path-utils.ts');

    expect(interpolateStoryPath('/', {})).toBe('/');
  });
});

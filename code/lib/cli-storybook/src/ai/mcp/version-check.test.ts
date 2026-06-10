import { createRequire } from 'node:module';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { STORYBOOK_MIN_VERSION, checkStorybookVersion } from './version-check.ts';

vi.mock('node:module', () => ({
  createRequire: vi.fn(),
}));

function mockStorybookVersion(version: string | null) {
  vi.mocked(createRequire).mockImplementation(
    () =>
      ((id: string) => {
        if (id === 'storybook/package.json') {
          if (version === null) {
            throw new Error('not found');
          }
          return { version };
        }
        throw new Error(`unexpected require: ${id}`);
      }) as unknown as ReturnType<typeof createRequire>
  );
}

beforeEach(() => {
  vi.mocked(createRequire).mockReset();
});

describe('checkStorybookVersion', () => {
  it('returns ok for the minimum version', () => {
    mockStorybookVersion(STORYBOOK_MIN_VERSION);
    expect(checkStorybookVersion('/a')).toEqual({ status: 'ok' });
  });

  it('returns too-old with the detected version for older Storybooks', () => {
    mockStorybookVersion('9.1.16');
    expect(checkStorybookVersion('/a')).toEqual({ status: 'too-old', version: '9.1.16' });
  });

  it('accepts a prerelease of the minimum (alpha/beta/rc)', () => {
    mockStorybookVersion('10.5.0-alpha.1');
    expect(checkStorybookVersion('/a')).toEqual({ status: 'ok' });
  });

  it('treats a prerelease of an earlier version as too-old', () => {
    mockStorybookVersion('10.4.0-rc.1');
    expect(checkStorybookVersion('/a')).toEqual({ status: 'too-old', version: '10.4.0-rc.1' });
  });

  it('returns ok for a stable release above the minimum', () => {
    mockStorybookVersion('11.0.0');
    expect(checkStorybookVersion('/a')).toEqual({ status: 'ok' });
  });

  it('returns not-installed when storybook is unresolvable', () => {
    mockStorybookVersion(null);
    expect(checkStorybookVersion('/a')).toEqual({ status: 'not-installed' });
  });

  it('treats 0.0.0-... versions as ok (canary)', () => {
    mockStorybookVersion('0.0.0-canary.1234');
    expect(checkStorybookVersion('/a')).toEqual({ status: 'ok' });
  });
});

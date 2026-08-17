import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  isPackageVersionPublished,
  listUnpublishedPackages,
  waitForPackagesToBePublished,
} from '../npm-registry.ts';

const fetchMock = vi.fn();

const jsonResponse = (status: number, body: unknown) =>
  Promise.resolve({
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  });

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('isPackageVersionPublished', () => {
  it('returns false on 404', async () => {
    fetchMock.mockImplementation(() => jsonResponse(404, { error: 'Not found' }));

    await expect(
      isPackageVersionPublished({ packageName: 'storybook', version: '10.6.0-alpha.6' })
    ).resolves.toBe(false);
    expect(fetchMock).toHaveBeenCalledWith('https://registry.npmjs.org/storybook/10.6.0-alpha.6');
  });

  it('returns true on 200 with a matching version', async () => {
    fetchMock.mockImplementation(() => jsonResponse(200, { version: '10.6.0-alpha.6' }));

    await expect(
      isPackageVersionPublished({ packageName: 'storybook', version: '10.6.0-alpha.6' })
    ).resolves.toBe(true);
  });

  it('throws on unexpected status codes', async () => {
    fetchMock.mockImplementation(() => jsonResponse(500, { error: 'down' }));

    await expect(
      isPackageVersionPublished({ packageName: 'storybook', version: '10.6.0-alpha.6' })
    ).rejects.toThrow('Unexpected status code when checking the current version on npm: 500');
  });
});

describe('listUnpublishedPackages', () => {
  it('returns only packages that are not yet on npm', async () => {
    fetchMock.mockImplementation((url: string) => {
      if (url === 'https://registry.npmjs.org/storybook/1.0.0') {
        return jsonResponse(200, { version: '1.0.0' });
      }
      return jsonResponse(404, { error: 'Not found' });
    });

    await expect(
      listUnpublishedPackages({
        packageNames: ['storybook', '@storybook/react'],
        version: '1.0.0',
      })
    ).resolves.toEqual(['@storybook/react']);
  });
});

describe('waitForPackagesToBePublished', () => {
  it('returns an empty list once every package becomes visible', async () => {
    let t = 0;
    fetchMock.mockImplementation(() => jsonResponse(404, { error: 'Not found' }));

    const missing = waitForPackagesToBePublished({
      packageNames: ['storybook'],
      version: '1.0.0',
      timeoutMs: 30,
      intervalMs: 10,
      now: () => t,
      sleep: async () => {
        t += 10;
        fetchMock.mockImplementation(() => jsonResponse(200, { version: '1.0.0' }));
      },
    });

    await expect(missing).resolves.toEqual([]);
  });

  it('returns remaining names when the timeout expires', async () => {
    let t = 0;
    fetchMock.mockImplementation(() => jsonResponse(404, { error: 'Not found' }));

    await expect(
      waitForPackagesToBePublished({
        packageNames: ['storybook', '@storybook/react'],
        version: '1.0.0',
        timeoutMs: 20,
        intervalMs: 10,
        now: () => t,
        sleep: async () => {
          t += 10;
        },
      })
    ).resolves.toEqual(['storybook', '@storybook/react']);
  });
});

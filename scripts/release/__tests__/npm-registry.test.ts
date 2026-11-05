import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  isPackageVersionPublished,
  listUnpublishedPackages,
  packagesAcceptedByRegistry,
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
    expect(fetchMock).toHaveBeenCalledWith(
      'https://registry.npmjs.org/storybook/10.6.0-alpha.6',
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    );
  });

  it('returns true on 200 with a matching version', async () => {
    fetchMock.mockImplementation(() => jsonResponse(200, { version: '10.6.0-alpha.6' }));

    await expect(
      isPackageVersionPublished({ packageName: 'storybook', version: '10.6.0-alpha.6' })
    ).resolves.toBe(true);
  });

  it('returns false on 429 and 5xx so polling can continue', async () => {
    fetchMock.mockImplementation(() => jsonResponse(500, { error: 'down' }));

    await expect(
      isPackageVersionPublished({ packageName: 'storybook', version: '10.6.0-alpha.6' })
    ).resolves.toBe(false);

    fetchMock.mockImplementation(() => jsonResponse(429, { error: 'slow down' }));

    await expect(
      isPackageVersionPublished({ packageName: 'storybook', version: '10.6.0-alpha.6' })
    ).resolves.toBe(false);
  });

  it('returns false when the registry request fails or times out', async () => {
    fetchMock.mockRejectedValue(new Error('The operation was aborted'));

    await expect(
      isPackageVersionPublished({ packageName: 'storybook', version: '10.6.0-alpha.6' })
    ).resolves.toBe(false);
  });

  it('throws on unexpected status codes', async () => {
    fetchMock.mockImplementation(() => jsonResponse(401, { error: 'unauthorized' }));

    await expect(
      isPackageVersionPublished({ packageName: 'storybook', version: '10.6.0-alpha.6' })
    ).rejects.toThrow('Unexpected status code when checking the current version on npm: 401');
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

describe('packagesAcceptedByRegistry', () => {
  it('extracts packages npm already reserved or published', () => {
    expect(
      packagesAcceptedByRegistry(
        [
          '+ @storybook/react@10.6.0',
          'npm notice Publishing to https://registry.npmjs.org/ with tag next and public access',
          'npm error code E409',
          'npm error 409 Conflict - PUT https://registry.npmjs.org/storybook - Cannot publish over previously staged version "10.6.0".',
          'npm error 403 403 Forbidden - PUT https://registry.npmjs.org/@storybook%2fvue3 - You cannot publish over the previously published versions: 10.6.0.',
          'npm error 503 Service Unavailable - PUT https://registry.npmjs.org/@storybook%2fsvelte',
        ].join('\n')
      )
    ).toEqual(['@storybook/react', 'storybook', '@storybook/vue3']);
  });

  it('extracts packages when npm colors its output', () => {
    expect(
      packagesAcceptedByRegistry(
        [
          '\u001b[31mnpm\u001b[39m \u001b[41merror\u001b[49m 409 Conflict - PUT https://registry.npmjs.org/@storybook%2freact - Cannot publish over previously staged version "10.5.9".',
          '\u001b[1m+ storybook@10.5.9\u001b[22m',
        ].join('\n')
      )
    ).toEqual(['@storybook/react', 'storybook']);
  });
});

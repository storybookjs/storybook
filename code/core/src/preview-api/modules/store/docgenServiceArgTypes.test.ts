import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { getService } from '../../../shared/open-service/preview.ts';
import {
  getDocgenServiceArgTypes,
  loadDocgenServiceArgTypes,
  mergeDocgenServiceArgTypes,
} from './docgenServiceArgTypes.ts';

vi.mock('../../../shared/open-service/preview.ts', () => ({
  getService: vi.fn(),
  registerService: vi.fn(),
}));

const mockDocgenService = ({
  payload,
  getError,
  loadError,
  hang,
}: {
  payload?: { argTypes?: unknown };
  getError?: Error;
  loadError?: Error;
  hang?: boolean;
}) => {
  // The real `getService` returns a strongly-typed service instance; tests only need the
  // `core/docgen` query surface consumed by `docgenServiceArgTypes.ts`.
  vi.mocked(getService).mockReturnValue({
    queries: {
      docgen: {
        get: vi.fn(() => {
          if (getError) {
            throw getError;
          }
          return payload;
        }),
        loaded: vi.fn(() => {
          if (loadError) {
            return Promise.reject(loadError);
          }
          if (hang) {
            return new Promise(() => {});
          }
          return Promise.resolve(payload);
        }),
      },
    },
  } as unknown as ReturnType<typeof getService>);
};

describe('mergeDocgenServiceArgTypes', () => {
  it('layers the server payload beneath story argTypes', () => {
    expect(
      mergeDocgenServiceArgTypes({
        serverArgTypes: {
          size: { name: 'size', table: { category: 'props' } },
          default: { name: 'default', table: { category: 'slots' } },
        },
        argTypes: { default: { name: 'default', control: 'text' } },
      })
    ).toEqual({
      size: { name: 'size', table: { category: 'props' } },
      default: { name: 'default', control: 'text', table: { category: 'slots' } },
    });
  });
});

describe('getDocgenServiceArgTypes', () => {
  beforeEach(() => {
    vi.mocked(getService).mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns undefined without consulting the service when the flag is off', () => {
    vi.stubGlobal('FEATURES', {});

    expect(getDocgenServiceArgTypes('my-component')).toBeUndefined();
    expect(getService).not.toHaveBeenCalled();
  });

  it('returns the server argTypes when available', () => {
    vi.stubGlobal('FEATURES', { experimentalDocgenServer: true });
    const argTypes = { default: { name: 'default', table: { category: 'slots' } } };
    mockDocgenService({ payload: { argTypes } });

    expect(getDocgenServiceArgTypes('my-component')).toEqual(argTypes);
  });

  it('returns undefined when the service is not registered', () => {
    vi.stubGlobal('FEATURES', { experimentalDocgenServer: true });
    mockDocgenService({ getError: new Error('Service core/docgen is not registered') });

    expect(getDocgenServiceArgTypes('my-component')).toBeUndefined();
  });

  it('returns undefined when no payload has been extracted yet', () => {
    vi.stubGlobal('FEATURES', { experimentalDocgenServer: true });
    mockDocgenService({});

    expect(getDocgenServiceArgTypes('my-component')).toBeUndefined();
  });
});

describe('loadDocgenServiceArgTypes', () => {
  beforeEach(() => {
    vi.mocked(getService).mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('returns undefined without consulting the service when the flag is off', async () => {
    vi.stubGlobal('FEATURES', {});

    await expect(loadDocgenServiceArgTypes('my-component')).resolves.toBeUndefined();
    expect(getService).not.toHaveBeenCalled();
  });

  it('resolves with the extracted argTypes', async () => {
    vi.stubGlobal('FEATURES', { experimentalDocgenServer: true });
    const argTypes = { default: { name: 'default', table: { category: 'slots' } } };
    mockDocgenService({ payload: { argTypes } });

    await expect(loadDocgenServiceArgTypes('my-component')).resolves.toEqual(argTypes);
  });

  it('resolves to undefined when the load fails', async () => {
    vi.stubGlobal('FEATURES', { experimentalDocgenServer: true });
    mockDocgenService({ loadError: new Error('extraction failed') });

    await expect(loadDocgenServiceArgTypes('my-component')).resolves.toBeUndefined();
  });

  it('resolves to undefined when the service is not registered', async () => {
    vi.stubGlobal('FEATURES', { experimentalDocgenServer: true });
    vi.mocked(getService).mockImplementation(() => {
      throw new Error('Service core/docgen is not registered');
    });

    await expect(loadDocgenServiceArgTypes('my-component')).resolves.toBeUndefined();
  });

  it('gives up after the bounded wait when the load never settles', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('FEATURES', { experimentalDocgenServer: true });
    mockDocgenService({ hang: true });

    const pending = loadDocgenServiceArgTypes('my-component');
    await vi.advanceTimersByTimeAsync(2000);

    await expect(pending).resolves.toBeUndefined();
  });
});

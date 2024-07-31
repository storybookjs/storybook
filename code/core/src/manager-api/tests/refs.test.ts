import { describe, it, expect, vi } from 'vitest';
import { global } from '@storybook/global';
import type { StoryIndex } from '@storybook/core/types';
import type { State } from '../root';
import { transformStoryIndexToStoriesHash } from '../lib/stories';
import { getSourceType, init as initRefs } from '../modules/refs';
import type Store from '../store';

const { fetch } = global;

const fetchMock = vi.mocked(fetch);

vi.mock('@storybook/global', () => {
  const globalMock = {
    fetch: vi.fn(() => Promise.resolve({})),
    REFS: {
      fake: {
        id: 'fake',
        url: 'https://example.com',
        title: 'Fake',
      },
    },
  };
  // Change global.location value to handle edge cases
  // Add additional variations of global.location mock return values in this array.
  // NOTE: The order must match the order that global.location is called in the unit tests.
  const edgecaseLocations = [
    { origin: 'https://storybook.js.org', pathname: '/storybook/iframe.html' },
  ];
  // global.location value after all edgecaseLocations are returned
  const lastLocation = { origin: 'https://storybook.js.org', pathname: '/storybook/' };
  Object.defineProperties(globalMock, {
    location: {
      get: edgecaseLocations
        .reduce((mockFn, location) => mockFn.mockReturnValueOnce(location), vi.fn())
        .mockReturnValue(lastLocation),
    },
  });
  return { global: globalMock };
});

const provider = {
  getConfig: vi.fn().mockReturnValue({}),
};

const store = {
  getState: vi.fn().mockReturnValue({
    filters: {},
    refs: {
      fake: {
        id: 'fake',
        url: 'https://example.com',
        title: 'Fake',
      },
    },
  }),
  setState: vi.fn((a: any) => {}),
};

function createMockStore(initialState: Partial<State> = {}) {
  let state = initialState;
  return {
    getState: vi.fn(() => state),
    setState: vi.fn((s: typeof state) => {
      state = { ...state, ...s };
      return Promise.resolve(state);
    }),
  } as any as Store;
}

interface ResponseResult {
  ok?: boolean;
  err?: Error;
  response?: () => never | object | Promise<object>;
}

type ResponseKeys =
  | 'indexPrivate'
  | 'indexPublic'
  | 'storiesPrivate'
  | 'storiesPublic'
  | 'iframe'
  | 'metadata';

function respond(result: ResponseResult): Promise<Response> {
  const { err, ok, response } = result;
  if (err) {
    return Promise.reject(err);
  }

  return Promise.resolve({
    ok: ok ?? !!response,
    json: response,
  } as Response);
}

const setupResponses = ({
  indexPrivate,
  indexPublic,
  storiesPrivate,
  storiesPublic,
  iframe,
  metadata,
}: Partial<Record<ResponseKeys, ResponseResult>>) => {
  fetchMock.mockClear();
  store.setState.mockClear();

  fetchMock.mockImplementation((l, o) => {
    if (typeof l !== 'string') {
      throw new Error('Wrong request type');
    }

    if (l.includes('index') && o?.credentials === 'include' && indexPrivate) {
      return respond(indexPrivate);
    }
    if (l.includes('index') && o?.credentials === 'omit' && indexPublic) {
      return respond(indexPublic);
    }
    if (l.includes('stories') && o?.credentials === 'include' && storiesPrivate) {
      return respond(storiesPrivate);
    }
    if (l.includes('stories') && o?.credentials === 'omit' && storiesPublic) {
      return respond(storiesPublic);
    }
    if (l.includes('iframe') && iframe) {
      return respond(iframe);
    }
    if (l.includes('metadata') && metadata) {
      return respond(metadata);
    }
    throw new Error(`Called URL ${l} without setting up mock`);
  });
};

describe('Refs API', () => {
  describe('getSourceType(source)', () => {
    // These tests must be run first and in correct order.
    // The order matches the "edgecaseLocations" order in the 'global' mock function above.
    describe('edge cases', () => {
      it('returns "local" when source matches location with /index.html in path', () => {
        // mockReturnValue(edgecaseLocations[0])
        expect(getSourceType('https://storybook.js.org/storybook/iframe.html')).toEqual([
          'local',
          'https://storybook.js.org/storybook',
        ]);
      });
      it('returns "correct url" when source does not match location', () => {
        expect(getSourceType('https://external.com/storybook/')).toEqual([
          'external',
          'https://external.com/storybook',
        ]);
      });
    });
    // Other tests use "lastLocation" for the 'global' mock
    it('returns "local" when source matches location', () => {
      expect(getSourceType('https://storybook.js.org/storybook/iframe.html')).toEqual([
        'local',
        'https://storybook.js.org/storybook',
      ]);
    });
    it('returns "external" when source does not match location', () => {
      expect(getSourceType('https://external.com/storybook/iframe.html')).toEqual([
        'external',
        'https://external.com/storybook',
      ]);
    });
  });

  describe('checkRef', () => {
    it('on initialization it checks refs', async () => {
      // given
      initRefs({ provider, store } as any);

      // the `runCheck` is async, so we need to wait for it to finish
      await vi.waitFor(() => fetchMock.mock.calls.length > 0);

      expect(fetchMock.mock.calls).toMatchInlineSnapshot(`
        [
          [
            "https://example.com/index.json",
            {
              "credentials": "include",
              "headers": {
                "Accept": "application/json",
              },
            },
          ],
          [
            "https://example.com/stories.json",
            {
              "credentials": "include",
              "headers": {
                "Accept": "application/json",
              },
            },
          ],
        ]
      `);
    });

    it('passes version when set on the ref', async () => {
      // given
      global.REFS = {
        fake: {
          id: 'fake',
          url: 'https://example.com',
          title: 'Fake',
          version: '2.1.3-rc.2',
        },
      };
      initRefs({ provider, store } as any);

      // the `runCheck` is async, so we need to wait for it to finish
      await vi.waitFor(() => fetchMock.mock.calls.length > 0);

      expect(fetchMock.mock.calls).toMatchInlineSnapshot(`
        [
          [
            "https://example.com/index.json?version=2.1.3-rc.2",
            {
              "credentials": "include",
              "headers": {
                "Accept": "application/json",
              },
            },
          ],
          [
            "https://example.com/stories.json?version=2.1.3-rc.2",
            {
              "credentials": "include",
              "headers": {
                "Accept": "application/json",
              },
            },
          ],
        ]
      `);
    });

    it('checks refs (all fail)', async () => {
      // given
      const { api } = initRefs({ provider, store } as any, { runCheck: false });

      setupResponses({
        indexPrivate: {
          ok: false,
          response: async () => {
            throw new Error('Failed to fetch');
          },
        },
        storiesPrivate: {
          ok: false,
          response: async () => {
            throw new Error('Failed to fetch');
          },
        },
      });

      await api.checkRef({
        id: 'fake',
        url: 'https://example.com',
        title: 'Fake',
      });

      expect(fetchMock.mock.calls).toMatchInlineSnapshot(`
        [
          [
            "https://example.com/index.json",
            {
              "credentials": "include",
              "headers": {
                "Accept": "application/json",
              },
            },
          ],
          [
            "https://example.com/stories.json",
            {
              "credentials": "include",
              "headers": {
                "Accept": "application/json",
              },
            },
          ],
        ]
      `);

      expect(store.setState.mock.calls[0][0]).toMatchInlineSnapshot(`
        {
          "refs": {
            "fake": {
              "id": "fake",
              "index": undefined,
              "indexError": {
                "message": "Error: Loading of ref failed
          at fetch (lib/api/src/modules/refs.ts)

        URL: https://example.com

        We weren't able to load the above URL,
        it's possible a CORS error happened.

        Please check your dev-tools network tab.",
              },
              "internal_index": undefined,
              "title": "Fake",
              "type": "auto-inject",
              "url": "https://example.com",
            },
          },
        }
      `);
    });

    it('checks refs (all throw)', async () => {
      // given
      const { api } = initRefs({ provider, store } as any, { runCheck: false });

      setupResponses({
        indexPrivate: {
          err: new Error('TypeError: Failed to fetch'),
        },
        storiesPrivate: {
          err: new Error('TypeError: Failed to fetch'),
        },
      });

      await api.checkRef({
        id: 'fake',
        url: 'https://example.com',
        title: 'Fake',
      });

      expect(fetchMock.mock.calls).toMatchInlineSnapshot(`
        [
          [
            "https://example.com/index.json",
            {
              "credentials": "include",
              "headers": {
                "Accept": "application/json",
              },
            },
          ],
          [
            "https://example.com/stories.json",
            {
              "credentials": "include",
              "headers": {
                "Accept": "application/json",
              },
            },
          ],
        ]
      `);

      expect(store.setState.mock.calls[0][0]).toMatchInlineSnapshot(`
        {
          "refs": {
            "fake": {
              "id": "fake",
              "index": undefined,
              "indexError": {
                "message": "Error: Loading of ref failed
          at fetch (lib/api/src/modules/refs.ts)

        URL: https://example.com

        We weren't able to load the above URL,
        it's possible a CORS error happened.

        Please check your dev-tools network tab.",
              },
              "internal_index": undefined,
              "title": "Fake",
              "type": "auto-inject",
              "url": "https://example.com",
            },
          },
        }
      `);
    });

    it('checks refs (index throws)', async () => {
      // given
      const { api } = initRefs({ provider, store } as any, { runCheck: false });

      setupResponses({
        indexPrivate: {
          err: new Error('TypeError: Failed to fetch'),
        },
        storiesPrivate: {
          ok: true,
          response: async () => ({ v: 3, stories: {} }),
        },
        metadata: {
          ok: true,
          response: async () => ({
            versions: {},
          }),
        },
      });

      await api.checkRef({
        id: 'fake',
        url: 'https://example.com',
        title: 'Fake',
      });

      expect(fetchMock.mock.calls).toMatchInlineSnapshot(`
        [
          [
            "https://example.com/index.json",
            {
              "credentials": "include",
              "headers": {
                "Accept": "application/json",
              },
            },
          ],
          [
            "https://example.com/stories.json",
            {
              "credentials": "include",
              "headers": {
                "Accept": "application/json",
              },
            },
          ],
          [
            "https://example.com/metadata.json",
            {
              "cache": "no-cache",
              "credentials": "include",
              "headers": {
                "Accept": "application/json",
              },
            },
          ],
        ]
      `);
    });

    it('checks refs (metadata throws)', async () => {
      // given
      const { api } = initRefs({ provider, store } as any, { runCheck: false });

      setupResponses({
        indexPrivate: {
          ok: true,
          response: async () => ({ v: 5, entries: {} }),
        },
        storiesPrivate: {
          ok: true,
          response: async () => ({ v: 3, stories: {} }),
        },
        metadata: {
          err: new Error('TypeError: Failed to fetch'),
        },
      });

      await api.checkRef({
        id: 'fake',
        url: 'https://example.com',
        title: 'Fake',
      });

      expect(fetchMock.mock.calls).toMatchInlineSnapshot(`
        [
          [
            "https://example.com/index.json",
            {
              "credentials": "include",
              "headers": {
                "Accept": "application/json",
              },
            },
          ],
          [
            "https://example.com/stories.json",
            {
              "credentials": "include",
              "headers": {
                "Accept": "application/json",
              },
            },
          ],
          [
            "https://example.com/metadata.json",
            {
              "cache": "no-cache",
              "credentials": "include",
              "headers": {
                "Accept": "application/json",
              },
            },
          ],
        ]
      `);

      expect(store.setState.mock.calls[0][0]).toMatchInlineSnapshot(`
        {
          "refs": {
            "fake": {
              "id": "fake",
              "index": {},
              "internal_index": {
                "entries": {},
                "v": 5,
              },
              "title": "Fake",
              "type": "lazy",
              "url": "https://example.com",
            },
          },
        }
      `);

      expect(store.setState.mock.calls[0][0]).toMatchInlineSnapshot(`
        {
          "refs": {
            "fake": {
              "id": "fake",
              "index": {},
              "internal_index": {
                "entries": {},
                "v": 5,
              },
              "title": "Fake",
              "type": "lazy",
              "url": "https://example.com",
            },
          },
        }
      `);
    });

    it('checks refs (success)', async () => {
      // given
      const { api } = initRefs({ provider, store } as any, { runCheck: false });

      setupResponses({
        indexPrivate: {
          ok: true,
          response: async () => ({ v: 5, entries: {} }),
        },
        storiesPrivate: {
          ok: true,
          response: async () => ({ v: 3, stories: {} }),
        },
        metadata: {
          ok: true,
          response: async () => ({
            versions: {},
          }),
        },
      });

      await api.checkRef({
        id: 'fake',
        url: 'https://example.com',
        title: 'Fake',
      });

      expect(fetchMock.mock.calls).toMatchInlineSnapshot(`
        [
          [
            "https://example.com/index.json",
            {
              "credentials": "include",
              "headers": {
                "Accept": "application/json",
              },
            },
          ],
          [
            "https://example.com/stories.json",
            {
              "credentials": "include",
              "headers": {
                "Accept": "application/json",
              },
            },
          ],
          [
            "https://example.com/metadata.json",
            {
              "cache": "no-cache",
              "credentials": "include",
              "headers": {
                "Accept": "application/json",
              },
            },
          ],
        ]
      `);

      expect(store.setState.mock.calls[0][0]).toMatchInlineSnapshot(`
        {
          "refs": {
            "fake": {
              "id": "fake",
              "index": {},
              "internal_index": {
                "entries": {},
                "v": 5,
              },
              "title": "Fake",
              "type": "lazy",
              "url": "https://example.com",
              "versions": {},
            },
          },
        }
      `);
    });

    it('checks refs (not replace versions)', async () => {
      // given
      const { api } = initRefs({ provider, store } as any, { runCheck: false });

      setupResponses({
        indexPrivate: {
          ok: true,
          response: async () => ({ v: 5, entries: {} }),
        },
        storiesPrivate: {
          ok: true,
          response: async () => ({ v: 3, stories: {} }),
        },
        metadata: {
          ok: true,
          response: async () => ({
            versions: {},
          }),
        },
      });

      await api.checkRef({
        id: 'fake',
        url: 'https://example.com',
        title: 'Fake',
        versions: { a: 'http://example.com/a', b: 'http://example.com/b' },
      });

      expect(fetchMock.mock.calls).toMatchInlineSnapshot(`
        [
          [
            "https://example.com/index.json",
            {
              "credentials": "include",
              "headers": {
                "Accept": "application/json",
              },
            },
          ],
          [
            "https://example.com/stories.json",
            {
              "credentials": "include",
              "headers": {
                "Accept": "application/json",
              },
            },
          ],
          [
            "https://example.com/metadata.json",
            {
              "cache": "no-cache",
              "credentials": "include",
              "headers": {
                "Accept": "application/json",
              },
            },
          ],
        ]
      `);

      expect(store.setState.mock.calls[0][0]).toMatchInlineSnapshot(`
        {
          "refs": {
            "fake": {
              "id": "fake",
              "index": {},
              "internal_index": {
                "entries": {},
                "v": 5,
              },
              "title": "Fake",
              "type": "lazy",
              "url": "https://example.com",
              "versions": {
                "a": "http://example.com/a",
                "b": "http://example.com/b",
              },
            },
          },
        }
      `);
    });

    it('checks refs (auth)', async () => {
      // given
      const { api } = initRefs({ provider, store } as any, { runCheck: false });

      setupResponses({
        indexPrivate: {
          ok: true,
          response: async () => ({ loginUrl: 'https://example.com/login' }),
        },
        storiesPrivate: {
          ok: true,
          response: async () => ({ loginUrl: 'https://example.com/login' }),
        },
        metadata: {
          ok: true,
          response: async () => ({ loginUrl: 'https://example.com/login' }),
        },
      });

      await api.checkRef({
        id: 'fake',
        url: 'https://example.com',
        title: 'Fake',
      });

      expect(fetchMock.mock.calls).toMatchInlineSnapshot(`
        [
          [
            "https://example.com/index.json",
            {
              "credentials": "include",
              "headers": {
                "Accept": "application/json",
              },
            },
          ],
          [
            "https://example.com/stories.json",
            {
              "credentials": "include",
              "headers": {
                "Accept": "application/json",
              },
            },
          ],
          [
            "https://example.com/metadata.json",
            {
              "cache": "no-cache",
              "credentials": "include",
              "headers": {
                "Accept": "application/json",
              },
            },
          ],
        ]
      `);

      expect(store.setState.mock.calls[0][0]).toMatchInlineSnapshot(`
        {
          "refs": {
            "fake": {
              "id": "fake",
              "index": undefined,
              "internal_index": undefined,
              "loginUrl": "https://example.com/login",
              "title": "Fake",
              "type": "auto-inject",
              "url": "https://example.com",
            },
          },
        }
      `);
    });

    it('checks refs (basic-auth)', async () => {
      // given
      const { api } = initRefs({ provider, store } as any, { runCheck: false });

      setupResponses({
        indexPrivate: {
          ok: true,
          response: async () => ({ v: 5, entries: {} }),
        },
        storiesPrivate: {
          ok: true,
          response: async () => ({ v: 3, stories: {} }),
        },
        metadata: {
          ok: true,
          response: async () => ({ versions: {} }),
        },
      });

      await api.checkRef({
        id: 'fake',
        url: 'https://user:pass@example.com',
        title: 'Fake',
      });

      expect(fetchMock.mock.calls).toMatchInlineSnapshot(`
        [
          [
            "https://example.com/index.json",
            {
              "credentials": "include",
              "headers": {
                "Accept": "application/json",
                "Authorization": "Basic dXNlcjpwYXNz",
              },
            },
          ],
          [
            "https://example.com/stories.json",
            {
              "credentials": "include",
              "headers": {
                "Accept": "application/json",
                "Authorization": "Basic dXNlcjpwYXNz",
              },
            },
          ],
          [
            "https://example.com/metadata.json",
            {
              "cache": "no-cache",
              "credentials": "include",
              "headers": {
                "Accept": "application/json",
                "Authorization": "Basic dXNlcjpwYXNz",
              },
            },
          ],
        ]
      `);
    });

    it('checks refs (mixed)', async () => {
      // given
      const { api } = initRefs({ provider, store } as any, { runCheck: false });

      fetchMock.mockClear();
      store.setState.mockClear();

      setupResponses({
        indexPrivate: {
          ok: true,
          response: async () => ({ loginUrl: 'https://example.com/login' }),
        },
        storiesPrivate: {
          ok: true,
          response: async () => ({ loginUrl: 'https://example.com/login' }),
        },
        metadata: {
          ok: true,
          response: async () => ({
            versions: { '1.0.0': 'https://example.com/v1', '2.0.0': 'https://example.com' },
          }),
        },
      });

      await api.checkRef({
        id: 'fake',
        url: 'https://example.com',
        title: 'Fake',
      });

      expect(fetchMock.mock.calls).toMatchInlineSnapshot(`
        [
          [
            "https://example.com/index.json",
            {
              "credentials": "include",
              "headers": {
                "Accept": "application/json",
              },
            },
          ],
          [
            "https://example.com/stories.json",
            {
              "credentials": "include",
              "headers": {
                "Accept": "application/json",
              },
            },
          ],
          [
            "https://example.com/metadata.json",
            {
              "cache": "no-cache",
              "credentials": "include",
              "headers": {
                "Accept": "application/json",
              },
            },
          ],
        ]
      `);

      expect(store.setState.mock.calls[0][0]).toMatchInlineSnapshot(`
        {
          "refs": {
            "fake": {
              "id": "fake",
              "index": undefined,
              "internal_index": undefined,
              "loginUrl": "https://example.com/login",
              "title": "Fake",
              "type": "auto-inject",
              "url": "https://example.com",
              "versions": {
                "1.0.0": "https://example.com/v1",
                "2.0.0": "https://example.com",
              },
            },
          },
        }
      `);
    });

    it('checks refs (serverside-success)', async () => {
      // given
      const { api } = initRefs({ provider, store } as any, { runCheck: false });

      setupResponses({
        indexPublic: {
          ok: true,
          response: async () => ({ v: 5, entries: {} }),
        },
        storiesPublic: {
          ok: true,
          response: async () => ({ v: 3, stories: {} }),
        },
        metadata: {
          ok: true,
          response: async () => ({
            versions: {},
          }),
        },
      });

      await api.checkRef({
        id: 'fake',
        url: 'https://example.com',
        title: 'Fake',
        type: 'server-checked',
      });

      expect(fetchMock.mock.calls).toMatchInlineSnapshot(`
        [
          [
            "https://example.com/index.json",
            {
              "credentials": "omit",
              "headers": {
                "Accept": "application/json",
              },
            },
          ],
          [
            "https://example.com/stories.json",
            {
              "credentials": "omit",
              "headers": {
                "Accept": "application/json",
              },
            },
          ],
          [
            "https://example.com/metadata.json",
            {
              "cache": "no-cache",
              "credentials": "omit",
              "headers": {
                "Accept": "application/json",
              },
            },
          ],
        ]
      `);

      expect(store.setState.mock.calls[0][0]).toMatchInlineSnapshot(`
        {
          "refs": {
            "fake": {
              "id": "fake",
              "index": {},
              "internal_index": {
                "entries": {},
                "v": 5,
              },
              "title": "Fake",
              "type": "lazy",
              "url": "https://example.com",
              "versions": {},
            },
          },
        }
      `);
    });

    it('checks refs (serverside-fail)', async () => {
      // given
      const { api } = initRefs({ provider, store } as any, { runCheck: false });

      setupResponses({
        indexPrivate: {
          ok: true,
          response: async () => ({ v: 5, entries: {} }),
        },
        storiesPrivate: {
          ok: true,
          response: async () => ({ v: 3, stories: {} }),
        },
        metadata: {
          ok: true,
          response: async () => ({
            versions: {},
          }),
        },
      });

      await api.checkRef({
        id: 'fake',
        url: 'https://example.com',
        title: 'Fake',
        type: 'unknown',
      });

      expect(fetchMock.mock.calls).toMatchInlineSnapshot(`
        [
          [
            "https://example.com/index.json",
            {
              "credentials": "include",
              "headers": {
                "Accept": "application/json",
              },
            },
          ],
          [
            "https://example.com/stories.json",
            {
              "credentials": "include",
              "headers": {
                "Accept": "application/json",
              },
            },
          ],
          [
            "https://example.com/metadata.json",
            {
              "cache": "no-cache",
              "credentials": "include",
              "headers": {
                "Accept": "application/json",
              },
            },
          ],
        ]
      `);

      expect(store.setState.mock.calls[0][0]).toMatchInlineSnapshot(`
        {
          "refs": {
            "fake": {
              "id": "fake",
              "index": {},
              "internal_index": {
                "entries": {},
                "v": 5,
              },
              "title": "Fake",
              "type": "lazy",
              "url": "https://example.com",
              "versions": {},
            },
          },
        }
      `);
    });

    describe('v3 compatibility', () => {
      it('infers docs only if there is only one story and it has the name "Page"', async () => {
        // given
        const { api } = initRefs({ provider, store } as any, { runCheck: false });

        const index = {
          v: 3,
          stories: {
            'component-a--page': {
              id: 'component-a--page',
              title: 'Component A',
              name: 'Page', // Called "Page" but not only story
              importPath: './path/to/component-a.ts',
            },
            'component-a--story-2': {
              id: 'component-a--story-2',
              title: 'Component A',
              name: 'Story 2',
              importPath: './path/to/component-a.ts',
            },
            'component-b--page': {
              id: 'component-b--page',
              title: 'Component B',
              name: 'Page', // Page and only story
              importPath: './path/to/component-b.ts',
            },
            'component-c--story-4': {
              id: 'component-c--story-4',
              title: 'Component c',
              name: 'Story 4', // Only story but not page
              importPath: './path/to/component-c.ts',
            },
          },
        };

        setupResponses({
          indexPrivate: { ok: false },
          storiesPrivate: {
            ok: true,
            response: async () => index,
          },
          metadata: {
            ok: true,
            response: async () => ({
              versions: {},
            }),
          },
        });

        await api.checkRef({
          id: 'fake',
          url: 'https://example.com',
          title: 'Fake',
        });

        const { refs } = store.setState.mock.calls[0][0];
        const hash = refs.fake.index;

        // We need exact key ordering, even if in theory JS doesn't guarantee it
        expect(Object.keys(hash)).toEqual([
          'component-a',
          'component-a--page',
          'component-a--story-2',
          'component-b',
          'component-b--page',
          'component-c',
          'component-c--story-4',
        ]);
        expect(hash['component-a--page'].type).toBe('story');
        expect(hash['component-a--story-2'].type).toBe('story');
        expect(hash['component-b--page'].type).toBe('docs');
        expect(hash['component-c--story-4'].type).toBe('story');
      });

      it('prefers parameters.docsOnly to inferred docsOnly status', async () => {
        const { api } = initRefs({ provider, store } as any, { runCheck: false });

        const index = {
          v: 3,
          stories: {
            'component-a--docs': {
              id: 'component-a--docs',
              title: 'Component A',
              name: 'Docs', // Called 'Docs' rather than 'Page'
              importPath: './path/to/component-a.ts',
              parameters: {
                docsOnly: true,
              },
            },
          },
        };
        setupResponses({
          indexPrivate: { ok: false },
          storiesPrivate: {
            ok: true,
            response: async () => index,
          },
          metadata: {
            ok: true,
            response: async () => ({
              versions: {},
            }),
          },
        });

        await api.checkRef({
          id: 'fake',
          url: 'https://example.com',
          title: 'Fake',
        });

        const { refs } = store.setState.mock.calls[0][0];
        const hash = refs.fake.index;

        // We need exact key ordering, even if in theory JS doesn't guarantee it
        expect(Object.keys(hash)).toEqual(['component-a', 'component-a--docs']);
        expect(hash['component-a--docs'].type).toBe('docs');
      });
    });
  });

  describe('setRef', () => {
    it('can filter', async () => {
      const index: StoryIndex = {
        v: 5,
        entries: {
          'a--1': {
            id: 'a--1',
            title: 'A',
            name: '1',
            importPath: './path/to/a1.ts',
            type: 'story',
          },
          'a--2': {
            id: 'a--2',
            title: 'A',
            name: '2',
            importPath: './path/to/a2.ts',
            type: 'story',
          },
        },
      };

      const initialState: Partial<State> = {
        refs: {
          fake: {
            id: 'fake',
            url: 'https://example.com',
            previewInitialized: true,
            index: transformStoryIndexToStoriesHash(index, {
              provider: provider as any,
              docsOptions: {},
              filters: {},
              status: {},
            }),
            internal_index: index,
          },
        },
      };
      // eslint-disable-next-line @typescript-eslint/no-shadow
      const store = createMockStore(initialState);
      const { api } = initRefs({ provider, store } as any, { runCheck: false });

      await expect(api.getRefs().fake.index).toEqual(
        expect.objectContaining({ 'a--2': expect.anything() })
      );

      const stateWithFilters: Partial<State> = {
        filters: {
          fake: (a) => a.name.includes('1'),
        },
      };

      await store.setState(stateWithFilters);

      await api.setRef('fake', { storyIndex: index });

      await expect(api.getRefs().fake.index).toEqual(
        expect.objectContaining({ 'a--1': expect.anything() })
      );
      await expect(api.getRefs().fake.index).not.toEqual(
        expect.objectContaining({ 'a--2': expect.anything() })
      );
    });
  });

  it('errors on unknown version', async () => {
    // given
    const { api } = initRefs({ provider, store } as any, { runCheck: false });

    setupResponses({
      indexPrivate: {
        ok: false,
      },
      storiesPrivate: {
        ok: true,
        response: async () => ({ stories: {} }),
      },
      metadata: {
        ok: true,
        response: async () => ({
          versions: {},
        }),
      },
    });

    await expect(
      api.checkRef({
        id: 'fake',
        url: 'https://example.com',
        title: 'Fake',
      })
    ).rejects.toThrow('Composition: Missing stories.json version');
  });
});

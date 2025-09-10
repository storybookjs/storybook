import State from './State.svelte';

export default {
  title: 'stories/frameworks/sveltekit/modules/state',
  component: State,
};

export const DefaultState = {};

export const WithPageData = {
  parameters: {
    sveltekit_experimental: {
      state: {
        page: {
          url: new URL('https://example.com/test?query=value'),
          params: {
            id: '123',
            slug: 'test-slug'
          },
          data: {
            user: {
              name: 'Test User',
              email: 'test@example.com'
            },
            posts: ['Post 1', 'Post 2']
          },
          status: 200,
          error: null,
          form: null,
          state: {
            counter: 42
          }
        },
      },
    },
  },
};

export const WithNavigating = {
  parameters: {
    sveltekit_experimental: {
      state: {
        navigating: {
          from: {
            params: {},
            route: { id: '/' },
            url: new URL('https://example.com/')
          },
          to: {
            params: { id: '456' },
            route: { id: '/posts/[id]' },
            url: new URL('https://example.com/posts/456')
          },
          type: 'link',
          willUnload: false,
          delta: 1,
          complete: Promise.resolve()
        },
      },
    },
  },
};

export const WithUpdated = {
  parameters: {
    sveltekit_experimental: {
      state: {
        updated: true,
      },
    },
  },
};

export const WithPageError = {
  parameters: {
    sveltekit_experimental: {
      state: {
        page: {
          url: new URL('https://example.com/error'),
          params: {},
          data: null,
          status: 404,
          error: {
            message: 'Page not found',
            status: 404
          },
          form: null,
          state: {}
        },
      },
    },
  },
};

export const WithFormData = {
  parameters: {
    sveltekit_experimental: {
      state: {
        page: {
          url: new URL('https://example.com/contact'),
          params: {},
          data: {},
          status: 200,
          error: null,
          form: {
            success: true,
            message: 'Form submitted successfully'
          },
          state: {}
        },
      },
    },
  },
};

export const CompleteState = {
  parameters: {
    sveltekit_experimental: {
      state: {
        page: {
          url: new URL('https://example.com/complete?test=true'),
          params: {
            id: '789',
            category: 'tech'
          },
          data: {
            title: 'Complete Test',
            content: 'This is a complete state test'
          },
          status: 200,
          error: null,
          form: {
            submitted: true
          },
          state: {
            theme: 'dark',
            sidebarOpen: true
          }
        },
        navigating: {
          from: null,
          to: {
            params: { id: '789' },
            route: { id: '/posts/[id]' },
            url: new URL('https://example.com/posts/789')
          },
          type: 'goto',
          willUnload: false,
          delta: null,
          complete: Promise.resolve()
        },
        updated: false,
      },
    },
  },
};
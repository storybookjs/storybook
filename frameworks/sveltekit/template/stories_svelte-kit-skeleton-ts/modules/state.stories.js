import State from './State.svelte';

export default {
  title: 'stories/frameworks/sveltekit/modules/state',
  component: State,
  parameters: {
    sveltekit_experimental: {
      state: {
        page: {
          url: new URL('https://storybook.js.org'), // necessary to make the rendered output deterministic in CH snapshots
        },
      },
    },
  },
};

export const Default = {};

export const Page = {
  parameters: {
    sveltekit_experimental: {
      state: {
        page: {
          data: {
            test: 'passed',
          },
          form: {
            framework: 'SvelteKit',
            rating: 5,
          },
          params: {
            referrer: 'storybook',
          },
          route: {
            id: '/framework/sveltekit',
          },
          status: 200,
          url: new URL('https://svelte.dev/docs/kit/'),
        },
      },
    },
  },
};

export const Navigating = {
  parameters: {
    sveltekit_experimental: {
      state: {
        navigating: {
          from: {
            params: {
              framework: 'SvelteKit',
            },
            route: {
              id: '/framework/sveltekit',
            },
            url: new URL('https://svelte.dev'),
          },
          to: {
            route: { id: '/storybook' },
            params: {},
            url: new URL('https://storybook.js.org'),
          },
          type: 'link',
          willUnload: true,
          delta: 3,
          complete: Promise.resolve(),
        },
      },
    },
  },
};

export const Updated = {
  parameters: {
    sveltekit_experimental: {
      state: {
        updated: {
          current: true,
        },
      },
    },
  },
};

import State from './State.svelte';

export default {
  title: 'stories/frameworks/sveltekit/modules/state',
  component: State,
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
          route: {
            id: '/storybook',
          },
          type: 'enter',
          willUnload: true,
          delta: 3,
          complete: Promise.resolve(true),
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

export const PageAndNavigating = {
  parameters: {
    sveltekit_experimental: {
      state: {
        page: {
          data: {
            test: 'passed',
          },
        },
        navigating: {
          route: {
            id: '/storybook',
          },
        },
      },
    },
  },
};

export const PageAndUpdated = {
  parameters: {
    sveltekit_experimental: {
      state: {
        page: {
          data: {
            test: 'passed',
          },
        },
        updated: {
          current: true,
        },
      },
    },
  },
};

export const NavigatingAndUpdated = {
  parameters: {
    sveltekit_experimental: {
      state: {
        navigating: {
          route: {
            id: '/storybook',
          },
        },
        updated: {
          current: true,
        },
      },
    },
  },
};

export const AllThree = {
  parameters: {
    sveltekit_experimental: {
      state: {
        page: {
          data: {
            test: 'passed',
          },
        },
        navigating: {
          route: {
            id: '/storybook',
          },
        },
        updated: {
          current: true,
        },
      },
    },
  },
};

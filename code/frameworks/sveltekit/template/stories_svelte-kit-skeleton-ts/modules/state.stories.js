import State from './State.svelte';

export default {
  title: 'stories/frameworks/sveltekit/modules/state',
  component: State,
};

export const AllUndefined = {};

export const Page = {
  parameters: {
    sveltekit_experimental: {
      state: {
        page: {
          data: {
            test: 'passed',
          },
        },
      },
    },
  },
};

export const Navigating = {
  parameters: {
    sveltekit_experimental: {
      navigating: {
        route: {
          id: '/storybook',
        },
      },
    },
  },
};

export const Updated = {
  parameters: {
    sveltekit_experimental: {
      updated: true,
    },
  },
};

export const PageAndNavigating = {
  parameters: {
    sveltekit_experimental: {
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
};

export const PageAndUpdated = {
  parameters: {
    sveltekit_experimental: {
      page: {
        data: {
          test: 'passed',
        },
      },
      updated: true,
    },
  },
};

export const NavigatingAndUpdated = {
  parameters: {
    sveltekit_experimental: {
      navigating: {
        route: {
          id: '/storybook',
        },
      },
      updated: true,
    },
  },
};

export const AllThree = {
  parameters: {
    sveltekit_experimental: {
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
      updated: true,
    },
  },
};

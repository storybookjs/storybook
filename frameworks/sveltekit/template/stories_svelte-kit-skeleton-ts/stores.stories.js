import Stores from './Stores.svelte';

export default {
  title: 'stories/sveltekit/modules/stores',
  component: Stores,
  tags: ['autodocs'],
};

export const AllUndefined = {};

export const PageStore = {
  parameters: {
    sveltekit_experimental: {
      stores: {
        page: {
          data: {
            test: 'passed',
          },
        },
      },
    },
  },
};

export const NavigatingStore = {
  parameters: {
    sveltekit_experimental: {
      stores: {
        navigating: {
          route: {
            id: '/storybook',
          },
        },
      },
    },
  },
};

export const UpdatedStore = {
  parameters: {
    sveltekit_experimental: {
      stores: {
        updated: true,
      },
    },
  },
};

export const PageAndNavigatingStore = {
  parameters: {
    sveltekit_experimental: {
      stores: {
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

export const PageAndUpdatedStore = {
  parameters: {
    sveltekit_experimental: {
      stores: {
        page: {
          data: {
            test: 'passed',
          },
        },
        updated: true,
      },
    },
  },
};

export const NavigatingAndUpdatedStore = {
  parameters: {
    sveltekit_experimental: {
      stores: {
        navigating: {
          route: {
            id: '/storybook',
          },
        },
        updated: true,
      },
    },
  },
};

export const AllThreeStores = {
  parameters: {
    sveltekit_experimental: {
      stores: {
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
  },
};

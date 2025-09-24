//! this config isn't actually used, it's just here to tell svelte-check that we have async enabled

const config = {
  kit: {
    experimental: {
      remoteFunctions: true,
    },
  },
  compilerOptions: {
    experimental: {
      async: true,
    },
  },
};

export default config;

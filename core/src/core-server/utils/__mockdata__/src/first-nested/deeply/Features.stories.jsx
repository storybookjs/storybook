const component = {};
export default {
  component,
};

export const WithPlay = {
  play: async () => {},
};

export const WithStoryFn = () => {};

export const WithRender = {
  render: () => {},
};

export const WithTest = {
  beforeEach: async () => {},
  play: async ({ mount }) => {
    await mount();
  },
};

export const WithCSF1 = {
  parameters: {},
  decorators: [],
  loaders: [],
};

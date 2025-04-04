const config = {
  stories: [
    '../Introduction.mdx',
    {
      directory: '../components',
      titlePrefix: 'Demo',
      files: '**/!(Template).(stories.tsx|mdx)',
    },
  ],
  logLevel: 'debug',
  typescript: {
    check: true,
    checkOptions: {},
    reactDocgenTypescriptOptions: {
      propFilter: (prop) => ['label', 'disabled'].includes(prop.name),
    },
  },
  core: {
    channelOptions: { maxDepth: 10 },
  },
  features: {
    warnOnLegacyHierarchySeparator: false,
    previewMdx2: true,
  },
  framework: '@storybook/react-webpack5',
};
module.exports = config;

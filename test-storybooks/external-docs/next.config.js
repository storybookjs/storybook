const { IgnorePlugin } = require('webpack');

// next.config.js
const withNextra = require('nextra')({
  theme: 'nextra-theme-docs',
  themeConfig: './theme.config.js',
  // optional: add `unstable_staticImage: true` to enable Nextra's auto image import
});

module.exports = withNextra({
  reactStrictMode: true,

  // We use a custom webpack config here to work around https://github.com/storybookjs/storybook/issues/17926
  // We can remove this when the monorepo is upgraded to `react@18`.
  //   (Currently external docs do not work with React <18, without a simlar workaround)
  webpack(config) {
    return {
      ...config,
      plugins: [...config.plugins, new IgnorePlugin({ resourceRegExp: /react-dom\/client$/ })],
    };
  },
});

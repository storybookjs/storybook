```js filename="postcss.config.js" renderer="react" language="js"
module.exports = {
  plugins: {
    '@stylexjs/postcss-plugin': {
      include: [
        'src/**/*.{js,jsx,ts,tsx}',
        // Only if you use tokens from a package (see "Tokens from a package")
        'node_modules/your-tokens-package/**/*.js',
      ],
      // The same StyleX options as babel.config.js
      babelConfig: {
        babelrc: false,
        parserOpts: { plugins: ['typescript', 'jsx'] },
        plugins: [
          [
            '@stylexjs/babel-plugin',
            {
              dev: process.env.NODE_ENV === 'development',
              runtimeInjection: false,
              treeshakeCompensation: true,
              unstable_moduleResolution: { type: 'commonJS' },
            },
          ],
        ],
      },
      useCSSLayers: { before: ['reset'] },
    },
  },
};
```

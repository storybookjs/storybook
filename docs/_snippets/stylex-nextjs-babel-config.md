```js filename="babel.config.js" renderer="react" language="js"
module.exports = {
  presets: ['next/babel'],
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
};
```

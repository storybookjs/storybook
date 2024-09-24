```js filename=".storybook/main.js" renderer="common" language="js"
export default {
  core: {
    builder: {
      name: 'webpack5',
      options: {
        fsCache: true,
      },
    },
  },
};
```


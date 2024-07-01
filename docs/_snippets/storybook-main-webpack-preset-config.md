```js filename=".storybook/main.js" renderer="common" language="js"
export async function webpack(baseConfig, options) {
  // Modify or replace config.
  // Mutating the original reference object can cause unexpected bugs,
  // so in this example we replace.
  const { module = {} } = baseConfig;

  return {
    ...baseConfig,
    module: {
      ...module,
      rules: [
        ...(module.rules || []),
        {
          /* some new loader */
        },
      ],
    },
  };
}
```


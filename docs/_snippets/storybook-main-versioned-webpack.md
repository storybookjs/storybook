```js filename=".storybook/main.js" renderer="common" language="js"
export function webpackFinal(config, { presets }) {
  const version = await presets.apply('webpackVersion');
  const instance = (await presets.apply('webpackInstance'))?.default;

  logger.info(`=> Running in webpack ${version}: ${instance}`);
  return config;
}
```

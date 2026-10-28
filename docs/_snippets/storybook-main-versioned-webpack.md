```js filename=".storybook/main.js" renderer="common" language="js"
export async function webpackFinal(config, { webpackInstance }) {
  logger.info(`=> Running in webpack ${webpackInstance.version}`);
  return config;
}
```

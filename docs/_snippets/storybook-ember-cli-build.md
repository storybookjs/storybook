```js filename="ember-cli-build.js" renderer="ember" language="js"
'use strict';

const EmberApp = require('ember-cli/lib/broccoli/ember-app');

module.exports = function (defaults) {
  const app = new EmberApp(defaults, {
    '@storybook/ember-cli-storybook': {
      enableAddonDocsIntegration: true,
    },
  });

  return app.toTree();
};
```


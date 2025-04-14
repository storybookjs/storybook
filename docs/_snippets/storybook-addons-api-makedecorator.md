```js filename="my-addon/src/decorator.js|ts" renderer="common" language="js"
import { makeDecorator } from '@storybook/preview-api';

export const withAddonDecorator = makeDecorator({
  name: 'withSomething',
  parameterName: 'CustomParameter',
  skipIfNoParametersOrOptions: true
  wrapper: (getStory, context, { parameters }) => {
    /*
    * Write your custom logic here based on the parameters passed in Storybook's stories.
    * Although not advised, you can also alter the story output based on the parameters.
    */
    return getStory(context);
  },
});
```

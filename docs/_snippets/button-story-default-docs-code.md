```js filename="Button.stories.js" renderer="svelte" language="js"
import Button from './Button.svelte';

export default {
  /* 👇 The title prop is optional.
   * See https://storybook.js.org/docs/configure/#configure-story-loading
   * to learn how to generate automatic titles
   */
  title: 'Button',
  component: Button,
  //👇 Creates specific argTypes
  argTypes: {
    backgroundColor: { control: 'color' },
  },
};

//👇 Some function to demonstrate the behavior
const someFunction = (someValue) => {
  return `i am a ${someValue}`;
};

export const ExampleStory = (args) => {
  //👇 Destructure the label from the args object
  const { label } = args;

  //👇 Assigns the function result to a variable and pass it as a prop into the component
  const functionResult = someFunction(label);
  return {
    Component: Button,
    props: {
      ...args,
      label: functionResult,
    },
  };
};
ExampleStory.args = {
  primary: true,
  size: 'small',
  label: 'button',
};
```

```html renderer="svelte" language="ts" tabTitle="native-format"
{/* Button.stories.svelte */}

<script>
  import { Meta, Template, Story } from '@storybook/addon-svelte-csf';

  import Button from './Button.svelte';

  //👇 Some function to demonstrate the behavior
  function someFunction(someValue) {
    return `i am a ${someValue}`;
  }
</script>

{/*👇 Creates specific argTypes */}
<Meta title="Button" component={Button} argTypes={{ backgroundColor: { control: 'color' }, }} />

{/* 👇 Assigns the function result to a variable and pass it as a prop into the component */}
<template let:args>
  <button {...args} label="{someFunction(args.label)}" />
</template>

<Story name="ExampleStory" args={{ primary: true, size:'small', label: 'Button', }} />
```


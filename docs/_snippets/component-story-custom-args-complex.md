```ts filename="YourComponent.stories.ts" renderer="angular" language="ts"
import type { Meta, StoryObj } from '@storybook/angular';

import { YourComponent } from './your-component.component';

const meta: Meta<YourComponent> = {
  component: YourComponent,
  //👇 Creates specific argTypes with options
  argTypes: {
    propertyA: {
      options: ['Item One', 'Item Two', 'Item Three'],
      control: { type: 'select' }, // automatically inferred when 'options' is defined
    },
    propertyB: {
      options: ['Another Item One', 'Another Item Two', 'Another Item Three'],
    },
  },
};

export default meta;
type Story = StoryObj<YourComponent>;

const someFunction = (valuePropertyA: String, valuePropertyB: String) => {
  // Do some logic here
};

export const ExampleStory: Story = {
  render: (args) => {
    const { propertyA, propertyB } = args;
    //👇 Assigns the function result to a variable
    const someFunctionResult = someFunction(propertyA, propertyB);
    return {
      props: {
        ...args,
        someProperty: someFunctionResult,
      },
    };
  },
  args: { propertyA: 'Item One', propertyB: 'Another Item One' },
};
```

```js filename="YourComponent.stories.js|jsx" renderer="react" language="js"
import { YourComponent } from './your-component';

export default {
  component: YourComponent,
  //👇 Creates specific argTypes with options
  argTypes: {
    propertyA: {
      options: ['Item One', 'Item Two', 'Item Three'],
      control: { type: 'select' }, // Automatically inferred when 'options' is defined
    },
    propertyB: {
      options: ['Another Item One', 'Another Item Two', 'Another Item Three'],
    },
  },
};

const someFunction = (valuePropertyA, valuePropertyB) => {
  // Do some logic here
};

export const ExampleStory = {
  render: (args) => {
    const { propertyA, propertyB } = args;
    //👇 Assigns the function result to a variable
    const someFunctionResult = someFunction(propertyA, propertyB);

    return <YourComponent {...args} someProperty={someFunctionResult} />;
  },
  args: {
    propertyA: 'Item One',
    propertyB: 'Another Item One',
  },
};
```

```ts filename="YourComponent.stories.ts|tsx" renderer="react" language="ts-4-9"
import type { Meta, StoryObj } from '@storybook/react';

import { YourComponent } from './your-component';

const meta = {
  component: YourComponent,
  //👇 Creates specific argTypes with options
  argTypes: {
    propertyA: {
      options: ['Item One', 'Item Two', 'Item Three'],
      control: { type: 'select' }, // Automatically inferred when 'options' is defined
    },
    propertyB: {
      options: ['Another Item One', 'Another Item Two', 'Another Item Three'],
    },
  },
} satisfies Meta<typeof YourComponent>;

export default meta;
type Story = StoryObj<typeof meta>;

const someFunction = (valuePropertyA, valuePropertyB) => {
  // Do some logic here
};

export const ExampleStory: Story = {
  render: (args) => {
    const { propertyA, propertyB } = args;
    //👇 Assigns the function result to a variable
    const someFunctionResult = someFunction(propertyA, propertyB);

    return <YourComponent {...args} someProperty={someFunctionResult} />;
  },
  args: {
    propertyA: 'Item One',
    propertyB: 'Another Item One',
  },
};
```

```tsx filename="YourComponent.stories.ts|tsx" renderer="react" language="ts"
import type { Meta, StoryObj } from '@storybook/react';

import { YourComponent } from './your-component';

const meta: Meta<typeof YourComponent> = {
  component: YourComponent,
  //👇 Creates specific argTypes with options
  argTypes: {
    propertyA: {
      options: ['Item One', 'Item Two', 'Item Three'],
      control: { type: 'select' }, // Automatically inferred when 'options' is defined
    },
    propertyB: {
      options: ['Another Item One', 'Another Item Two', 'Another Item Three'],
    },
  },
};

export default meta;
type Story = StoryObj<typeof YourComponent>;

const someFunction = (valuePropertyA, valuePropertyB) => {
  // Do some logic here
};

export const ExampleStory: Story = {
  render: (args) => {
    const { propertyA, propertyB } = args;
    //👇 Assigns the function result to a variable
    const someFunctionResult = someFunction(propertyA, propertyB);

    return <YourComponent {...args} someProperty={someFunctionResult} />;
  },
  args: {
    propertyA: 'Item One',
    propertyB: 'Another Item One',
  },
};
```

```js filename="YourComponent.stories.js|jsx" renderer="solid" language="js"
import { createSignal, createEffect } from 'solid-js';
import { YourComponent } from './your-component';

export default {
  component: YourComponent,
  //👇 Creates specific argTypes with options
  argTypes: {
    propertyA: {
      options: ['Item One', 'Item Two', 'Item Three'],
      control: { type: 'select' }, // Automatically inferred when 'options' is defined
    },
    propertyB: {
      options: ['Another Item One', 'Another Item Two', 'Another Item Three'],
    },
  },
};

const someFunction = (valuePropertyA, valuePropertyB) => {
  // Do some logic here
};

export const ExampleStory = {
  render: (args) => {
    const [someFunctionResult, setSomeFunctionResult] = createSignal();

    //👇 Assigns the function result to a signal
    createEffect(() => {
      setSomeFunctionResult(someFunction(args.propertyA, args.propertyB));
    });

    return <YourComponent {...args} someProperty={someFunctionResult()} />;
  },
  args: {
    propertyA: 'Item One',
    propertyB: 'Another Item One',
  },
};
```

```tsx filename="YourComponent.stories.ts|tsx" renderer="solid" language="ts-4-9"
import { createSignal, createEffect } from 'solid-js';
import type { Meta, StoryObj } from 'storybook-solidjs';

import { YourComponent } from './your-component';

const meta = {
  component: YourComponent,
  //👇 Creates specific argTypes with options
  argTypes: {
    propertyA: {
      options: ['Item One', 'Item Two', 'Item Three'],
      control: { type: 'select' }, // Automatically inferred when 'options' is defined
    },
    propertyB: {
      options: ['Another Item One', 'Another Item Two', 'Another Item Three'],
    },
  },
} satisfies Meta<typeof YourComponent>;

export default meta;
type Story = StoryObj<typeof meta>;

const someFunction = (valuePropertyA, valuePropertyB) => {
  // Do some logic here
};

export const ExampleStory: Story = {
  render: (args) => {
    const [someFunctionResult, setSomeFunctionResult] = createSignal();

    //👇 Assigns the function result to a signal
    createEffect(() => {
      setSomeFunctionResult(someFunction(args.propertyA, args.propertyB));
    });

    return <YourComponent {...args} someProperty={someFunctionResult()} />;
  },
  args: {
    propertyA: 'Item One',
    propertyB: 'Another Item One',
  },
};
```

```tsx filename="YourComponent.stories.ts|tsx" renderer="solid" language="ts"
import { createSignal, createEffect } from 'solid-js';
import type { Meta, StoryObj } from 'storybook-solidjs';

import { YourComponent } from './your-component';

const meta: Meta<typeof YourComponent> = {
  component: YourComponent,
  //👇 Creates specific argTypes with options
  argTypes: {
    propertyA: {
      options: ['Item One', 'Item Two', 'Item Three'],
      control: { type: 'select' }, // Automatically inferred when 'options' is defined
    },
    propertyB: {
      options: ['Another Item One', 'Another Item Two', 'Another Item Three'],
    },
  },
};

export default meta;
type Story = StoryObj<typeof YourComponent>;

const someFunction = (valuePropertyA, valuePropertyB) => {
  // Do some logic here
};

export const ExampleStory: Story = {
  render: (args) => {
    const [someFunctionResult, setSomeFunctionResult] = createSignal();

    //👇 Assigns the function result to a signal
    createEffect(() => {
      setSomeFunctionResult(someFunction(args.propertyA, args.propertyB));
    });

    return <YourComponent {...args} someProperty={someFunctionResult()} />;
  },
  args: {
    propertyA: 'Item One',
    propertyB: 'Another Item One',
  },
};
```

```svelte filename="YourComponent.stories.svelte" renderer="svelte" language="js" tabTitle="Svelte CSF"
<script module>
  import { defineMeta } from '@storybook/addon-svelte-csf';

  const { Story } = defineMeta({
      component: YourComponent,
      //👇 Creates specific argTypes
      argTypes: {
        propertyA: {
          options: ['Item One', 'Item Two', 'Item Three'],
          control: { type: 'select' }, // Automatically inferred when 'options' is defined
        },
        propertyB: {
          options: ['Another Item One', 'Another Item Two', 'Another Item Three'],
        },
      },
  });

  const someFunction = (valuePropertyA, valuePropertyB) => {
    // Do some logic here
  };
</script>

<Story
  name="ExampleStory"
  args={{
    propertyA: 'Item One',
    propertyB: 'Another Item One',
  }}
>
  {#snippet children(args)}
    <YourComponent
      {...args}
      someProperty={someFunction(args.propertyA, args.propertyB)}
    />
  {/snippet}
</Story>
```

```js filename="YourComponent.stories.js" renderer="svelte" language="js" tabTitle="CSF"
import YourComponent from './YourComponent.svelte';

export default {
  component: YourComponent,
  //👇 Creates specific argTypes
  argTypes: {
    propertyA: {
      options: ['Item One', 'Item Two', 'Item Three'],
      control: { type: 'select' }, // Automatically inferred when 'options' is defined
    },
    propertyB: {
      options: ['Another Item One', 'Another Item Two', 'Another Item Three'],
    },
  },
};

const someFunction = (valuePropertyA, valuePropertyB) => {
  // Do some logic here
};

export const ExampleStory = {
  render: (args) => {
    //👇 Assigns the function result to a variable
    const someFunctionResult = someFunction(args.propertyA, args.propertyB);
    return {
      Component: YourComponent,
      props: {
        ...args,
        someProperty: someFunctionResult,
      },
    };
  },
  args: {
    propertyA: 'Item One',
    propertyB: 'Another Item One',
  },
};
```

```svelte filename="YourComponent.stories.svelte" renderer="svelte" language="ts-4-9" tabTitle="Svelte CSF"
<script module>
  import { defineMeta } from '@storybook/addon-svelte-csf';

  const { Story } = defineMeta({
      component: YourComponent,
      //👇 Creates specific argTypes
      argTypes: {
        propertyA: {
          options: ['Item One', 'Item Two', 'Item Three'],
          control: { type: 'select' }, // Automatically inferred when 'options' is defined
        },
        propertyB: {
          options: ['Another Item One', 'Another Item Two', 'Another Item Three'],
        },
      },
  });

  const someFunction = (valuePropertyA, valuePropertyB) => {
    // Do some logic here
  };
</script>

<Story
  name="ExampleStory"
  args={{
    propertyA: 'Item One',
    propertyB: 'Another Item One',
  }}
>
  {#snippet children(args)}
    <YourComponent
      {...args}
      someProperty={someFunction(args.propertyA, args.propertyB)}
    />
  {/snippet}
</Story>
```

```ts filename="YourComponent.stories.ts" renderer="svelte" language="ts-4-9" tabTitle="CSF"
import type { Meta, StoryObj } from '@storybook/svelte';

import YourComponent from './YourComponent.svelte';

const meta = {
  component: YourComponent,
  //👇 Creates specific argTypes
  argTypes: {
    propertyA: {
      options: ['Item One', 'Item Two', 'Item Three'],
      control: { type: 'select' }, // Automatically inferred when 'options' is defined
    },
    propertyB: {
      options: ['Another Item One', 'Another Item Two', 'Another Item Three'],
    },
  },
} satisfies Meta<typeof YourComponent>;

export default meta;
type Story = StoryObj<typeof meta>;

const someFunction = (valuePropertyA, valuePropertyB) => {
  // Do some logic here
};

export const ExampleStory: Story = {
  render: (args) => {
    //👇 Assigns the function result to a variable
    const someFunctionResult = someFunction(args.propertyA, args.propertyB);
    return {
      Component: YourComponent,
      props: {
        ...args,
        someProperty: someFunctionResult,
      },
    };
  },
  args: {
    propertyA: 'Item One',
    propertyB: 'Another Item One',
  },
};
```

```svelte filename="YourComponent.stories.svelte" renderer="svelte" language="ts" tabTitle="Svelte CSF"
<script module>
  import { defineMeta } from '@storybook/addon-svelte-csf';

  const { Story } = defineMeta({
      component: YourComponent,
      //👇 Creates specific argTypes
      argTypes: {
        propertyA: {
          options: ['Item One', 'Item Two', 'Item Three'],
          control: { type: 'select' }, // Automatically inferred when 'options' is defined
        },
        propertyB: {
          options: ['Another Item One', 'Another Item Two', 'Another Item Three'],
        },
      },
  });

  const someFunction = (valuePropertyA, valuePropertyB) => {
    // Do some logic here
  };
</script>

<Story
  name="ExampleStory"
  args={{
    propertyA: 'Item One',
    propertyB: 'Another Item One',
  }}
>
  {#snippet children(args)}
    <YourComponent
      {...args}
      someProperty={someFunction(args.propertyA, args.propertyB)}
    />
  {/snippet}
</Story>
```

```ts filename="YourComponent.stories.ts" renderer="svelte" language="ts" tabTitle="CSF"
import type { Meta, StoryObj } from '@storybook/svelte';

import YourComponent from './YourComponent.svelte';

const meta: Meta<typeof YourComponent> = {
  component: YourComponent,
  //👇 Creates specific argTypes
  argTypes: {
    propertyA: {
      options: ['Item One', 'Item Two', 'Item Three'],
      control: { type: 'select' }, // Automatically inferred when 'options' is defined
    },
    propertyB: {
      options: ['Another Item One', 'Another Item Two', 'Another Item Three'],
    },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

const someFunction = (valuePropertyA, valuePropertyB) => {
  // Do some logic here
};

export const ExampleStory: Story = {
  render: (args) => {
    //👇 Assigns the function result to a variable
    const someFunctionResult = someFunction(args.propertyA, args.propertyB);
    return {
      Component: YourComponent,
      props: {
        ...args,
        someProperty: someFunctionResult,
      },
    };
  },
  args: {
    propertyA: 'Item One',
    propertyB: 'Another Item One',
  },
};
```

```js filename="YourComponent.stories.js" renderer="vue" language="js"
import YourComponent from './YourComponent.vue';

export default {
  component: YourComponent,
  //👇 Creates specific argTypes with options
  argTypes: {
    propertyA: {
      options: ['Item One', 'Item Two', 'Item Three'],
      control: { type: 'select' }, // automatically inferred when 'options' is defined
    },
    propertyB: {
      options: ['Another Item One', 'Another Item Two', 'Another Item Three'],
    },
  },
};

const someFunction = (valuePropertyA, valuePropertyB) => {
  // Do some logic here
};

export const ExampleStory = {
  render: ({ args }) => {
    const { propertyA, propertyB } = args;
    //👇 Assigns the function result to a variable
    const functionResult = someFunction(propertyA, propertyB);
    return {
      components: { YourComponent },
      setup() {
        return {
          ...args,
          //👇 Replaces arg variable with the override (without the need of mutation)
          someProperty: functionResult,
        };
      },
      template:
        '<YourComponent :propertyA="propertyA" :propertyB="propertyB" :someProperty="someProperty"/>',
    };
  },
  args: {
    propertyA: 'Item One',
    propertyB: 'Another Item One',
  },
};
```

```ts filename="YourComponent.stories.ts" renderer="vue" language="ts-4-9"
import type { Meta, StoryObj } from '@storybook/vue3';

import YourComponent from './YourComponent.vue';

const meta = {
  component: YourComponent,
  //👇 Creates specific argTypes with options
  argTypes: {
    propertyA: {
      options: ['Item One', 'Item Two', 'Item Three'],
      control: { type: 'select' }, // automatically inferred when 'options' is defined
    },
    propertyB: {
      options: ['Another Item One', 'Another Item Two', 'Another Item Three'],
    },
  },
} satisfies Meta<typeof YourComponent>;

const someFunction = (valuePropertyA, valuePropertyB) => {
  // Do some logic here
};

export default meta;
type Story = StoryObj<typeof meta>;

export const ExampleStory: Story = {
  render: ({ args }) => {
    const { propertyA, propertyB } = args;
    //👇 Assigns the function result to a variable
    const functionResult = someFunction(propertyA, propertyB);
    return {
      components: { YourComponent },
      setup() {
        return {
          ...args,
          //👇 Replaces arg variable with the override (without the need of mutation)
          someProperty: functionResult,
        };
      },
      template:
        '<YourComponent :propertyA="propertyA" :propertyB="propertyB" :someProperty="someProperty"/>',
    };
  },
  args: {
    propertyA: 'Item One',
    propertyB: 'Another Item One',
  },
};
```

```ts filename="YourComponent.stories.ts" renderer="vue" language="ts"
import type { Meta, StoryObj } from '@storybook/vue3';

import YourComponent from './YourComponent.vue';

const meta: Meta<typeof YourComponent> = {
  component: YourComponent,
  //👇 Creates specific argTypes with options
  argTypes: {
    propertyA: {
      options: ['Item One', 'Item Two', 'Item Three'],
      control: { type: 'select' }, // automatically inferred when 'options' is defined
    },
    propertyB: {
      options: ['Another Item One', 'Another Item Two', 'Another Item Three'],
    },
  },
};

const someFunction = (valuePropertyA, valuePropertyB) => {
  // Do some logic here
};

export default meta;
type Story = StoryObj<typeof YourComponent>;

export const ExampleStory: Story = {
  render: ({ args }) => {
    const { propertyA, propertyB } = args;
    //👇 Assigns the function result to a variable
    const functionResult = someFunction(propertyA, propertyB);
    return {
      components: { YourComponent },
      setup() {
        return {
          ...args,
          //👇 Replaces arg variable with the override (without the need of mutation)
          someProperty: functionResult,
        };
      },
      template:
        '<YourComponent :propertyA="propertyA" :propertyB="propertyB" :someProperty="someProperty"/>',
    };
  },
  args: {
    propertyA: 'Item One',
    propertyB: 'Another Item One',
  },
};
```

```js filename="Button.stories.js" renderer="web-components" language="js"
import { html } from 'lit';

export default {
  component: 'custom-component',
  //👇 Creates specific argTypes
  argTypes: {
    propertyA: {
      options: ['Item One', 'Item Two', 'Item Three'],
      control: { type: 'select' }, // Automatically inferred when 'options' is defined
    },
    propertyB: {
      options: ['Another Item One', 'Another Item Two', 'Another Item Three'],
    },
  },
};

const someFunction = (valuePropertyA, valuePropertyB) => {
  // Do some logic here
};

export const ExampleStory = {
  render: ({ propertyA, propertyB }) => {
    //👇 Assigns the function result to a variable
    const someFunctionResult = someFunction(propertyA, propertyB);

    return html`
      <custom-component
        .propertyA=${propertyA}
        .propertyB=${propertyB}
        .someProperty=${someFunctionResult}
      ></custom-component>
    `;
  },
  args: {
    propertyA: 'Item One',
    propertyB: 'Another Item One',
  },
};
```

```ts filename="Button.stories.ts" renderer="web-components" language="ts"
import type { Meta, StoryObj } from '@storybook/web-components';

import { html } from 'lit';

const meta: Meta = {
  component: 'custom-component',
  //👇 Creates specific argTypes with options
  argTypes: {
    propertyA: {
      options: ['Item One', 'Item Two', 'Item Three'],
      control: { type: 'select' }, // Automatically inferred when 'options' is defined
    },
    propertyB: {
      options: ['Another Item One', 'Another Item Two', 'Another Item Three'],
    },
  },
};

export default meta;
type Story = StoryObj;

const someFunction = (valuePropertyA: any, valuePropertyB: any) => {
  // Do some logic here
};

export const ExampleStory: Story = {
  render: ({ propertyA, propertyB }) => {
    //👇 Assigns the function result to a variable
    const someFunctionResult = someFunction(propertyA, propertyB);

    return html`
      <custom-component
        .propertyA=${propertyA}
        .propertyB=${propertyB}
        .someProperty=${someFunctionResult}
      ></custom-component>
    `;
  },
  args: {
    propertyA: 'Item One',
    propertyB: 'Another Item One',
  },
};
```

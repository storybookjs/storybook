```ts filename="YourComponent.stories.ts" renderer="angular" language="ts"
import type { Meta, StoryObj } from '@storybook/angular';

import { YourComponent } from './YourComponent.component';

const meta: Meta<YourComponent> = {
  component: YourComponent,
};

export default meta;
type Story = StoryObj<YourComponent>;

export const ArrayInclude: Story = {
  parameters: {
    controls: { include: ['foo', 'bar'] },
  },
};

export const RegexInclude: Story = {
  parameters: {
    controls: { include: /^hello*/ },
  },
};

export const ArrayExclude: Story = {
  parameters: {
    controls: { exclude: ['foo', 'bar'] },
  },
};

export const RegexExclude: Story = {
  parameters: {
    controls: { exclude: /^hello*/ },
  },
};
```

```svelte filename="YourComponent.stories.svelte" renderer="svelte" language="js" tabTitle="Svelte CSF"
<script module>
  import { defineMeta } from '@storybook/addon-svelte-csf';

  import YourComponent from './YourComponent.svelte';

  const { Story } = defineMeta({
    component: YourComponent,
  });
</script>

<Story
  name="ArrayInclude"
  parameters={{
    controls: { include: ['foo', 'bar'] },
  }}
/>

<Story
  name="RegexInclude"
  parameters={{
    controls: { include: /^hello*/ },
  }}
/>

<Story
  name="ArrayExclude"
  parameters={{
    controls: { exclude: ['foo', 'bar'] },
  }}
/>

<Story
  name="RegexExclude"
  parameters={{
    controls: { exclude: /^hello*/ },
  }}
/>
```

```js filename="YourComponent.stories.js" renderer="svelte" language="js" tabTitle="CSF"
import YourComponent from './YourComponent.svelte';

export default {
  component: YourComponent,
};

export const ArrayInclude = {
  parameters: {
    controls: { include: ['foo', 'bar'] },
  },
};

export const RegexInclude = {
  parameters: {
    controls: { include: /^hello*/ },
  },
};

export const ArrayExclude = {
  parameters: {
    controls: { exclude: ['foo', 'bar'] },
  },
};

export const RegexExclude = {
  parameters: {
    controls: { exclude: /^hello*/ },
  },
};
```

```js filename="YourComponent.stories.js|jsx" renderer="common" language="js"
import { YourComponent } from './YourComponent';

export default {
  component: YourComponent,
};

export const ArrayInclude = {
  parameters: {
    controls: { include: ['foo', 'bar'] },
  },
};

export const RegexInclude = {
  parameters: {
    controls: { include: /^hello*/ },
  },
};

export const ArrayExclude = {
  parameters: {
    controls: { exclude: ['foo', 'bar'] },
  },
};

export const RegexExclude = {
  parameters: {
    controls: { exclude: /^hello*/ },
  },
};
```

```svelte filename="YourComponent.stories.svelte" renderer="svelte" language="ts-4-9" tabTitle="Svelte CSF"
<script module>
  import { defineMeta } from '@storybook/addon-svelte-csf';

  import YourComponent from './YourComponent.svelte';

  const { Story } = defineMeta({
    component: YourComponent,
  });
</script>

<Story
  name="ArrayInclude"
  parameters={{
    controls: { include: ['foo', 'bar'] },
  }}
/>

<Story
  name="RegexInclude"
  parameters={{
    controls: { include: /^hello*/ },
  }}
/>

<Story
  name="ArrayExclude"
  parameters={{
    controls: { exclude: ['foo', 'bar'] },
  }}
/>

<Story
  name="RegexExclude"
  parameters={{
    controls: { exclude: /^hello*/ },
  }}
/>
```

```ts filename="YourComponent.stories.ts" renderer="svelte" language="ts-4-9" tabTitle="CSF"
import type { Meta, StoryObj } from '@storybook/svelte';

import YourComponent from './YourComponent.svelte';

const meta = {
  component: YourComponent,
} satisfies Meta<typeof YourComponent>;

export default meta;
type Story = StoryObj<typeof meta>;

export const ArrayInclude: Story = {
  parameters: {
    controls: { include: ['foo', 'bar'] },
  },
};

export const RegexInclude: Story = {
  parameters: {
    controls: { include: /^hello*/ },
  },
};

export const ArrayExclude: Story = {
  parameters: {
    controls: { exclude: ['foo', 'bar'] },
  },
};

export const RegexExclude: Story = {
  parameters: {
    controls: { exclude: /^hello*/ },
  },
};
```

```ts filename="YourComponent.stories.ts|tsx" renderer="common" language="ts-4-9"
// Replace your-framework with the name of your framework
import type { Meta, StoryObj } from '@storybook/your-framework';

import { YourComponent } from './YourComponent';

const meta = {
  component: YourComponent,
} satisfies Meta<typeof YourComponent>;

export default meta;
type Story = StoryObj<typeof meta>;

export const ArrayInclude: Story = {
  parameters: {
    controls: { include: ['foo', 'bar'] },
  },
};

export const RegexInclude: Story = {
  parameters: {
    controls: { include: /^hello*/ },
  },
};

export const ArrayExclude: Story = {
  parameters: {
    controls: { exclude: ['foo', 'bar'] },
  },
};

export const RegexExclude: Story = {
  parameters: {
    controls: { exclude: /^hello*/ },
  },
};
```

```svelte filename="YourComponent.stories.svelte" renderer="svelte" language="ts" tabTitle="Svelte CSF"
<script module>
  import { defineMeta } from '@storybook/addon-svelte-csf';

  import YourComponent from './YourComponent.svelte';

  const { Story } = defineMeta({
    component: YourComponent,
  });
</script>

<Story
  name="ArrayInclude"
  parameters={{
    controls: { include: ['foo', 'bar'] },
  }}
/>

<Story
  name="RegexInclude"
  parameters={{
    controls: { include: /^hello*/ },
  }}
/>

<Story
  name="ArrayExclude"
  parameters={{
    controls: { exclude: ['foo', 'bar'] },
  }}
/>

<Story
  name="RegexExclude"
  parameters={{
    controls: { exclude: /^hello*/ },
  }}
/>
```

```ts filename="YourComponent.stories.ts" renderer="svelte" language="ts" tabTitle="CSF"
import type { Meta, StoryObj } from '@storybook/svelte';

import YourComponent from './YourComponent.svelte';

const meta: Meta<typeof YourComponent> = {
  component: YourComponent,
};

export default meta;
type Story = StoryObj<typeof YourComponent>;

export const ArrayInclude: Story = {
  parameters: {
    controls: { include: ['foo', 'bar'] },
  },
};

export const RegexInclude: Story = {
  parameters: {
    controls: { include: /^hello*/ },
  },
};

export const ArrayExclude: Story = {
  parameters: {
    controls: { exclude: ['foo', 'bar'] },
  },
};

export const RegexExclude: Story = {
  parameters: {
    controls: { exclude: /^hello*/ },
  },
};
```

```ts filename="YourComponent.stories.ts|tsx" renderer="common" language="ts"
// Replace your-framework with the name of your framework
import type { Meta, StoryObj } from '@storybook/your-framework';

import { YourComponent } from './YourComponent';

const meta: Meta<typeof YourComponent> = {
  component: YourComponent,
};

export default meta;
type Story = StoryObj<typeof YourComponent>;

export const ArrayInclude: Story = {
  parameters: {
    controls: { include: ['foo', 'bar'] },
  },
};

export const RegexInclude: Story = {
  parameters: {
    controls: { include: /^hello*/ },
  },
};

export const ArrayExclude: Story = {
  parameters: {
    controls: { exclude: ['foo', 'bar'] },
  },
};

export const RegexExclude: Story = {
  parameters: {
    controls: { exclude: /^hello*/ },
  },
};
```

```js filename="YourComponent.stories.js" renderer="web-components" language="js"
export default {
  component: 'your-component',
};

export const ArrayInclude = {
  parameters: {
    controls: { include: ['foo', 'bar'] },
  },
};

export const RegexInclude = {
  parameters: {
    controls: { include: /^hello*/ },
  },
};

export const ArrayExclude = {
  parameters: {
    controls: { exclude: ['foo', 'bar'] },
  },
};

export const RegexExclude = {
  parameters: {
    controls: { exclude: /^hello*/ },
  },
};
```

```ts filename="YourComponent.stories.ts" renderer="web-components" language="ts"
import type { Meta, StoryObj } from '@storybook/web-components';

const meta: Meta = {
  component: 'your-component',
};

export default meta;
type Story = StoryObj;

export const ArrayInclude: Story = {
  parameters: {
    controls: { include: ['foo', 'bar'] },
  },
};

export const RegexInclude: Story = {
  parameters: {
    controls: { include: /^hello*/ },
  },
};

export const ArrayExclude: Story = {
  parameters: {
    controls: { exclude: ['foo', 'bar'] },
  },
};

export const RegexExclude: Story = {
  parameters: {
    controls: { exclude: /^hello*/ },
  },
};
```

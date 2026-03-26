```ts filename="Example.stories.ts" renderer="angular" language="ts" tabTitle="CSF 3"
import type { Meta } from '@storybook/angular';

import { Example } from './example.component';

const meta: Meta<Example> = {
  component: Example,
  argTypes: {
    parent: { control: 'select', options: ['one', 'two', 'three'] },

    // 👇 Only shown when `parent` arg exists
    parentExists: { if: { arg: 'parent', exists: true } },

    // 👇 Only shown when `parent` arg does not exist
    parentDoesNotExist: { if: { arg: 'parent', exists: false } },

    // 👇 Only shown when `parent` arg value is truthy
    parentIsTruthy: { if: { arg: 'parent' } },
    parentIsTruthyVerbose: { if: { arg: 'parent', truthy: true } },

    // 👇 Only shown when `parent` arg value is not truthy
    parentIsNotTruthy: { if: { arg: 'parent', truthy: false } },

    // 👇 Only shown when `parent` arg value is 'three'
    parentIsEqToValue: { if: { arg: 'parent', eq: 'three' } },

    // 👇 Only shown when `parent` arg value is not 'three'
    parentIsNotEqToValue: { if: { arg: 'parent', neq: 'three' } },

    // Each of the above can also be conditional on the value of a globalType, e.g.:

    // 👇 Only shown when `theme` global exists
    parentExists: { if: { global: 'theme', exists: true } },
  },
};

export default meta;
```

```ts filename="Example.stories.ts" renderer="angular" language="ts" tabTitle="CSF Next 🧪"
import preview from '../.storybook/preview';

import { Example } from './example.component';

const meta = preview.meta({
  component: Example,
  argTypes: {
    parent: { control: 'select', options: ['one', 'two', 'three'] },

    // 👇 Only shown when `parent` arg exists
    parentExists: { if: { arg: 'parent', exists: true } },

    // 👇 Only shown when `parent` arg does not exist
    parentDoesNotExist: { if: { arg: 'parent', exists: false } },

    // 👇 Only shown when `parent` arg value is truthy
    parentIsTruthy: { if: { arg: 'parent' } },
    parentIsTruthyVerbose: { if: { arg: 'parent', truthy: true } },

    // 👇 Only shown when `parent` arg value is not truthy
    parentIsNotTruthy: { if: { arg: 'parent', truthy: false } },

    // 👇 Only shown when `parent` arg value is 'three'
    parentIsEqToValue: { if: { arg: 'parent', eq: 'three' } },

    // 👇 Only shown when `parent` arg value is not 'three'
    parentIsNotEqToValue: { if: { arg: 'parent', neq: 'three' } },

    // Each of the above can also be conditional on the value of a globalType, e.g.:

    // 👇 Only shown when `theme` global exists
    parentExists: { if: { global: 'theme', exists: true } },
  },
});
```

```svelte filename="Example.stories.svelte" renderer="svelte" language="js" tabTitle="Svelte CSF"
<script module>
  import { defineMeta } from '@storybook/addon-svelte-csf';

  import Example from './Example.svelte';

  const { Story } = defineMeta({
    component: Example,
    argTypes: {
      parent: { control: 'select', options: ['one', 'two', 'three'] },

      // 👇 Only shown when `parent` arg exists
      parentExists: { if: { arg: 'parent', exists: true } },

      // 👇 Only shown when `parent` arg does not exist
      parentDoesNotExist: { if: { arg: 'parent', exists: false } },

      // 👇 Only shown when `parent` arg value is truthy
      parentIsTruthy: { if: { arg: 'parent' } },
      parentIsTruthyVerbose: { if: { arg: 'parent', truthy: true } },

      // 👇 Only shown when `parent` arg value is not truthy
      parentIsNotTruthy: { if: { arg: 'parent', truthy: false } },

      // 👇 Only shown when `parent` arg value is 'three'
      parentIsEqToValue: { if: { arg: 'parent', eq: 'three' } },

      // 👇 Only shown when `parent` arg value is not 'three'
      parentIsNotEqToValue: { if: { arg: 'parent', neq: 'three' } },

      // Each of the above can also be conditional on the value of a globalType, e.g.:

      // 👇 Only shown when `theme` global exists
      parentExists: { if: { global: 'theme', exists: true } },
    },
  });
</script>
```

```js filename="Example.stories.js" renderer="svelte" language="js" tabTitle="CSF 3"
import Example from './Example.svelte';

export default {
  component: Example,
  argTypes: {
    parent: { control: 'select', options: ['one', 'two', 'three'] },

    // 👇 Only shown when `parent` arg exists
    parentExists: { if: { arg: 'parent', exists: true } },

    // 👇 Only shown when `parent` arg does not exist
    parentDoesNotExist: { if: { arg: 'parent', exists: false } },

    // 👇 Only shown when `parent` arg value is truthy
    parentIsTruthy: { if: { arg: 'parent' } },
    parentIsTruthyVerbose: { if: { arg: 'parent', truthy: true } },

    // 👇 Only shown when `parent` arg value is not truthy
    parentIsNotTruthy: { if: { arg: 'parent', truthy: false } },

    // 👇 Only shown when `parent` arg value is 'three'
    parentIsEqToValue: { if: { arg: 'parent', eq: 'three' } },

    // 👇 Only shown when `parent` arg value is not 'three'
    parentIsNotEqToValue: { if: { arg: 'parent', neq: 'three' } },

    // Each of the above can also be conditional on the value of a globalType, e.g.:

    // 👇 Only shown when `theme` global exists
    parentExists: { if: { global: 'theme', exists: true } },
  },
};
```

```js filename="Example.stories.js|jsx" renderer="common" language="js" tabTitle="CSF 3"
import { Example } from './Example';

export default {
  component: Example,
  argTypes: {
    parent: { control: 'select', options: ['one', 'two', 'three'] },

    // 👇 Only shown when `parent` arg exists
    parentExists: { if: { arg: 'parent', exists: true } },

    // 👇 Only shown when `parent` arg does not exist
    parentDoesNotExist: { if: { arg: 'parent', exists: false } },

    // 👇 Only shown when `parent` arg value is truthy
    parentIsTruthy: { if: { arg: 'parent' } },
    parentIsTruthyVerbose: { if: { arg: 'parent', truthy: true } },

    // 👇 Only shown when `parent` arg value is not truthy
    parentIsNotTruthy: { if: { arg: 'parent', truthy: false } },

    // 👇 Only shown when `parent` arg value is 'three'
    parentIsEqToValue: { if: { arg: 'parent', eq: 'three' } },

    // 👇 Only shown when `parent` arg value is not 'three'
    parentIsNotEqToValue: { if: { arg: 'parent', neq: 'three' } },

    // Each of the above can also be conditional on the value of a globalType, e.g.:

    // 👇 Only shown when `theme` global exists
    parentExists: { if: { global: 'theme', exists: true } },
  },
};
```

```svelte filename="Example.stories.svelte" renderer="svelte" language="ts" tabTitle="Svelte CSF"
<script module>
  import { defineMeta } from '@storybook/addon-svelte-csf';

  import Example from './Example.svelte';

  const { Story } = defineMeta({
    component: Example,
    argTypes: {
      parent: { control: 'select', options: ['one', 'two', 'three'] },

      // 👇 Only shown when `parent` arg exists
      parentExists: { if: { arg: 'parent', exists: true } },

      // 👇 Only shown when `parent` arg does not exist
      parentDoesNotExist: { if: { arg: 'parent', exists: false } },

      // 👇 Only shown when `parent` arg value is truthy
      parentIsTruthy: { if: { arg: 'parent' } },
      parentIsTruthyVerbose: { if: { arg: 'parent', truthy: true } },

      // 👇 Only shown when `parent` arg value is not truthy
      parentIsNotTruthy: { if: { arg: 'parent', truthy: false } },

      // 👇 Only shown when `parent` arg value is 'three'
      parentIsEqToValue: { if: { arg: 'parent', eq: 'three' } },

      // 👇 Only shown when `parent` arg value is not 'three'
      parentIsNotEqToValue: { if: { arg: 'parent', neq: 'three' } },

      // Each of the above can also be conditional on the value of a globalType, e.g.:

      // 👇 Only shown when `theme` global exists
      parentExists: { if: { global: 'theme', exists: true } },
    },
  });
</script>
```

```ts filename="Example.stories.ts" renderer="svelte" language="ts" tabTitle="CSF 3"
// Replace your-framework with svelte-vite or sveltekit
import type { Meta } from '@storybook/your-framework';

import Example from './Example.svelte';

const meta = {
  component: Example,
  argTypes: {
    parent: { control: 'select', options: ['one', 'two', 'three'] },

    // 👇 Only shown when `parent` arg exists
    parentExists: { if: { arg: 'parent', exists: true } },

    // 👇 Only shown when `parent` arg does not exist
    parentDoesNotExist: { if: { arg: 'parent', exists: false } },

    // 👇 Only shown when `parent` arg value is truthy
    parentIsTruthy: { if: { arg: 'parent' } },
    parentIsTruthyVerbose: { if: { arg: 'parent', truthy: true } },

    // 👇 Only shown when `parent` arg value is not truthy
    parentIsNotTruthy: { if: { arg: 'parent', truthy: false } },

    // 👇 Only shown when `parent` arg value is 'three'
    parentIsEqToValue: { if: { arg: 'parent', eq: 'three' } },

    // 👇 Only shown when `parent` arg value is not 'three'
    parentIsNotEqToValue: { if: { arg: 'parent', neq: 'three' } },

    // Each of the above can also be conditional on the value of a globalType, e.g.:

    // 👇 Only shown when `theme` global exists
    parentExists: { if: { global: 'theme', exists: true } },
  },
} satisfies Meta<typeof Example>;

export default meta;
```

```ts filename="Example.stories.ts|tsx" renderer="common" language="ts" tabTitle="CSF 3"
// Replace your-framework with the framework you are using, e.g. react-vite, nextjs, vue3-vite, etc.
import type { Meta } from '@storybook/your-framework';

import { Example } from './Example';

const meta = {
  component: Example,
  argTypes: {
    parent: { control: 'select', options: ['one', 'two', 'three'] },

    // 👇 Only shown when `parent` arg exists
    parentExists: { if: { arg: 'parent', exists: true } },

    // 👇 Only shown when `parent` arg does not exist
    parentDoesNotExist: { if: { arg: 'parent', exists: false } },

    // 👇 Only shown when `parent` arg value is truthy
    parentIsTruthy: { if: { arg: 'parent' } },
    parentIsTruthyVerbose: { if: { arg: 'parent', truthy: true } },

    // 👇 Only shown when `parent` arg value is not truthy
    parentIsNotTruthy: { if: { arg: 'parent', truthy: false } },

    // 👇 Only shown when `parent` arg value is 'three'
    parentIsEqToValue: { if: { arg: 'parent', eq: 'three' } },

    // 👇 Only shown when `parent` arg value is not 'three'
    parentIsNotEqToValue: { if: { arg: 'parent', neq: 'three' } },

    // Each of the above can also be conditional on the value of a globalType, e.g.:

    // 👇 Only shown when `theme` global exists
    parentExists: { if: { global: 'theme', exists: true } },
  },
} satisfies Meta<typeof Example>;

export default meta;
```

```js filename="Example.stories.js" renderer="web-components" language="js" tabTitle="CSF 3"
export default {
  component: 'demo-example',
  argTypes: {
    parent: { control: 'select', options: ['one', 'two', 'three'] },

    // 👇 Only shown when `parent` arg exists
    parentExists: { if: { arg: 'parent', exists: true } },

    // 👇 Only shown when `parent` arg does not exist
    parentDoesNotExist: { if: { arg: 'parent', exists: false } },

    // 👇 Only shown when `parent` arg value is truthy
    parentIsTruthy: { if: { arg: 'parent' } },
    parentIsTruthyVerbose: { if: { arg: 'parent', truthy: true } },

    // 👇 Only shown when `parent` arg value is not truthy
    parentIsNotTruthy: { if: { arg: 'parent', truthy: false } },

    // 👇 Only shown when `parent` arg value is 'three'
    parentIsEqToValue: { if: { arg: 'parent', eq: 'three' } },

    // 👇 Only shown when `parent` arg value is not 'three'
    parentIsNotEqToValue: { if: { arg: 'parent', neq: 'three' } },

    // Each of the above can also be conditional on the value of a globalType, e.g.:

    // 👇 Only shown when `theme` global exists
    parentExists: { if: { global: 'theme', exists: true } },
  },
};
```

```ts filename="Example.stories.ts" renderer="web-components" language="ts" tabTitle="CSF 3"
import type { Meta } from '@storybook/web-components-vite';

const meta: Meta = {
  component: 'demo-example',
  argTypes: {
    parent: { control: 'select', options: ['one', 'two', 'three'] },

    // 👇 Only shown when `parent` arg exists
    parentExists: { if: { arg: 'parent', exists: true } },

    // 👇 Only shown when `parent` arg does not exist
    parentDoesNotExist: { if: { arg: 'parent', exists: false } },

    // 👇 Only shown when `parent` arg value is truthy
    parentIsTruthy: { if: { arg: 'parent' } },
    parentIsTruthyVerbose: { if: { arg: 'parent', truthy: true } },

    // 👇 Only shown when `parent` arg value is not truthy
    parentIsNotTruthy: { if: { arg: 'parent', truthy: false } },

    // 👇 Only shown when `parent` arg value is 'three'
    parentIsEqToValue: { if: { arg: 'parent', eq: 'three' } },

    // 👇 Only shown when `parent` arg value is not 'three'
    parentIsNotEqToValue: { if: { arg: 'parent', neq: 'three' } },

    // Each of the above can also be conditional on the value of a globalType, e.g.:

    // 👇 Only shown when `theme` global exists
    parentExists: { if: { global: 'theme', exists: true } },
  },
};

export default meta;
```

```js filename="Example.stories.js" renderer="web-components" language="js" tabTitle="CSF Next 🧪"
import preview from '../.storybook/preview';

const meta = preview.meta({
  component: 'demo-example',
  argTypes: {
    parent: { control: 'select', options: ['one', 'two', 'three'] },

    // 👇 Only shown when `parent` arg exists
    parentExists: { if: { arg: 'parent', exists: true } },

    // 👇 Only shown when `parent` arg does not exist
    parentDoesNotExist: { if: { arg: 'parent', exists: false } },

    // 👇 Only shown when `parent` arg value is truthy
    parentIsTruthy: { if: { arg: 'parent' } },
    parentIsTruthyVerbose: { if: { arg: 'parent', truthy: true } },

    // 👇 Only shown when `parent` arg value is not truthy
    parentIsNotTruthy: { if: { arg: 'parent', truthy: false } },

    // 👇 Only shown when `parent` arg value is 'three'
    parentIsEqToValue: { if: { arg: 'parent', eq: 'three' } },

    // 👇 Only shown when `parent` arg value is not 'three'
    parentIsNotEqToValue: { if: { arg: 'parent', neq: 'three' } },

    // Each of the above can also be conditional on the value of a globalType, e.g.:

    // 👇 Only shown when `theme` global exists
    parentExists: { if: { global: 'theme', exists: true } },
  },
});
```

```ts filename="Example.stories.ts" renderer="web-components" language="ts" tabTitle="CSF Next 🧪"
import preview from '../.storybook/preview';

const meta = preview.meta({
  component: 'demo-example',
  argTypes: {
    parent: { control: 'select', options: ['one', 'two', 'three'] },

    // 👇 Only shown when `parent` arg exists
    parentExists: { if: { arg: 'parent', exists: true } },

    // 👇 Only shown when `parent` arg does not exist
    parentDoesNotExist: { if: { arg: 'parent', exists: false } },

    // 👇 Only shown when `parent` arg value is truthy
    parentIsTruthy: { if: { arg: 'parent' } },
    parentIsTruthyVerbose: { if: { arg: 'parent', truthy: true } },

    // 👇 Only shown when `parent` arg value is not truthy
    parentIsNotTruthy: { if: { arg: 'parent', truthy: false } },

    // 👇 Only shown when `parent` arg value is 'three'
    parentIsEqToValue: { if: { arg: 'parent', eq: 'three' } },

    // 👇 Only shown when `parent` arg value is not 'three'
    parentIsNotEqToValue: { if: { arg: 'parent', neq: 'three' } },

    // Each of the above can also be conditional on the value of a globalType, e.g.:

    // 👇 Only shown when `theme` global exists
    parentExists: { if: { global: 'theme', exists: true } },
  },
});
```

```ts filename="Example.stories.ts|tsx" renderer="react" language="ts" tabTitle="CSF Next 🧪"
import preview from '../.storybook/preview';

import { Example } from './Example';

const meta = preview.meta({
  component: Example,
  argTypes: {
    parent: { control: 'select', options: ['one', 'two', 'three'] },

    // 👇 Only shown when `parent` arg exists
    parentExists: { if: { arg: 'parent', exists: true } },

    // 👇 Only shown when `parent` arg does not exist
    parentDoesNotExist: { if: { arg: 'parent', exists: false } },

    // 👇 Only shown when `parent` arg value is truthy
    parentIsTruthy: { if: { arg: 'parent' } },
    parentIsTruthyVerbose: { if: { arg: 'parent', truthy: true } },

    // 👇 Only shown when `parent` arg value is not truthy
    parentIsNotTruthy: { if: { arg: 'parent', truthy: false } },

    // 👇 Only shown when `parent` arg value is 'three'
    parentIsEqToValue: { if: { arg: 'parent', eq: 'three' } },

    // 👇 Only shown when `parent` arg value is not 'three'
    parentIsNotEqToValue: { if: { arg: 'parent', neq: 'three' } },

    // Each of the above can also be conditional on the value of a globalType, e.g.:

    // 👇 Only shown when `theme` global exists
    parentExists: { if: { global: 'theme', exists: true } },
  },
});
```

<!-- JS snippets still needed while providing both CSF 3 & Next -->

```js filename="Example.stories.js|jsx" renderer="react" language="js" tabTitle="CSF Next 🧪"
import preview from '../.storybook/preview';

import { Example } from './Example';

const meta = preview.meta({
  component: Example,
  argTypes: {
    parent: { control: 'select', options: ['one', 'two', 'three'] },

    // 👇 Only shown when `parent` arg exists
    parentExists: { if: { arg: 'parent', exists: true } },

    // 👇 Only shown when `parent` arg does not exist
    parentDoesNotExist: { if: { arg: 'parent', exists: false } },

    // 👇 Only shown when `parent` arg value is truthy
    parentIsTruthy: { if: { arg: 'parent' } },
    parentIsTruthyVerbose: { if: { arg: 'parent', truthy: true } },

    // 👇 Only shown when `parent` arg value is not truthy
    parentIsNotTruthy: { if: { arg: 'parent', truthy: false } },

    // 👇 Only shown when `parent` arg value is 'three'
    parentIsEqToValue: { if: { arg: 'parent', eq: 'three' } },

    // 👇 Only shown when `parent` arg value is not 'three'
    parentIsNotEqToValue: { if: { arg: 'parent', neq: 'three' } },

    // Each of the above can also be conditional on the value of a globalType, e.g.:

    // 👇 Only shown when `theme` global exists
    parentExists: { if: { global: 'theme', exists: true } },
  },
});
```

```ts filename="Example.stories.ts" renderer="vue" language="ts" tabTitle="CSF Next 🧪"
import preview from '../.storybook/preview';

import Example from './Example.vue';

const meta = preview.meta({
  component: Example,
  argTypes: {
    parent: { control: 'select', options: ['one', 'two', 'three'] },

    // 👇 Only shown when `parent` arg exists
    parentExists: { if: { arg: 'parent', exists: true } },

    // 👇 Only shown when `parent` arg does not exist
    parentDoesNotExist: { if: { arg: 'parent', exists: false } },

    // 👇 Only shown when `parent` arg value is truthy
    parentIsTruthy: { if: { arg: 'parent' } },
    parentIsTruthyVerbose: { if: { arg: 'parent', truthy: true } },

    // 👇 Only shown when `parent` arg value is not truthy
    parentIsNotTruthy: { if: { arg: 'parent', truthy: false } },

    // 👇 Only shown when `parent` arg value is 'three'
    parentIsEqToValue: { if: { arg: 'parent', eq: 'three' } },

    // 👇 Only shown when `parent` arg value is not 'three'
    parentIsNotEqToValue: { if: { arg: 'parent', neq: 'three' } },

    // Each of the above can also be conditional on the value of a globalType, e.g.:

    // 👇 Only shown when `theme` global exists
    parentExists: { if: { global: 'theme', exists: true } },
  },
});
```

<!-- JS snippets still needed while providing both CSF 3 & Next -->

```js filename="Example.stories.js" renderer="vue" language="js" tabTitle="CSF Next 🧪"
import preview from '../.storybook/preview';

import Example from './Example.vue';

const meta = preview.meta({
  component: Example,
  argTypes: {
    parent: { control: 'select', options: ['one', 'two', 'three'] },

    // 👇 Only shown when `parent` arg exists
    parentExists: { if: { arg: 'parent', exists: true } },

    // 👇 Only shown when `parent` arg does not exist
    parentDoesNotExist: { if: { arg: 'parent', exists: false } },

    // 👇 Only shown when `parent` arg value is truthy
    parentIsTruthy: { if: { arg: 'parent' } },
    parentIsTruthyVerbose: { if: { arg: 'parent', truthy: true } },

    // 👇 Only shown when `parent` arg value is not truthy
    parentIsNotTruthy: { if: { arg: 'parent', truthy: false } },

    // 👇 Only shown when `parent` arg value is 'three'
    parentIsEqToValue: { if: { arg: 'parent', eq: 'three' } },

    // 👇 Only shown when `parent` arg value is not 'three'
    parentIsNotEqToValue: { if: { arg: 'parent', neq: 'three' } },

    // Each of the above can also be conditional on the value of a globalType, e.g.:

    // 👇 Only shown when `theme` global exists
    parentExists: { if: { global: 'theme', exists: true } },
  },
});
```

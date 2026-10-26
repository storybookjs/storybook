```ts filename="Gizmo.stories.ts" renderer="angular" language="ts" tabTitle="CSF 4"
import preview from '../.storybook/preview';

import { Gizmo } from './gizmo.component';

const meta = preview.meta({
  component: Gizmo,
  argTypes: {
    canRotate: {
      control: 'boolean',
    },
    width: {
      control: { type: 'number', min: 400, max: 1200, step: 50 },
    },
    height: {
      control: { type: 'range', min: 200, max: 1500, step: 50 },
    },
    rawData: {
      control: 'object',
    },
    coordinates: {
      control: 'object',
    },
    texture: {
      control: {
        type: 'file',
        accept: '.png',
      },
    },
    position: {
      control: 'radio',
      options: ['left', 'right', 'center'],
    },
    rotationAxis: {
      control: 'check',
      options: ['x', 'y', 'z'],
    },
    scaling: {
      control: 'select',
      options: [10, 50, 75, 100, 200],
    },
    label: {
      control: 'text',
    },
    meshColors: {
      control: {
        type: 'color',
        presetColors: ['#ff0000', '#00ff00', '#0000ff'],
      },
    },
    revisionDate: {
      control: 'date',
    },
  },
});
```

```ts filename="Gizmo.stories.ts" renderer="web-components" language="ts" tabTitle="CSF 4"
import preview from '../.storybook/preview';

const meta = preview.meta({
  component: 'gizmo-element',
  argTypes: {
    canRotate: {
      control: 'boolean',
    },
    width: {
      control: { type: 'number', min: 400, max: 1200, step: 50 },
    },
    height: {
      control: { type: 'range', min: 200, max: 1500, step: 50 },
    },
    rawData: {
      control: 'object',
    },
    coordinates: {
      control: 'object',
    },
    texture: {
      control: {
        type: 'file',
        accept: '.png',
      },
    },
    position: {
      control: 'radio',
      options: ['left', 'right', 'center'],
    },
    rotationAxis: {
      control: 'check',
      options: ['x', 'y', 'z'],
    },
    scaling: {
      control: 'select',
      options: [10, 50, 75, 100, 200],
    },
    label: {
      control: 'text',
    },
    meshColors: {
      control: {
        type: 'color',
        presetColors: ['#ff0000', '#00ff00', '#0000ff'],
      },
    },
    revisionDate: {
      control: 'date',
    },
  },
});
```

```svelte filename="Gizmo.stories.svelte" renderer="svelte" language="js" tabTitle="CSF 4"
<script module>
  import preview from '../.storybook/preview';

  import Gizmo from './Gizmo.svelte';

  const { Story } = preview.meta({
    component: Gizmo,
    argTypes: {
      canRotate: {
        control: 'boolean',
      },
      width: {
        control: { type: 'number', min: 400, max: 1200, step: 50 },
      },
      height: {
        control: { type: 'range', min: 200, max: 1500, step: 50 },
      },
      rawData: {
        control: 'object',
      },
      coordinates: {
        control: 'object',
      },
      texture: {
        control: {
          type: 'file',
          accept: '.png',
        },
      },
      position: {
        control: 'radio',
        options: ['left', 'right', 'center'],
      },
      rotationAxis: {
        control: 'check',
        options: ['x', 'y', 'z'],
      },
      scaling: {
        control: 'select',
        options: [10, 50, 75, 100, 200],
      },
      label: {
        control: 'text',
      },
      meshColors: {
        control: {
          type: 'color',
          presetColors: ['#ff0000', '#00ff00', '#0000ff'],
        },
      },
      revisionDate: {
        control: 'date',
      },
    },
  });
</script>
```

```svelte filename="Gizmo.stories.svelte" renderer="svelte" language="js" tabTitle="CSF 3"
<!-- ⚠️ CSF 3 is deprecated and will be removed in Storybook 12 -->
<script module>
  // Replace your-framework with the framework you are using, e.g. sveltekit or svelte-vite
  import { defineMeta } from '@storybook/your-framework';

  import Gizmo from './Gizmo.svelte';

  const { Story } = defineMeta({
    component: Gizmo,
    argTypes: {
      canRotate: {
        control: 'boolean',
      },
      width: {
        control: { type: 'number', min: 400, max: 1200, step: 50 },
      },
      height: {
        control: { type: 'range', min: 200, max: 1500, step: 50 },
      },
      rawData: {
        control: 'object',
      },
      coordinates: {
        control: 'object',
      },
      texture: {
        control: {
          type: 'file',
          accept: '.png',
        },
      },
      position: {
        control: 'radio',
        options: ['left', 'right', 'center'],
      },
      rotationAxis: {
        control: 'check',
        options: ['x', 'y', 'z'],
      },
      scaling: {
        control: 'select',
        options: [10, 50, 75, 100, 200],
      },
      label: {
        control: 'text',
      },
      meshColors: {
        control: {
          type: 'color',
          presetColors: ['#ff0000', '#00ff00', '#0000ff'],
        },
      },
      revisionDate: {
        control: 'date',
      },
    },
  });
</script>
```

```js filename="Gizmo.stories.js" renderer="web-components" language="js" tabTitle="CSF 4"
import preview from '../.storybook/preview';

const meta = preview.meta({
  component: 'gizmo-element',
  argTypes: {
    canRotate: {
      control: 'boolean',
    },
    width: {
      control: { type: 'number', min: 400, max: 1200, step: 50 },
    },
    height: {
      control: { type: 'range', min: 200, max: 1500, step: 50 },
    },
    rawData: {
      control: 'object',
    },
    coordinates: {
      control: 'object',
    },
    texture: {
      control: {
        type: 'file',
        accept: '.png',
      },
    },
    position: {
      control: 'radio',
      options: ['left', 'right', 'center'],
    },
    rotationAxis: {
      control: 'check',
      options: ['x', 'y', 'z'],
    },
    scaling: {
      control: 'select',
      options: [10, 50, 75, 100, 200],
    },
    label: {
      control: 'text',
    },
    meshColors: {
      control: {
        type: 'color',
        presetColors: ['#ff0000', '#00ff00', '#0000ff'],
      },
    },
    revisionDate: {
      control: 'date',
    },
  },
});
```

```svelte filename="Gizmo.stories.svelte" renderer="svelte" language="ts" tabTitle="CSF 4"
<script module lang="ts">
  import preview from '../.storybook/preview';

  import Gizmo from './Gizmo.svelte';

  const { Story } = preview.meta({
    component: Gizmo,
    argTypes: {
      canRotate: {
        control: 'boolean',
      },
      width: {
        control: { type: 'number', min: 400, max: 1200, step: 50 },
      },
      height: {
        control: { type: 'range', min: 200, max: 1500, step: 50 },
      },
      rawData: {
        control: 'object',
      },
      coordinates: {
        control: 'object',
      },
      texture: {
        control: {
          type: 'file',
          accept: '.png',
        },
      },
      position: {
        control: 'radio',
        options: ['left', 'right', 'center'],
      },
      rotationAxis: {
        control: 'check',
        options: ['x', 'y', 'z'],
      },
      scaling: {
        control: 'select',
        options: [10, 50, 75, 100, 200],
      },
      label: {
        control: 'text',
      },
      meshColors: {
        control: {
          type: 'color',
          presetColors: ['#ff0000', '#00ff00', '#0000ff'],
        },
      },
      revisionDate: {
        control: 'date',
      },
    },
  });
</script>
```

```svelte filename="Gizmo.stories.svelte" renderer="svelte" language="ts" tabTitle="CSF 3"
<!-- ⚠️ CSF 3 is deprecated and will be removed in Storybook 12 -->
<script module>
  // Replace your-framework with the framework you are using, e.g. sveltekit or svelte-vite
  import { defineMeta } from '@storybook/your-framework';

  import Gizmo from './Gizmo.svelte';

  const { Story } = defineMeta({
    component: Gizmo,
    argTypes: {
      canRotate: {
        control: 'boolean',
      },
      width: {
        control: { type: 'number', min: 400, max: 1200, step: 50 },
      },
      height: {
        control: { type: 'range', min: 200, max: 1500, step: 50 },
      },
      rawData: {
        control: 'object',
      },
      coordinates: {
        control: 'object',
      },
      texture: {
        control: {
          type: 'file',
          accept: '.png',
        },
      },
      position: {
        control: 'radio',
        options: ['left', 'right', 'center'],
      },
      rotationAxis: {
        control: 'check',
        options: ['x', 'y', 'z'],
      },
      scaling: {
        control: 'select',
        options: [10, 50, 75, 100, 200],
      },
      label: {
        control: 'text',
      },
      meshColors: {
        control: {
          type: 'color',
          presetColors: ['#ff0000', '#00ff00', '#0000ff'],
        },
      },
      revisionDate: {
        control: 'date',
      },
    },
  });
</script>
```

```ts filename="Gizmo.stories.ts|tsx" renderer="react" language="ts" tabTitle="CSF 4"
import preview from '../.storybook/preview';

import { Gizmo } from './Gizmo';

const meta = preview.meta({
  component: Gizmo,
  argTypes: {
    canRotate: {
      control: 'boolean',
    },
    width: {
      control: { type: 'number', min: 400, max: 1200, step: 50 },
    },
    height: {
      control: { type: 'range', min: 200, max: 1500, step: 50 },
    },
    rawData: {
      control: 'object',
    },
    coordinates: {
      control: 'object',
    },
    texture: {
      control: {
        type: 'file',
        accept: '.png',
      },
    },
    position: {
      control: 'radio',
      options: ['left', 'right', 'center'],
    },
    rotationAxis: {
      control: 'check',
      options: ['x', 'y', 'z'],
    },
    scaling: {
      control: 'select',
      options: [10, 50, 75, 100, 200],
    },
    label: {
      control: 'text',
    },
    meshColors: {
      control: {
        type: 'color',
        presetColors: ['#ff0000', '#00ff00', '#0000ff'],
      },
    },
    revisionDate: {
      control: 'date',
    },
  },
});
```

```js filename="Gizmo.stories.js|jsx" renderer="react" language="js" tabTitle="CSF 4"
import preview from '../.storybook/preview';

import { Gizmo } from './Gizmo';

const meta = preview.meta({
  component: Gizmo,
  argTypes: {
    canRotate: {
      control: 'boolean',
    },
    width: {
      control: { type: 'number', min: 400, max: 1200, step: 50 },
    },
    height: {
      control: { type: 'range', min: 200, max: 1500, step: 50 },
    },
    rawData: {
      control: 'object',
    },
    coordinates: {
      control: 'object',
    },
    texture: {
      control: {
        type: 'file',
        accept: '.png',
      },
    },
    position: {
      control: 'radio',
      options: ['left', 'right', 'center'],
    },
    rotationAxis: {
      control: 'check',
      options: ['x', 'y', 'z'],
    },
    scaling: {
      control: 'select',
      options: [10, 50, 75, 100, 200],
    },
    label: {
      control: 'text',
    },
    meshColors: {
      control: {
        type: 'color',
        presetColors: ['#ff0000', '#00ff00', '#0000ff'],
      },
    },
    revisionDate: {
      control: 'date',
    },
  },
});
```

```ts filename="Gizmo.stories.ts" renderer="vue" language="ts" tabTitle="CSF 4"
import preview from '../.storybook/preview';

import Gizmo from './Gizmo.vue';

const meta = preview.meta({
  component: Gizmo,
  argTypes: {
    canRotate: {
      control: 'boolean',
    },
    width: {
      control: { type: 'number', min: 400, max: 1200, step: 50 },
    },
    height: {
      control: { type: 'range', min: 200, max: 1500, step: 50 },
    },
    rawData: {
      control: 'object',
    },
    coordinates: {
      control: 'object',
    },
    texture: {
      control: {
        type: 'file',
        accept: '.png',
      },
    },
    position: {
      control: 'radio',
      options: ['left', 'right', 'center'],
    },
    rotationAxis: {
      control: 'check',
      options: ['x', 'y', 'z'],
    },
    scaling: {
      control: 'select',
      options: [10, 50, 75, 100, 200],
    },
    label: {
      control: 'text',
    },
    meshColors: {
      control: {
        type: 'color',
        presetColors: ['#ff0000', '#00ff00', '#0000ff'],
      },
    },
    revisionDate: {
      control: 'date',
    },
  },
});
```

```js filename="Gizmo.stories.js" renderer="vue" language="js" tabTitle="CSF 4"
import preview from '../.storybook/preview';

import Gizmo from './Gizmo.vue';

const meta = preview.meta({
  component: Gizmo,
  argTypes: {
    canRotate: {
      control: 'boolean',
    },
    width: {
      control: { type: 'number', min: 400, max: 1200, step: 50 },
    },
    height: {
      control: { type: 'range', min: 200, max: 1500, step: 50 },
    },
    rawData: {
      control: 'object',
    },
    coordinates: {
      control: 'object',
    },
    texture: {
      control: {
        type: 'file',
        accept: '.png',
      },
    },
    position: {
      control: 'radio',
      options: ['left', 'right', 'center'],
    },
    rotationAxis: {
      control: 'check',
      options: ['x', 'y', 'z'],
    },
    scaling: {
      control: 'select',
      options: [10, 50, 75, 100, 200],
    },
    label: {
      control: 'text',
    },
    meshColors: {
      control: {
        type: 'color',
        presetColors: ['#ff0000', '#00ff00', '#0000ff'],
      },
    },
    revisionDate: {
      control: 'date',
    },
  },
});
```

```ts filename="Gizmo.stories.ts" renderer="angular" language="ts" tabTitle="CSF 3"
// ⚠️ CSF versions 1, 2, and 3 will be removed in a future version of Storybook. Upgrade to CSF 4: https://storybook.js.org/docs/writing-stories/csf#upgrade-to-csf-4
import type { Meta } from '@storybook/angular';

import { Gizmo } from './gizmo.component';

const meta: Meta<Gizmo> = {
  component: Gizmo,
  argTypes: {
    canRotate: {
      control: 'boolean',
    },
    width: {
      control: { type: 'number', min: 400, max: 1200, step: 50 },
    },
    height: {
      control: { type: 'range', min: 200, max: 1500, step: 50 },
    },
    rawData: {
      control: 'object',
    },
    coordinates: {
      control: 'object',
    },
    texture: {
      control: {
        type: 'file',
        accept: '.png',
      },
    },
    position: {
      control: 'radio',
      options: ['left', 'right', 'center'],
    },
    rotationAxis: {
      control: 'check',
      options: ['x', 'y', 'z'],
    },
    scaling: {
      control: 'select',
      options: [10, 50, 75, 100, 200],
    },
    label: {
      control: 'text',
    },
    meshColors: {
      control: {
        type: 'color',
        presetColors: ['#ff0000', '#00ff00', '#0000ff'],
      },
    },
    revisionDate: {
      control: 'date',
    },
  },
};

export default meta;
```

```ts filename="Gizmo.stories.ts|tsx" renderer="common" language="ts" tabTitle="CSF 3"
// ⚠️ CSF versions 1, 2, and 3 will be removed in a future version of Storybook. Upgrade to CSF 4: https://storybook.js.org/docs/writing-stories/csf#upgrade-to-csf-4
// Replace your-framework with the framework you are using, e.g. react-vite, nextjs, vue3-vite, etc.
import type { Meta } from '@storybook/your-framework';

import { Gizmo } from './Gizmo';

const meta = {
  component: Gizmo,
  argTypes: {
    canRotate: {
      control: 'boolean',
    },
    width: {
      control: { type: 'number', min: 400, max: 1200, step: 50 },
    },
    height: {
      control: { type: 'range', min: 200, max: 1500, step: 50 },
    },
    rawData: {
      control: 'object',
    },
    coordinates: {
      control: 'object',
    },
    texture: {
      control: {
        type: 'file',
        accept: '.png',
      },
    },
    position: {
      control: 'radio',
      options: ['left', 'right', 'center'],
    },
    rotationAxis: {
      control: 'check',
      options: ['x', 'y', 'z'],
    },
    scaling: {
      control: 'select',
      options: [10, 50, 75, 100, 200],
    },
    label: {
      control: 'text',
    },
    meshColors: {
      control: {
        type: 'color',
        presetColors: ['#ff0000', '#00ff00', '#0000ff'],
      },
    },
    revisionDate: {
      control: 'date',
    },
  },
} satisfies Meta<typeof Gizmo>;

export default meta;
```

```js filename="Gizmo.stories.js|jsx" renderer="common" language="js" tabTitle="CSF 3"
// ⚠️ CSF versions 1, 2, and 3 will be removed in a future version of Storybook. Upgrade to CSF 4: https://storybook.js.org/docs/writing-stories/csf#upgrade-to-csf-4
import { Gizmo } from './Gizmo';

export default {
  component: Gizmo,
  argTypes: {
    canRotate: {
      control: 'boolean',
    },
    width: {
      control: { type: 'number', min: 400, max: 1200, step: 50 },
    },
    height: {
      control: { type: 'range', min: 200, max: 1500, step: 50 },
    },
    rawData: {
      control: 'object',
    },
    coordinates: {
      control: 'object',
    },
    texture: {
      control: {
        type: 'file',
        accept: '.png',
      },
    },
    position: {
      control: 'radio',
      options: ['left', 'right', 'center'],
    },
    rotationAxis: {
      control: 'check',
      options: ['x', 'y', 'z'],
    },
    scaling: {
      control: 'select',
      options: [10, 50, 75, 100, 200],
    },
    label: {
      control: 'text',
    },
    meshColors: {
      control: {
        type: 'color',
        presetColors: ['#ff0000', '#00ff00', '#0000ff'],
      },
    },
    revisionDate: {
      control: 'date',
    },
  },
};
```

```ts filename="Gizmo.stories.ts" renderer="web-components" language="ts" tabTitle="CSF 3"
// ⚠️ CSF versions 1, 2, and 3 will be removed in a future version of Storybook. Upgrade to CSF 4: https://storybook.js.org/docs/writing-stories/csf#upgrade-to-csf-4
import type { Meta } from '@storybook/web-components-vite';

const meta: Meta = {
  component: 'gizmo-element',
  argTypes: {
    canRotate: {
      control: 'boolean',
    },
    width: {
      control: { type: 'number', min: 400, max: 1200, step: 50 },
    },
    height: {
      control: { type: 'range', min: 200, max: 1500, step: 50 },
    },
    rawData: {
      control: 'object',
    },
    coordinates: {
      control: 'object',
    },
    texture: {
      control: {
        type: 'file',
        accept: '.png',
      },
    },
    position: {
      control: 'radio',
      options: ['left', 'right', 'center'],
    },
    rotationAxis: {
      control: 'check',
      options: ['x', 'y', 'z'],
    },
    scaling: {
      control: 'select',
      options: [10, 50, 75, 100, 200],
    },
    label: {
      control: 'text',
    },
    meshColors: {
      control: {
        type: 'color',
        presetColors: ['#ff0000', '#00ff00', '#0000ff'],
      },
    },
    revisionDate: {
      control: 'date',
    },
  },
};

export default meta;
```

```js filename="Gizmo.stories.js" renderer="web-components" language="js" tabTitle="CSF 3"
// ⚠️ CSF versions 1, 2, and 3 will be removed in a future version of Storybook. Upgrade to CSF 4: https://storybook.js.org/docs/writing-stories/csf#upgrade-to-csf-4
export default {
  component: 'gizmo-element',
  argTypes: {
    canRotate: {
      control: 'boolean',
    },
    width: {
      control: { type: 'number', min: 400, max: 1200, step: 50 },
    },
    height: {
      control: { type: 'range', min: 200, max: 1500, step: 50 },
    },
    rawData: {
      control: 'object',
    },
    coordinates: {
      control: 'object',
    },
    texture: {
      control: {
        type: 'file',
        accept: '.png',
      },
    },
    position: {
      control: 'radio',
      options: ['left', 'right', 'center'],
    },
    rotationAxis: {
      control: 'check',
      options: ['x', 'y', 'z'],
    },
    scaling: {
      control: 'select',
      options: [10, 50, 75, 100, 200],
    },
    label: {
      control: 'text',
    },
    meshColors: {
      control: {
        type: 'color',
        presetColors: ['#ff0000', '#00ff00', '#0000ff'],
      },
    },
    revisionDate: {
      control: 'date',
    },
  },
};
```

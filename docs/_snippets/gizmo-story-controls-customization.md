```ts filename="Gizmo.stories.ts" renderer="angular" language="ts"
import type { Meta } from '@storybook/angular';

import { Gizmo } from './Gizmo.component';

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

```svelte filename="Gizmo.stories.svelte" renderer="svelte" language="js" tabTitle="Svelte CSF"
<script module>
  import { defineMeta } from '@storybook/addon-svelte-csf';

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

```js filename="Gizmo.stories.js" renderer="svelte" language="js" tabTitle="CSF"
import Gizmo from './Gizmo.svelte';

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

```js filename="Gizmo.stories.js|jsx" renderer="common" language="js"
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

```svelte filename="Gizmo.stories.svelte" renderer="svelte" language="ts-4-9" tabTitle="Svelte CSF"
<script module>
  import { defineMeta } from '@storybook/addon-svelte-csf';

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

```ts filename="Gizmo.stories.ts" renderer="svelte" language="ts-4-9" tabTitle="CSF"
import type { Meta } from '@storybook/svelte';

import Gizmo from './Gizmo.svelte';

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

```ts filename="Gizmo.stories.ts|tsx" renderer="common" language="ts-4-9"
// Replace your-framework with the name of your framework
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

```svelte filename="Gizmo.stories.svelte" renderer="svelte" language="ts" tabTitle="Svelte CSF"
<script module>
  import { defineMeta } from '@storybook/addon-svelte-csf';

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

```ts filename="Gizmo.stories.ts" renderer="svelte" language="ts" tabTitle="CSF"
import type { Meta } from '@storybook/svelte';

import Gizmo from './Gizmo.svelte';

const meta: Meta<typeof Gizmo> = {
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

```ts filename="Gizmo.stories.ts|tsx" renderer="common" language="ts"
// Replace your-framework with the name of your framework
import type { Meta } from '@storybook/your-framework';

import { Gizmo } from './Gizmo';

const meta: Meta<typeof Gizmo> = {
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

```js filename="Gizmo.stories.js" renderer="web-components" language="js"
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

```ts filename="Gizmo.stories.ts" renderer="web-components" language="ts"
import type { Meta } from '@storybook/web-components';

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

```ts filename="YourComponent.stories.ts" renderer="angular" language="ts" tabTitle="CSF 3"
import { Meta, moduleMetadata, StoryObj } from '@storybook/angular-vite';

import { YourComponent } from './your.component';

const meta: Meta<YourComponent> = {
  component: YourComponent,
  decorators: [
    moduleMetadata({
      imports: [
        //...
      ],
      declarations: [
        //...
      ],
      providers: [
        //...
      ],
    }),
  ],
};
export default meta;

type Story = StoryObj<YourComponent>;

export const Base: Story = {};
```

```ts filename="YourComponent.stories.ts" renderer="angular" language="ts" tabTitle="CSF Next 🧪"
import { moduleMetadata } from '@storybook/angular-vite';
import preview from '../.storybook/preview';

import { YourComponent } from './your.component';

const meta = preview.meta({
  component: YourComponent,
  decorators: [
    moduleMetadata({
      imports: [
        //...
      ],
      declarations: [
        //...
      ],
      providers: [
        //...
      ],
    }),
  ],
});

export const Base = meta.story();
```

```ts filename="ChipsModule.stories.ts" renderer="angular" language="ts" tabTitle="CSF 3"
import { type Meta, type StoryObj, applicationConfig } from '@storybook/angular';

import { BrowserAnimationsModule, provideAnimations } from '@angular/platform-browser/animations';
import { importProvidersFrom } from '@angular/core';

import { ChipsModule } from './angular-src/chips.module';

const meta: Meta<ChipsModule> = {
  component: ChipsModule,
  decorators: [
    // Apply application config to all stories
    applicationConfig({
      // List of providers and environment providers that should be available to the root component and all its children.
      providers: [
        ...
        // Import application-wide providers from a module
        importProvidersFrom(BrowserAnimationsModule)
        // Or use provide-style functions if available instead, e.g.
        provideAnimations()
      ],
    }),
  ],
};

export default meta;
type Story = StoryObj<ChipsModule>;

export const WithCustomApplicationProvider: Story = {
  render: () => ({
    // Apply application config to a specific story
    applicationConfig: {
      // The providers will be merged with the ones defined in the applicationConfig decorator's providers array of the global meta object
      providers: [...],
    }
  })
}
```

```ts filename="ChipsModule.stories.ts" renderer="angular" language="ts" tabTitle="CSF Next 🧪"
import { applicationConfig } from '@storybook/angular';

import { BrowserAnimationsModule, provideAnimations } from '@angular/platform-browser/animations';
import { importProvidersFrom } from '@angular/core';

import preview from '../.storybook/preview';

import { ChipsModule } from './angular-src/chips.module';

const meta = preview.type<{ args: ChipsModule }>().meta({
  component: ChipsModule,
  decorators: [
    // Apply application config to all stories
    applicationConfig({
      // List of providers and environment providers that should be available to the root component and all its children.
      providers: [
        ...
        // Import application-wide providers from a module
        importProvidersFrom(BrowserAnimationsModule)
        // Or use provide-style functions if available instead, e.g.
        provideAnimations()
      ],
    }),
  ],
});

export const WithCustomApplicationProvider = meta.story({
  render: () => ({
    // Apply application config to a specific story
    applicationConfig: {
      // The providers will be merged with the ones defined in the applicationConfig decorator's providers array of the global meta object
      providers: [...],
    }
  })
});
```

```ts filename="ChipsModule.stories.ts" renderer="angular" language="ts" tabTitle="CSF 3"
import { type Meta, type StoryObj, applicationConfig } from '@storybook/angular-vite';

import { provideHttpClient } from '@angular/common/http';

import { ChipsModule } from './angular-src/chips.module';

const meta: Meta<ChipsModule> = {
  component: ChipsModule,
  decorators: [
    // Apply application config to all stories
    applicationConfig({
      // List of providers and environment providers that should be available to the root component and all its children.
      providers: [
        // ...
        // Register application-wide providers with provide-style functions, e.g.
        provideHttpClient(),
        // You can also pull providers in from an NgModule with importProvidersFrom(SomeModule)
        // Note: Angular's legacy animations API (provideAnimations, provideNoopAnimations) is
        // deprecated since Angular 20.2. Prefer native CSS transitions or the animate.enter /
        // animate.leave bindings, which need no provider. If you still rely on the legacy API,
        // you can register its providers here yourself.
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
      providers: [
        /* ... */
      ],
    },
  }),
};
```

```ts filename="ChipsModule.stories.ts" renderer="angular" language="ts" tabTitle="CSF Next 🧪"
import { applicationConfig } from '@storybook/angular-vite';

import { provideHttpClient } from '@angular/common/http';

import preview from '../.storybook/preview';

import { ChipsModule } from './angular-src/chips.module';

const meta = preview.type<{ args: ChipsModule }>().meta({
  component: ChipsModule,
  decorators: [
    // Apply application config to all stories
    applicationConfig({
      // List of providers and environment providers that should be available to the root component and all its children.
      providers: [
        // ...
        // Register application-wide providers with provide-style functions, e.g.
        provideHttpClient(),
        // You can also pull providers in from an NgModule with importProvidersFrom(SomeModule)
        // Note: Angular's legacy animations API (provideAnimations, provideNoopAnimations) is
        // deprecated since Angular 20.2. Prefer native CSS transitions or the animate.enter /
        // animate.leave bindings, which need no provider. If you still rely on the legacy API,
        // you can register its providers here yourself.
      ],
    }),
  ],
});

export const WithCustomApplicationProvider = meta.story({
  render: () => ({
    // Apply application config to a specific story
    applicationConfig: {
      // The providers will be merged with the ones defined in the applicationConfig decorator's providers array of the global meta object
      providers: [
        /* ... */
      ],
    },
  }),
});
```

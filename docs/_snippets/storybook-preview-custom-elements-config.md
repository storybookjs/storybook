```js filename=".storybook/preview.js" renderer="web-components" language="js"
import { setCustomElementsManifest } from '@storybook/web-components-vite';

import customElements from '../custom-elements.json';

setCustomElementsManifest(customElements);

export default {
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/,
      },
    },
  },
};
```

```ts filename=".storybook/preview.ts" renderer="web-components" language="ts"
import type { Preview } from '@storybook/web-components-vite';

import { setCustomElementsManifest } from '@storybook/web-components-vite';

import customElements from '../custom-elements.json';

setCustomElementsManifest(customElements);

const preview: Preview = {
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
  },
};

export default preview;
```

```ts filename=".storybook/preview.ts" renderer="web-components" language="ts" tabTitle="CSF Next 🧪"
import { definePreview, setCustomElementsManifest } from '@storybook/web-components-vite';

import customElements from '../custom-elements.json';

setCustomElementsManifest(customElements);

export default definePreview({
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
  },
});
```

<!-- JS snippets still needed while providing both CSF 3 & Next -->

```js filename=".storybook/preview.js" renderer="web-components" language="js" tabTitle="CSF Next 🧪"
import { definePreview, setCustomElementsManifest } from '@storybook/web-components-vite';

import customElements from '../custom-elements.json';

setCustomElementsManifest(customElements);

export default definePreview({
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/,
      },
    },
  },
});
```

```js filename="CustomDocumentationComponent.js|jsx" renderer="common" language="js" tabTitle="js-component"
import React from 'react';

export function CustomDocumentationComponent() {
  return (
    <div>
      <h1>Replacing DocsPage with a custom component</h1>
      <p>
        The Docs page can be customized with your own custom content written as a React Component.
      </p>
      <p>Write your own code here👇</p>
    </div>
  );
}
```

```md renderer="common" language="mdx"
{/* Custom-MDX-Documentation.mdx */}

# Replacing DocsPage with custom `MDX` content

This file is a documentation-only `MDX`file to customize Storybook's [DocsPage](https://storybook.js.org/docs/writing-docs/docs-page#replacing-docspage).

It can be further expanded with your own code snippets and include specific information related to your stories.

For example:

import { Story } from "@storybook/addon-docs";

## Button

Button is the primary component. It has four possible states.

- [Primary](#primary)
- [Secondary](#secondary)
- [Large](#large)
- [Small](#small)

## With the story title defined

If you included the title in the story's default export, use this approach.

### Primary

<Story id="example-button--primary" />

### Secondary

<Story id="example-button--secondary" />

### Large

<Story id="example-button--large" />

### Small

<Story id="example-button--small" />

## Without the story title defined

If you didn't include the title in the story's default export, use this approach.

### Primary

<Story id="your-directory-button--primary"/>

### Secondary

<Story id="your-directory-button--secondary"/>

### Large

<Story id="your-directory-button--large"/>

### Small

<Story id="your-directory-button--small" />
```
```ts filename="CustomDocumentationComponent.ts|tsx" renderer="common" language="ts" tabTitle="ts-component"
export const CustomDocumentationComponent: React.FC = () => {
  return (
    <div>
      <h1>Replacing DocsPage with a custom component</h1>
      <p>
        The Docs page can be customized with your own custom content written as a React Component.
      </p>
      <p>Write your own code here👇</p>
    </div>
  );
};
```


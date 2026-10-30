# @storybook/experimental-addon-manager-docs

Experimental docs addon. The manager renders the article. Each story reference renders in its own preview iframe.

This package does not change `@storybook/addon-docs`. Installing both is unsupported.

Authoring is a strict MDX subset: Markdown plus a namespaced story tag. The parser reads the file as data and does not run author code.

```mdx
import * as SB from '@storybook/experimental-addon-manager-docs/mdx';
import * as ButtonStories from './Button.stories';

<SB.Story of={ButtonStories.Primary} />
```

The alias is yours. `<Story>` on its own is a parse error.

A story frame uses one size. Omitting `height`, or setting `height="auto"`, grows the frame with the story. `height="480"` or `height={480}` fixes the height in pixels. `height="100vh"` is the existing full preview pane height. `ratio="16/9"` keeps that aspect ratio as the frame width changes. `height` and `ratio` cannot be combined.

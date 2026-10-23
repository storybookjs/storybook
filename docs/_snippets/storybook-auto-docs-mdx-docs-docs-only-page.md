<!-- prettier-ignore -->
```mdx filename="ExampleDocumentation.mdx" renderer="common" language="mdx"
import { Meta } from '@storybook/addon-docs/blocks';

import * as ExampleComponentStories from './ExampleComponent.stories';

{/* 👇 Documentation-only page */}

<Meta title="Documentation" />

{/* 👇 Component documentation page */}

<Meta of={ExampleComponentStories} />
```

<!-- prettier-ignore -->
```mdx filename="ExampleDocumentation.mdx" renderer="svelte" language="mdx" tabTitle="CSF 3"
{/* ⚠️ CSF 3 is deprecated and will be removed in Storybook 12 */}
import { Meta } from '@storybook/addon-docs/blocks';

import * as ExampleComponentStories from './ExampleComponent.stories.svelte';

{/* 👇 Documentation-only page */}

<Meta title="Documentation" />

{/* 👇 Component documentation page */}

<Meta of={ExampleComponentStories} />
```

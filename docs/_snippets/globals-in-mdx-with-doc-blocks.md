```mdx filename="Component.mdx" renderer="common" language="mdx"
import { Meta, Story } from '@storybook/blocks';
import * as ComponentStories from './Component.stories';

<Meta of={ComponentStories} />

# Component Documentation

This component responds to the theme global. Use the toolbar to change themes and see how it adapts.

<Story of={ComponentStories.Default} />

The Story block above will automatically reflect global changes, including theme updates.
```


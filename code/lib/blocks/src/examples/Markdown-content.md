# This is an `.md` file

it has been imported using `import content from './Markdown-content.md?raw'`

Notice the `?raw` at the end above, it is necessary to work.

A full example:

```md
import { Markdown } from '@storybook/blocks';
import content from './Markdown-content.md?raw';

<Markdown>{content}</Markdown>
```

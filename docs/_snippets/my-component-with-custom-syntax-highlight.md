````md renderer="common" language="mdx"
{/* MyComponent.mdx */}

import { Meta } from '@storybook/blocks';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';

<Meta title="A Storybook doc with a custom syntax highlight for SCSS" />

# SCSS example

This is a sample SCSS code block example highlighted in Storybook

{/* Don't forget to replace (") with (```) when you copy the snippet to your own app */}

"scss
$font-stack: Helvetica, sans-serif;
$primary-color: #333;

body {
  font: 100% $font-stack;
  color: $primary-color;
}
"

{/* The usage of this "Component" is intentional to enable react-syntax-highlighter's own highlighter */}

export const Component = () => {
  return <SyntaxHighlighter/>;
};
````


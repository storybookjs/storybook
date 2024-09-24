import type { ComponentProps } from 'react';
import React from 'react';

import { ThemeProvider, ensure, themes } from '@storybook/core/theming';

import { SyntaxHighlighter } from './lazy-syntaxhighlighter';

export default {
  component: SyntaxHighlighter,
};

export const JS = {
  args: {
    language: 'js',
    children: `import React, { createElement } from 'react';
import { Good, Things } from 'life';

const result = () => createElement(Good, [createElement(Things, [], { all: true }), []);

console.log(result);
export { result as default };`,
  },
};

export const Default = JS;

export const Bash = {
  args: {
    language: 'bash',
    children: `npx npm-check-updates ' / storybook / ' -u && npm install`,
  },
};

export const CSS = {
  args: {
    language: 'css',
    children: `.className {
              border: 1px solid hotpink;
            }`,
  },
};

export const JSON = {
  args: {
    language: 'json',
    children: `{
        "number": 1,
        "string": "something",
        "object": {
          "property": "value",
        },
        array: [1,2,3],
      }`,
  },
};

export const Markdown = {
  args: {
    language: 'markdown',
    children: `
# a big header

some code:
      
\`\`\`js
const name = "a string";
\`\`\`
      
> crazy`,
  },
};

export const Yaml = {
  args: {
    language: 'yaml',
    children: `
      product:
        - sku: BL394D
          quantity: 4
          description: Basketball
          price: 450.00
`,
  },
};

export const JSX = {
  args: {
    language: 'jsx',
    children: `import { Good, Things } from 'life';

    const result = () => <Good><Things all={true} /></Good>;

    export { result as default };
`,
  },
};

export const GraphQL = {
  args: {
    language: 'graphql',
    children: `query HeroNameAndFriends($episode: Episode) {
      hero(episode: $episode) {
        name
      friends {
          name
      }
    }
  }
`,
  },
};

export const CustomSyntax = {
  args: {
    language: 'scss',
    children: `// Custom language syntax registered
div.parent {
  div.child {
    color: $red;
  }
}`,
  },
  loaders: [
    async () => {
      const scss = (await import('react-syntax-highlighter/dist/esm/languages/prism/scss')).default;
      SyntaxHighlighter.registerLanguage('scss', scss);
    },
  ],
};

export const Unsupported = {
  args: {
    language: 'C#',
    children: `// A Hello World! program in C#.
    using System;
    namespace HelloWorld
    {
        class Hello
      {
          static void Main()
        {
            Console.WriteLine("Hello World!");

          // Keep the console window open in debug mode.
          Console.WriteLine("Press any key to exit.");
          Console.ReadKey();
        }
      }
    }`,
  },
};

export const UnsupportedDark = {
  args: {
    language: 'C#',
    children: `// A Hello World! program in C#.
    using System;
    namespace HelloWorld
    {
        class Hello
      {
          static void Main()
        {
            Console.WriteLine("Hello World!");

          // Keep the console window open in debug mode.
          Console.WriteLine("Press any key to exit.");
          Console.ReadKey();
        }
      }
    }`,
  },
  render: (args: ComponentProps<typeof SyntaxHighlighter>) => (
    <ThemeProvider theme={ensure(themes.dark)}>
      <SyntaxHighlighter {...args} />
    </ThemeProvider>
  ),
};

export const Story = {
  args: {
    language: 'jsx',
    children: `import type { Meta, StoryObj } from '@storybook/react';

    import { Header } from './Header';
    
    const meta = {
      title: 'Example/Header',
      component: Header,
      // This component will have an automatically generated Autodocs entry: https://storybook.js.org/docs/react/writing-docs/autodocs
      tags: ['autodocs'],
      parameters: {
        // More on how to position stories at: https://storybook.js.org/docs/react/configure/story-layout
        layout: 'fullscreen',
      },
    } satisfies Meta<typeof Header>;
    
    export default meta;
    type Story = StoryObj<typeof meta>;
    
    export const LoggedIn: Story = {
      args: {
        user: {
          name: 'Jane Doe',
        },
      },
    };
    
    export const LoggedOut: Story = {};
    `,
  },
};

export const BorderedCopyable = {
  args: {
    copyable: true,
    bordered: true,
    language: 'jsx',
    children: `import { Good, Things } from 'life';

    const result = () => <Good><Things /></Good>;

    export { result as default };`,
  },
};

export const Padded = {
  args: {
    padded: true,
    language: 'jsx',
    children: `import { Good, Things } from 'life';

    const result = () => <Good><Things /></Good>;

    export { result as default };`,
  },
};

export const ShowLineNumbers = {
  args: {
    showLineNumbers: true,
    language: 'jsx',
    children: `import { Good, Things } from 'life';

    const result = () => <Good><Things /></Good>;

    export { result as default };`,
  },
};

import { it, expect } from 'vitest';

import { dedent } from 'ts-dedent';
import { fixMdxStyleTags, fixMdxComments } from './mdx-1-to-3';

it('fixMdxStyleTags fixes badly-formatted style blocks', () => {
  expect(
    fixMdxStyleTags(dedent`
        <style>{\`
          .foo {}
        
          .bar {}
        \`}</style>
      `)
  ).toEqual(dedent`
      <style>
        {\`
        .foo {}

        .bar {}
        \`}
      </style>
    `);
});

it('fixMdxStyleTags fixes multiple style blocks', () => {
  expect(
    fixMdxStyleTags(dedent`
        <style>{\`
          .foo {}
        \`}</style>
        <style>{\`
          .bar {}
        \`}</style>
      `)
  ).toMatchInlineSnapshot(`
    "<style>
      {\`
      .foo {}
      \`}
    </style>
    <style>
      {\`
      .bar {}
      \`}
    </style>"
  `);
});

it('fixMdxComments fixes all comments', () => {
  expect(
    fixMdxComments(dedent`
      # Hello
      
      <!-- This is a comment -->

      and this is not

      <!-- This is another comment -->
    `)
  ).toMatchInlineSnapshot(`
    "# Hello

    {/* This is a comment */}

    and this is not

    {/* This is another comment */}"
  `);
});

it('fixMdxComments keeps html comments in codeblocks', () => {
  expect(
    fixMdxComments(dedent`
      # Hello
      
      ~~~html
      <!-- This is a comment -->
      ~~~

      ~~~html
      <!-- This is a comment -->
      ~~~

      \`\`\`html
      <!-- This is a comment -->
      \`\`\`

      \`\`\`html
      <!-- This is a comment -->
      \`\`\`

      and this is not

      <!-- This is another comment -->
    `)
  ).toMatchInlineSnapshot(`
    "# Hello

    ~~~html
    <!-- This is a comment -->
    ~~~

    ~~~html
    <!-- This is a comment -->
    ~~~

    \`\`\`html
    <!-- This is a comment -->
    \`\`\`

    \`\`\`html
    <!-- This is a comment -->
    \`\`\`

    and this is not

    {/* This is another comment */}"
  `);
});

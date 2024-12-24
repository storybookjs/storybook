import { deprecate } from 'storybook/internal/node-logger';

import remarkGfm from 'remark-gfm';
import { dedent } from 'ts-dedent';

export const mdxLoaderOptions = async (config: any) => {
  config.mdxCompileOptions.remarkPlugins = config.mdxCompileOptions.remarkPlugins || [];
  config.mdxCompileOptions.remarkPlugins.push(remarkGfm);
  return config;
};

deprecate(dedent`
  The "@storybook/addon-mdx-gfm" addon is meant as a migration assistant for Storybook 8.0; and will likely be removed in a future version.
  It's recommended you read this document:
  https://storybook.js.org/docs/writing-docs/mdx#markdown-tables-arent-rendering-correctly

  Once you've made the necessary changes, you can remove the addon from your package.json and storybook config.
`);

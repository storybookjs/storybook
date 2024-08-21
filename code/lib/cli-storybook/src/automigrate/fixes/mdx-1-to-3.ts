import { basename } from 'node:path';

import chalk from 'chalk';
import fse from 'fs-extra';
import { dedent } from 'ts-dedent';

import type { Fix } from '../types';

const MDX1_STYLE_START = /<style>{`/g;
const MDX1_STYLE_END = /`}<\/style>/g;
const MDX1_COMMENT = /<!--(.+)-->/g;
const MDX1_CODEBLOCK = /(?:\n~~~(?:\n|.)*?\n~~~)|(?:\n```(?:\n|.)*?\n```)/g;

export const fixMdxStyleTags = (mdx: string) => {
  return mdx.replace(MDX1_STYLE_START, '<style>\n  {`').replace(MDX1_STYLE_END, '  `}\n</style>');
};

export const fixMdxComments = (mdx: string) => {
  const codeblocks = mdx.matchAll(MDX1_CODEBLOCK);

  // separate the mdx into sections without codeblocks & replace html comments NOT in codeblocks
  const sections = mdx
    .split(MDX1_CODEBLOCK)
    .map((v) => v.replace(MDX1_COMMENT, (original, group) => `{/*${group}*/}`));

  // interleave the original codeblocks with the replaced sections
  return sections.reduce((acc, item, i) => {
    const next = codeblocks.next();
    return next.done ? acc + item : acc + item + next.value[0];
  }, '');
};

const logger = console;

interface Mdx1to3Options {
  storiesMdxFiles: string[];
}

/**
 * Does the user have `.stories.mdx` files?
 *
 * If so:
 *
 * - Assume they might be MDX1
 * - Offer to help migrate to MDX3
 */
export const mdx1to3: Fix<Mdx1to3Options> = {
  id: 'mdx1to3',

  versionRange: ['<7.0.0', '>=8.0.0-alpha.0'],

  async check() {
    // Dynamically import globby because it is a pure ESM module
    const { globby } = await import('globby');

    const storiesMdxFiles = await globby('./!(node_modules)**/*.(story|stories).mdx');
    return storiesMdxFiles.length ? { storiesMdxFiles } : null;
  },

  prompt({ storiesMdxFiles }) {
    return dedent`
      We've found ${chalk.yellow(storiesMdxFiles.length)} '.stories.mdx' files in your project.
      
      Storybook has upgraded to MDX3 (https://mdxjs.com/blog/v3/). MDX3 itself doesn't contain disruptive breaking changes, whereas the transition from MDX1 to MDX2 was a significant change.
      We can try to automatically upgrade your MDX files to MDX3 format using some common patterns.
      
      After this install completes, and before you start Storybook, we strongly recommend reading the MDX2 section
      of the 7.0 migration guide. It contains useful tools for detecting and fixing any remaining issues.
      
      ${chalk.cyan('https://storybook.js.org/migration-guides/7.0')}
    `;
  },

  async run({ result: { storiesMdxFiles }, dryRun }) {
    await Promise.all([
      ...storiesMdxFiles.map(async (fname) => {
        const contents = await fse.readFile(fname, 'utf-8');
        const updated = fixMdxComments(fixMdxStyleTags(contents));
        if (updated === contents) {
          logger.info(`🆗 Unmodified ${basename(fname)}`);
        } else {
          logger.info(`✅ Modified ${basename(fname)}`);
          if (!dryRun) {
            await fse.writeFile(fname, updated);
          }
        }
      }),
    ]);
  },
};

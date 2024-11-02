import * as fs from 'fs';
import * as path from 'path';
import { visit } from 'unist-util-visit';
import remarkFrontmatter from 'remark-frontmatter';
import remarkParse from 'remark-parse';
import remarkStringify from 'remark-stringify';
import remarkMdx from 'remark-mdx';
import { unified } from 'unified';
import { read } from 'to-vfile';

export const transformPaths = async (docsDir) => {
  const root = fs.readdirSync(docsDir);

  const filterRoot = root.filter(
    (dir) =>
      ![
        '_snippets',
        'snippets',
        '.prettierignore',
        '.prettierrc',
        'toc.js',
        'assets',
        'frameworks.js',
      ].includes(dir)
  );

  const files: string[] = [];

  filterRoot.forEach((node) => {
    const isDirectory = fs.lstatSync(`${docsDir}/${node}`).isDirectory();
    if (isDirectory) {
      const folder = fs.readdirSync(`${docsDir}/${node}`);
      const listOfMarkdownFiles = folder.filter((str) => str.endsWith('.mdx'));
      files.push(...listOfMarkdownFiles.map((file) => path.join(node, file)));
    } else {
      files.push(node);
    }
  });

  files.forEach(async (file) => {
    const filePath = path.join(docsDir, file);

    const mdxProcessor = await unified()
      .use(remarkParse)
      .use(remarkStringify)
      .use(remarkFrontmatter, ['yaml', 'toml'])
      .use(remarkMdx)
      .use(function () {
        return function (tree) {
          visit(tree, 'mdxJsxFlowElement', (node) => {
            if (node.name === 'CodeSnippets') {
              const oldPaths = node.attributes.find((attr) => attr.name === 'paths');
              if (oldPaths && oldPaths.value && typeof oldPaths.value === 'object') {
                const oldValue = oldPaths.value.value;

                // Remove the first and last characters (the square brackets)
                const trimmedStr = oldValue.slice(1, -1);

                // Split the string into an array of strings
                const arr = trimmedStr.split(',\n').map((s) => s.trim().slice(1, -1));

                const split1 = arr[0].split('/');
                const split2 = split1[split1.length - 1].split('.');
                const newPath = `${split2[0]}.md`;

                node.attributes = node.attributes.map((attr) =>
                  attr.name === 'paths' ? { ...attr, name: 'path', value: newPath } : attr
                );
              }
            }
          });
        };
      })
      .process(await read(filePath));

    fs.writeFile(filePath, mdxProcessor.toString(), (err) => {
      if (err) throw err;
    });
  });
};

import * as fs from 'fs';
import * as path from 'path';
import { remark } from 'remark';
import remarkMdx from 'remark-mdx';
import { visit } from 'unist-util-visit';
import { is } from 'unist-util-is';

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

  files.forEach((file) => {
    const filePath = path.join(docsDir, file);
    const markdown = fs.readFileSync(filePath).toString();

    const mdxProcessor = remark().use(remarkMdx) as ReturnType<typeof remark>;
    const rootFile = mdxProcessor.parse(markdown);

    visit(rootFile, (node) => {
      if (node.type === 'mdxJsxFlowElement') {
        if (is(node, { name: 'CodeSnippets' })) {
          const oldPaths = node.attributes.find((attr) => 'name' in attr && attr.name === 'paths');

          const oldValue = typeof oldPaths.value !== 'string' && oldPaths.value.value;

          // Remove the first and last characters (the square brackets)
          const trimmedStr = oldValue.slice(1, -1);

          // Split the string into an array of strings
          const arr = trimmedStr.split(',\n').map((s) => s.trim().slice(1, -1));

          const split1 = arr[0].split('/');
          const split2 = split1[split1.length - 1].split('.');
          const newPath = `${split2[0]}.md`;

          node.attributes = [
            {
              type: 'mdxJsxAttribute',
              name: 'path',
              value: newPath,
            },
          ];
        }
      }
    });

    const newMdx = mdxProcessor.stringify(rootFile);

    fs.writeFile(filePath, newMdx, (err) => {
      if (err) throw err;
    });
  });
};

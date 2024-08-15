/* eslint-disable @typescript-eslint/ban-ts-comment */
import { existsSync, renameSync, writeFileSync } from 'node:fs';
import { basename, join, parse } from 'node:path';

import { babelParse, babelParseExpression } from '@storybook/core/csf-tools';

import type { BabelFile } from '@babel/core';
import * as babel from '@babel/core';
import * as t from '@babel/types';
import type { FileInfo } from 'jscodeshift';
import camelCase from 'lodash/camelCase';
import type { MdxFlowExpression } from 'mdast-util-mdx-expression';
import type {
  MdxJsxAttribute,
  MdxJsxExpressionAttribute,
  MdxJsxFlowElement,
  MdxJsxTextElement,
} from 'mdast-util-mdx-jsx';
import type { MdxjsEsm } from 'mdast-util-mdxjs-esm';
import prettier from 'prettier';
import * as recast from 'recast';
import { remark } from 'remark';
import remarkMdx from 'remark-mdx';
import { is } from 'unist-util-is';
import { SKIP, visit } from 'unist-util-visit';

const mdxProcessor = remark().use(remarkMdx) as ReturnType<typeof remark>;

const renameList: { original: string; baseName: string }[] = [];
const brokenList: { original: string; baseName: string }[] = [];

export default async function jscodeshift(info: FileInfo) {
  const parsed = parse(info.path);

  let baseName = join(
    parsed.dir,
    parsed.name.replace('.mdx', '').replace('.stories', '').replace('.story', '')
  );

  // make sure the new csf file we are going to create exists
  while (existsSync(`${baseName}.stories.js`)) {
    baseName += '_';
  }

  try {
    const { csf, mdx } = await transform(info, basename(baseName));

    if (csf != null) {
      writeFileSync(`${baseName}.stories.js`, csf);
    }

    renameList.push({ original: info.path, baseName });

    return mdx;
  } catch (e) {
    brokenList.push({ original: info.path, baseName });
    throw e;
  }
}

// The JSCodeshift CLI doesn't return a list of files that were transformed or skipped.
// This is a workaround to rename the files after the transformation, which we can remove after we switch from jscodeshift to another solution.
process.on('exit', () => {
  renameList.forEach((file) => {
    renameSync(file.original, `${file.baseName}.mdx`);
  });
  brokenList.forEach((file) => {
    renameSync(file.original, `${file.original}.broken`);
  });
});

export async function transform(
  info: FileInfo,
  baseName: string
): Promise<{ mdx: string; csf: string | null }> {
  const root = mdxProcessor.parse(info.source);
  const storyNamespaceName = nameToValidExport(`${baseName}Stories`);

  const metaAttributes: Array<MdxJsxAttribute | MdxJsxExpressionAttribute> = [];
  const storiesMap = new Map<
    string,
    | {
        type: 'value';
        attributes: Array<MdxJsxAttribute | MdxJsxExpressionAttribute>;
        children: (MdxJsxFlowElement | MdxJsxTextElement)['children'];
      }
    | {
        type: 'reference';
      }
    | {
        type: 'id';
      }
  >();

  // rewrite addon docs import
  // @ts-ignore
  visit(root, ['mdxjsEsm'], (node: MdxjsEsm) => {
    node.value = node.value
      .replaceAll('@storybook/addon-docs/blocks', '@storybook/blocks')
      .replaceAll('@storybook/addon-docs', '@storybook/blocks');

    if (node.value.includes('@storybook/blocks')) {
      // @ts-ignore
      const file: BabelFile = new babel.File(
        { filename: 'info.path' },
        { code: node.value, ast: babelParse(node.value) }
      );

      file.path.traverse({
        ImportDeclaration(path) {
          if (path.node.source.value === '@storybook/blocks') {
            path.get('specifiers').forEach((specifier) => {
              if (specifier.isImportSpecifier()) {
                const imported = specifier.get('imported');
                if (imported.isIdentifier() && imported.node.name === 'ArgsTable') {
                  imported.node.name = 'Controls';
                }
              }
            });
          }
        },
      });

      node.value = recast.print(file.ast).code;
    }
  });

  const file = getEsmAst(root);

  visit(root, ['mdxJsxFlowElement', 'mdxJsxTextElement'], (node, index, parent) => {
    if (node.type === 'mdxJsxFlowElement' || node.type === 'mdxJsxTextElement') {
      if (is(node, { name: 'ArgsTable' })) {
        node.name = 'Controls';
        node.attributes = [];
      }

      if (is(node, { name: 'Story' })) {
        const nameAttribute = node.attributes.find(
          (it) => it.type === 'mdxJsxAttribute' && it.name === 'name'
        );
        const idAttribute = node.attributes.find(
          (it) => it.type === 'mdxJsxAttribute' && it.name === 'id'
        );
        const storyAttribute = node.attributes.find(
          (it) => it.type === 'mdxJsxAttribute' && it.name === 'story'
        );
        if (typeof nameAttribute?.value === 'string') {
          let name = nameToValidExport(nameAttribute.value);

          while (variableNameExists(name)) {
            name += '_';
          }

          storiesMap.set(name, {
            type: 'value',
            attributes: node.attributes,
            children: node.children,
          });
          node.attributes = [
            {
              type: 'mdxJsxAttribute',
              name: 'of',
              value: {
                type: 'mdxJsxAttributeValueExpression',
                value: `${storyNamespaceName}.${name}`,
              },
            },
          ];
          node.children = [];
        } else if (idAttribute?.value) {
          // e.g. <Story id="button--primary" />
          // should be migrated manually as it is very hard to find out where the definition of such a string id is located
          const nodeString = mdxProcessor.stringify({ type: 'root', children: [node] }).trim();
          const newNode: MdxFlowExpression = {
            type: 'mdxFlowExpression',
            value: `/* ${nodeString} is deprecated, please migrate it to <Story of={referenceToStory} /> see: https://storybook.js.org/migration-guides/7.0 */`,
          };
          storiesMap.set(idAttribute.value as string, { type: 'id' });
          parent?.children.splice(index as number, 0, newNode);
          // current index is the new comment, and index + 1 is current node
          // SKIP traversing current node, and continue with the node after that
          return [SKIP, (index as number) + 2];
        } else if (
          storyAttribute?.type === 'mdxJsxAttribute' &&
          typeof storyAttribute.value === 'object' &&
          storyAttribute.value?.type === 'mdxJsxAttributeValueExpression'
        ) {
          // e.g. <Story story={Primary} />

          const name = storyAttribute.value?.value;
          node.attributes = [
            {
              type: 'mdxJsxAttribute',
              name: 'of',
              value: {
                type: 'mdxJsxAttributeValueExpression',
                value: `${storyNamespaceName}.${name}`,
              },
            },
          ];
          node.children = [];

          storiesMap.set(name ?? '', { type: 'reference' });
        } else {
          parent?.children.splice(index as number, 1);
          // Do not traverse `node`, continue at the node *now* at `index`.
          return [SKIP, index];
        }
      }
    }
    return undefined;
  });

  file.path.traverse({
    // remove mdx imports from csf
    ImportDeclaration(path) {
      if (path.node.source.value === '@storybook/blocks') {
        path.remove();
      }
    },
    // remove exports from csf file
    ExportNamedDeclaration(path) {
      // @ts-ignore
      path.replaceWith(path.node.declaration);
    },
  });

  if (storiesMap.size === 0) {
    // A CSF file must have at least one story, so skip migrating if this is the case.
    return {
      csf: null,
      mdx: mdxProcessor.stringify(root),
    };
  }

  // Rewrites the Meta tag to use the new story namespace
  visit(root, ['mdxJsxFlowElement', 'mdxJsxTextElement'], (node, index, parent) => {
    if (
      (node.type === 'mdxJsxFlowElement' || node.type === 'mdxJsxTextElement') &&
      is(node, { name: 'Meta' })
    ) {
      metaAttributes.push(...node.attributes);
      node.attributes = [
        {
          type: 'mdxJsxAttribute',
          name: 'of',
          value: {
            type: 'mdxJsxAttributeValueExpression',
            value: storyNamespaceName,
          },
        },
      ];
    }
  });

  const metaProperties = metaAttributes.flatMap((attribute) => {
    if (attribute.type === 'mdxJsxAttribute') {
      if (typeof attribute.value === 'string') {
        return [t.objectProperty(t.identifier(attribute.name), t.stringLiteral(attribute.value))];
      }
      return [
        t.objectProperty(
          t.identifier(attribute.name),
          babelParseExpression(attribute.value?.value ?? '') as any as t.Expression
        ),
      ];
    }
    return [];
  });

  addStoriesImport(root, baseName, storyNamespaceName);

  const newStatements: t.Statement[] = [
    t.exportDefaultDeclaration(t.objectExpression(metaProperties)),
  ];

  function mapChildrenToRender(children: (MdxJsxFlowElement | MdxJsxTextElement)['children']) {
    const child = children[0];

    if (!child) {
      return undefined;
    }

    if (child.type === 'text') {
      return t.arrowFunctionExpression([], t.stringLiteral(child.value));
    }
    if (child.type === 'mdxFlowExpression' || child.type === 'mdxTextExpression') {
      const expression = babelParseExpression(child.value) as any as t.Expression;

      // Recreating those lines: https://github.com/storybookjs/mdx1-csf/blob/f408fc97e9a63097ca1ee577df9315a3cccca975/src/sb-mdx-plugin.ts#L185-L198
      const BIND_REGEX = /\.bind\(.*\)/;
      if (BIND_REGEX.test(child.value)) {
        return expression;
      }
      if (t.isIdentifier(expression)) {
        return expression;
      }
      if (t.isArrowFunctionExpression(expression)) {
        return expression;
      }
      return t.arrowFunctionExpression([], expression);
    }

    const expression = babelParseExpression(
      mdxProcessor.stringify({ type: 'root', children: [child] })
    ) as any as t.Expression;
    return t.arrowFunctionExpression([], expression);
  }

  function variableNameExists(name: string) {
    let found = false;
    file.path.traverse({
      VariableDeclarator: (path) => {
        const lVal = path.node.id;

        if (t.isIdentifier(lVal) && lVal.name === name) {
          found = true;
        }
      },
    });
    return found;
  }

  newStatements.push(
    ...[...storiesMap].flatMap(([key, value]) => {
      if (value.type === 'id') {
        return [];
      }
      if (value.type === 'reference') {
        return [
          t.exportNamedDeclaration(null, [t.exportSpecifier(t.identifier(key), t.identifier(key))]),
        ];
      }
      const renderProperty = mapChildrenToRender(value.children);
      const newObject = t.objectExpression([
        ...(renderProperty ? [t.objectProperty(t.identifier('render'), renderProperty)] : []),
        ...value.attributes.flatMap((attribute) => {
          if (attribute.type === 'mdxJsxAttribute') {
            if (typeof attribute.value === 'string') {
              return [
                t.objectProperty(t.identifier(attribute.name), t.stringLiteral(attribute.value)),
              ];
            }
            return [
              t.objectProperty(
                t.identifier(attribute.name),
                babelParseExpression(attribute.value?.value ?? '') as any as t.Expression
              ),
            ];
          }
          return [];
        }),
      ]);

      return [
        t.exportNamedDeclaration(
          t.variableDeclaration('const', [t.variableDeclarator(t.identifier(key), newObject)])
        ),
      ];
    })
  );

  file.path.node.body = [...file.path.node.body, ...newStatements];

  const newMdx = mdxProcessor.stringify(root);
  let output = recast.print(file.path.node).code;

  const path = `${info.path}.jsx`;
  output = await prettier.format(output.trim(), {
    ...(await prettier.resolveConfig(path)),
    filepath: path,
  });

  return {
    csf: output,
    mdx: newMdx,
  };
}

function getEsmAst(root: ReturnType<typeof mdxProcessor.parse>) {
  const esm: string[] = [];
  visit(root, 'mdxjsEsm', (node) => {
    esm.push(node.value);
  });
  const esmSource = `${esm.join('\n\n')}`;

  // @ts-expect-error (File is not yet exposed, see https://github.com/babel/babel/issues/11350#issuecomment-644118606)
  const file: BabelFile = new babel.File(
    { filename: 'info.path' },
    { code: esmSource, ast: babelParse(esmSource) }
  );
  return file;
}

function addStoriesImport(
  root: ReturnType<typeof mdxProcessor.parse>,
  baseName: string,
  storyNamespaceName: string
): void {
  let found = false;
  visit(root, 'mdxjsEsm', (node) => {
    if (!found) {
      node.value += `\nimport * as ${storyNamespaceName} from './${baseName}.stories';`;
      found = true;
    }
  });
}

export function nameToValidExport(name: string) {
  const [first, ...rest] = Array.from(camelCase(name));

  return `${first.match(/[a-zA-Z_$]/) ? first.toUpperCase() : `$${first}`}${rest.join('')}`;
}

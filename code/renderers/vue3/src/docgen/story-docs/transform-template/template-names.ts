import { ElementTypes, NodeTypes, parse, type TemplateChildNode } from '@vue/compiler-dom';

import {
  type ESTreeNode as Node,
  normalizeLineEndings,
  parseModule,
  walk,
} from 'storybook/internal/csf-tools';

import { isNamePosition } from './forward-setup.ts';
import { parseTemplateExpression } from './transform-template.ts';

const BUILT_IN_DIRECTIVES = new Set(
  'bind cloak else else-if for html if is memo model on once pre show slot text'.split(' ')
);

const camelize = (name: string) =>
  name.replace(/-(\w)/g, (_, letter: string) => letter.toUpperCase());

// Tags are read as written and camelized, custom directives as `vFoo`.
export function templateNames(template: string): string[] {
  const names = new Set<string>();
  const readExpression = (code: string) => {
    let expression: Node | undefined = parseTemplateExpression(code);
    if (!expression) {
      // A handler can be statements: `@click="a++; b = 1"`.
      try {
        expression = parseModule(code).program;
      } catch {
        return;
      }
    }
    walk(expression, (node, parent) => {
      if (node.type === 'Identifier' && !isNamePosition(node, parent)) {
        names.add(node.name);
      }
    });
  };
  const visit = (nodes: TemplateChildNode[]) => {
    for (const node of nodes) {
      if (
        node.type === NodeTypes.INTERPOLATION &&
        node.content.type === NodeTypes.SIMPLE_EXPRESSION
      ) {
        readExpression(node.content.content);
      }
      if (node.type !== NodeTypes.ELEMENT) {
        continue;
      }
      // Native tags read nothing from `<script setup>`.
      if (node.tagType !== ElementTypes.ELEMENT) {
        names.add(node.tag);
        names.add(camelize(node.tag));
      }
      for (const prop of node.props) {
        if (prop.type !== NodeTypes.DIRECTIVE) {
          continue;
        }
        if (!BUILT_IN_DIRECTIVES.has(prop.name)) {
          const pascal = camelize(prop.name);
          names.add(`v${pascal.charAt(0).toUpperCase()}${pascal.slice(1)}`);
        }
        // `:count` is `:count="count"`.
        if (
          prop.name === 'bind' &&
          !prop.exp &&
          prop.arg?.type === NodeTypes.SIMPLE_EXPRESSION &&
          prop.arg.isStatic
        ) {
          names.add(camelize(prop.arg.content));
        }
        // A `v-for` source reads names; its alias, like a slot's, declares them.
        const read = prop.name === 'for' ? prop.forParseResult?.source : prop.exp;
        if (read?.type === NodeTypes.SIMPLE_EXPRESSION && prop.name !== 'slot') {
          readExpression(read.content);
        }
      }
      visit(node.children);
    }
  };
  visit(parse(normalizeLineEndings(template), { onError: () => {} }).children);
  return [...names];
}

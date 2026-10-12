import { types as t } from 'storybook/internal/babel';
import { sourceOf } from 'storybook/internal/csf-tools';
import { ARG_PATH_PATTERN } from 'storybook/internal/docs-tools';

import { escapeTemplateText } from '../../docs/template-format.ts';
import type { HtmlAttribute, HtmlNode } from './html-tree.ts';
import { printHtml } from './html-tree.ts';
import type { TemplateScope } from './template-scope.ts';
import { argReferenceForExpression } from './template-scope.ts';

interface Hole {
  attribute: boolean;
  display: string;
  template: string;
}

const ARG_PATH = new RegExp(ARG_PATH_PATTERN);
const MARKER = /\uE000(\d+)\uE001/g;
const ATTRIBUTE_MARKER = /([ \t]*\n[ \t]*| )?\uE000(\d+)\uE001/g;

// Builds the live `template` that `../../docs/template-format.ts` describes. A hole stands in the
// printed tree as a marker measured as the snippet's text at that spot, so both are laid out alike.
export class TemplateHoles {
  private holes: Hole[] = [];

  // Set when part of the snippet depends on the args in a way no hole can express.
  blocked = false;

  get size() {
    return this.holes.filter((hole) => hole.template !== '').length;
  }

  attribute(template: string, display: string): { index: number; node: HtmlAttribute } {
    const index = this.holes.push({ attribute: true, display, template }) - 1;
    return { index, node: { name: marker(index), value: undefined } };
  }

  text(template: string, display: string): HtmlNode {
    const index = this.holes.push({ attribute: false, display, template }) - 1;
    return { kind: 'text', text: marker(index) };
  }

  drop(index: number) {
    this.holes[index] = { attribute: true, display: '', template: '' };
  }

  print(nodes: HtmlNode[]): string {
    const width = (text: string) => {
      let length = 0;
      const shown = text.replace(MARKER, (_, index: string) => {
        const hole = this.holes[Number(index)]!;
        length -= hole.attribute && hole.display === '' ? 1 : 0;
        return hole.display;
      });
      return length + shown.length;
    };
    return escapeTemplateText(printHtml(nodes, width)).replace(
      ATTRIBUTE_MARKER,
      (_, space: string | undefined, index: string) => {
        const hole = this.holes[Number(index)]!;
        return hole.attribute && hole.template === '' ? '' : `${space ?? ''}${hole.template}`;
      }
    );
  }
}

const marker = (index: number) => `\uE000${index}\uE001`;

// `args.label`, `args.user.name`, `args["default-slot"]`.
export const argPathSource = (reference: { name: string; path: string[] }) =>
  sourceOf(argPathNode(reference));

const argPathNode = ({ name, path }: { name: string; path: string[] }): t.Expression =>
  [name, ...path].reduce<t.Expression>(
    (object, key) =>
      t.isValidIdentifier(key)
        ? t.memberExpression(object, t.identifier(key))
        : t.memberExpression(object, t.stringLiteral(key), true),
    t.identifier('args')
  );

// The expression with every arg it reads written as `args.name`; `undefined` when it reads them
// another way, such as passing them along whole or binding an arg's name again, or when the filler
// could not read it back.
export function normalizeExpression(
  expression: t.Expression,
  scope: TemplateScope
): string | undefined {
  const argNames = new Set(['args', ...scope.params, ...scope.aliases.keys()]);
  let failed = false;

  const rebinds = (node: t.Node) =>
    Object.keys(t.getBindingIdentifiers(node)).some((name) => argNames.has(name));

  const visit = (node: t.Node): t.Node => {
    if (t.isExpression(node)) {
      const reference = argReferenceForExpression(node, scope);
      if (reference) {
        return argPathNode(reference);
      }
      if (t.isIdentifier(node)) {
        const alias = scope.aliases.get(node.name);
        if (alias?.kind === 'value') {
          return t.valueToNode(alias.value);
        }
        failed ||= argNames.has(node.name);
        return node;
      }
    }
    if (
      (t.isFunction(node) && node.params.some(rebinds)) ||
      t.isVariableDeclarator(node) ||
      t.isFunctionDeclaration(node) ||
      t.isClassDeclaration(node) ||
      t.isCatchClause(node)
    ) {
      failed ||= rebinds(t.isCatchClause(node) ? (node.param ?? node) : node);
    }
    for (const key of t.VISITOR_KEYS[node.type] ?? []) {
      if (isNonReferenceKey(node, key)) {
        continue;
      }
      const record = node as unknown as Record<string, unknown>;
      const child = record[key];
      if (Array.isArray(child)) {
        record[key] = child.map((entry) => (t.isNode(entry) ? visit(entry) : entry));
      } else if (t.isNode(child)) {
        record[key] = visit(child);
      }
    }
    if (t.isObjectProperty(node) && node.shorthand && !t.isIdentifier(node.value)) {
      node.shorthand = false;
    }
    return node;
  };

  const normalized = visit(t.cloneNode(expression, true));
  return failed || !isFillable(normalized) ? undefined : sourceOf(normalized);
}

// The filler reads a hole as text: a regex literal can hide where the hole ends, and an arg path
// written in a string would be filled.
const isFillable = (node: t.Node) => {
  let fillable = true;
  t.traverseFast(node, (child) => {
    fillable &&= !(
      t.isRegExpLiteral(child) ||
      (t.isStringLiteral(child) && ARG_PATH.test(child.value)) ||
      (t.isTemplateElement(child) && ARG_PATH.test(child.value.raw))
    );
  });
  return fillable;
};

const isNonReferenceKey = (node: t.Node, key: string) =>
  ((t.isMemberExpression(node) || t.isOptionalMemberExpression(node)) &&
    key === 'property' &&
    !node.computed) ||
  ((t.isObjectProperty(node) || t.isObjectMethod(node) || t.isClassProperty(node)) &&
    key === 'key' &&
    !node.computed);

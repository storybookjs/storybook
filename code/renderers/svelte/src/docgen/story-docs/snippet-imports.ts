import {
  buildImportStatements,
  collectImportBindings,
  resolveComponentImport,
  type ImportBinding,
} from 'storybook/internal/csf-tools';
import { babelParse, traverse, types as t } from 'storybook/internal/babel';
import { parse } from 'svelte/compiler';
import { walk } from 'zimmerframe';
import type { SvelteAST } from '../../svelte-csf/parser/ast.ts';

export function buildSnippetImportBlock(
  markup: string,
  {
    bindings,
    importOverride,
    instanceScript,
  }: {
    bindings: Map<string, ImportBinding>;
    importOverride?: string;
    instanceScript?: { code: string; typescript: boolean };
  }
): { block?: string; unresolved: string[]; unresolvedIdentifiers?: string[] } {
  bindings = new Map(bindings);
  const names = new Set<string>();
  const ast = parse(markup, { modern: true });
  walk<SvelteAST.SvelteNode, null>(ast.fragment, null, {
    Component(node, { next }) {
      names.add(node.name);
      next();
    },
  });
  const componentNames = new Set(names);
  const identifiers = new Set<string>();
  const visitedExpressions = new Set<object>();
  walk<SvelteAST.SvelteNode, null>(ast.fragment, null, {
    Identifier(node, { path }) {
      const declarationPatterns = path.flatMap<object | null>((ancestor) =>
        ancestor.type === 'LetDirective'
          ? [ancestor.expression]
          : ancestor.type === 'AwaitBlock'
            ? [ancestor.value, ancestor.error]
            : ancestor.type === 'ConstTag'
              ? ancestor.declaration.declarations.map((declaration) => declaration.id)
              : []
      );
      if (
        declarationPatterns.some(
          (pattern) =>
            Object.is(pattern, node) || path.some((ancestor) => Object.is(ancestor, pattern))
        )
      )
        return;
      const expression = path.find((ancestor) => /Expression$/.test(ancestor.type)) ?? node;
      if (
        !('start' in expression) ||
        typeof expression.start !== 'number' ||
        !('end' in expression) ||
        typeof expression.end !== 'number'
      )
        return;
      if (visitedExpressions.has(expression)) return;
      visitedExpressions.add(expression);
      const scopedNames = new Set<string>();
      for (const ancestor of path) {
        if (ancestor.type === 'Fragment') {
          for (const child of ancestor.nodes)
            if (child.type === 'SnippetBlock') scopedNames.add(child.expression.name);
        }
        const patterns =
          ancestor.type === 'SnippetBlock'
            ? ancestor.parameters
            : ancestor.type === 'EachBlock' && !Object.is(expression, ancestor.expression)
              ? [ancestor.context]
              : ancestor.type === 'AwaitBlock'
                ? [
                    ...(ancestor.then && path.some((node) => Object.is(node, ancestor.then))
                      ? [ancestor.value]
                      : []),
                    ...(ancestor.catch && path.some((node) => Object.is(node, ancestor.catch))
                      ? [ancestor.error]
                      : []),
                  ]
                : ancestor.type === 'Fragment'
                  ? ancestor.nodes.flatMap((child) =>
                      child.type === 'ConstTag'
                        ? child.declaration.declarations.map((declaration) => declaration.id)
                        : []
                    )
                  : [];
        for (const pattern of patterns) {
          if (
            !pattern ||
            !('start' in pattern) ||
            typeof pattern.start !== 'number' ||
            !('end' in pattern) ||
            typeof pattern.end !== 'number'
          )
            continue;
          const declaration = babelParse(`(${markup.slice(pattern.start, pattern.end)}) => {}`);
          traverse(declaration, {
            ArrowFunctionExpression(parameter) {
              for (const pattern of parameter.node.params)
                for (const name of Object.keys(t.getBindingIdentifiers(pattern)))
                  scopedNames.add(name);
            },
          });
        }
        if (ancestor.type === 'EachBlock' && ancestor.index) scopedNames.add(ancestor.index);
        if ('attributes' in ancestor) {
          for (const attribute of ancestor.attributes) {
            if (attribute.type !== 'LetDirective') continue;
            if (!attribute.expression) scopedNames.add(attribute.name);
            else {
              const parameter = babelParse(
                `(${markup.slice(attribute.expression.start, attribute.expression.end)}) => {}`
              );
              traverse(parameter, {
                ArrowFunctionExpression(parameter) {
                  for (const pattern of parameter.node.params)
                    for (const name of Object.keys(t.getBindingIdentifiers(pattern)))
                      scopedNames.add(name);
                },
              });
            }
          }
        }
      }
      const code = markup.slice(expression.start, expression.end);
      const parsed = babelParse(`(${code})`);
      traverse(parsed, {
        ReferencedIdentifier(reference) {
          if (
            !reference.scope.hasBinding(reference.node.name) &&
            !scopedNames.has(reference.node.name)
          )
            identifiers.add(reference.node.name);
        },
      });
    },
  });
  walk<SvelteAST.SvelteNode, null>(ast.fragment, null, {
    UseDirective(node, { next }) {
      identifiers.add(node.name.split('.')[0]);
      next();
    },
    TransitionDirective(node, { next }) {
      identifiers.add(node.name.split('.')[0]);
      next();
    },
    AnimateDirective(node, { next }) {
      identifiers.add(node.name.split('.')[0]);
      next();
    },
  });
  const declarations = new Set<t.Statement>();
  const unresolvedIdentifiers = new Set<string>();
  const instance = babelParse(instanceScript?.code ?? '');
  traverse(instance, {
    Program(path) {
      for (const [name, binding] of collectImportBindings(path)) bindings.set(name, binding);
      const typeDeclarations = new Map(
        path
          .get('body')
          .filter(
            (statement) =>
              t.isTSTypeAliasDeclaration(statement.node) ||
              t.isTSInterfaceDeclaration(statement.node)
          )
          .flatMap((statement) =>
            'id' in statement.node && t.isIdentifier(statement.node.id)
              ? [[statement.node.id.name, statement] as const]
              : []
          )
      );
      const visit = (name: string) => {
        if (bindings.has(name)) {
          names.add(name);
          return;
        }
        if (
          ['$state', '$derived', '$effect', '$props', '$bindable', '$inspect', '$host'].includes(
            name
          ) ||
          [
            'undefined',
            'NaN',
            'Infinity',
            'console',
            'window',
            'document',
            'navigator',
            'location',
            'history',
            'localStorage',
            'sessionStorage',
            'alert',
            'confirm',
            'prompt',
            'setTimeout',
            'clearTimeout',
            'setInterval',
            'clearInterval',
            'requestAnimationFrame',
            'cancelAnimationFrame',
            'fetch',
            'URL',
            'URLSearchParams',
            'performance',
            'queueMicrotask',
            'structuredClone',
            'Event',
            'CustomEvent',
          ].includes(name)
        )
          return;
        const binding = path.scope.getBinding(name);
        if (!binding && !typeDeclarations.has(name)) {
          unresolvedIdentifiers.add(name);
          return;
        }
        const statement = binding?.path.getStatementParent() ?? typeDeclarations.get(name);
        if (
          !statement ||
          !t.isStatement(statement.node) ||
          t.isImportDeclaration(statement.node) ||
          declarations.has(statement.node)
        )
          return;
        declarations.add(statement.node);
        statement.traverse({
          TSTypeReference(reference) {
            if (
              t.isIdentifier(reference.node.typeName) &&
              typeDeclarations.has(reference.node.typeName.name)
            )
              visit(reference.node.typeName.name);
          },
          ReferencedIdentifier(reference) {
            const dependency = reference.scope.getBinding(reference.node.name);
            if (dependency?.scope === path.scope && dependency !== binding)
              visit(reference.node.name);
          },
        });
      };
      for (const name of identifiers) visit(name);
      path.stop();
    },
  });
  const declarationSource = instance.program.body
    .filter((statement) => declarations.has(statement))
    .map((statement) => instanceScript?.code.slice(statement.start ?? 0, statement.end ?? 0) ?? '');
  const refs = [...names].map((name) => resolveComponentImport(name, bindings));
  const statements = buildImportStatements({
    refs: refs.map((ref) => ({
      ...ref,
      importOverride: componentNames.has(ref.componentName) ? importOverride : undefined,
    })),
  });
  const unresolved = refs.filter((ref) => !ref.importId).map((ref) => ref.componentName);
  const lines = [
    ...statements,
    ...(declarationSource.length && statements.length ? [''] : []),
    ...declarationSource,
  ];
  return {
    ...(lines.length > 0
      ? {
          block: `<script${declarationSource.length && instanceScript?.typescript ? ' lang="ts"' : ''}>\n${lines
            .map((statement) =>
              statement
                ? statement
                    .split('\n')
                    .map((line) => `  ${line}`)
                    .join('\n')
                : ''
            )
            .join('\n')}\n</script>`,
        }
      : {}),
    unresolved,
    ...(unresolvedIdentifiers.size ? { unresolvedIdentifiers: [...unresolvedIdentifiers] } : {}),
  };
}

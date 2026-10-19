import {
  buildImportStatements,
  collectImportBindings,
  resolveComponentImport,
  type ImportBinding,
} from 'storybook/internal/csf-tools';
import { babelParse, babelPrint, traverse, types as t } from 'storybook/internal/babel';
import { parse } from 'svelte/compiler';
import { walk } from 'zimmerframe';
import type { SvelteAST } from '../../svelte-csf/parser/ast.ts';

export function buildSnippetImportBlock(
  markup: string,
  {
    bindings,
    importOverride,
    instanceScript,
    moduleScript,
  }: {
    bindings: Map<string, ImportBinding>;
    importOverride?: string;
    instanceScript?: { code: string; typescript: boolean };
    moduleScript?: { code: string; typescript: boolean };
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
  names.clear();
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
  const unresolvedIdentifiers = new Set<string>();
  const programs = [moduleScript, instanceScript].map((script) => ({
    script,
    ast: babelParse(script?.code ?? ''),
    declarations: new Set<t.Node>(),
    imports: new Map<string, ImportBinding>(),
    names: new Set<string>(),
  }));
  const contexts: {
    program: (typeof programs)[number];
    path: Parameters<typeof collectImportBindings>[0];
  }[] = [];
  for (const program of programs)
    traverse(program.ast, {
      Program(path) {
        program.imports = collectImportBindings(path);
        contexts.push({ program, path });
        path.stop();
      },
    });
  const typeDeclaration = (path: Parameters<typeof collectImportBindings>[0], name: string) => {
    for (const statement of path.get('body')) {
      const declaration = statement.isExportNamedDeclaration()
        ? statement.get('declaration')
        : statement;
      if (
        (declaration.isTSTypeAliasDeclaration() || declaration.isTSInterfaceDeclaration()) &&
        declaration.node.id.name === name
      )
        return declaration;
    }
  };
  const visit = (name: string, scope = contexts.length - 1) => {
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

    const context = contexts[scope];
    if (!context) {
      if (bindings.has(name)) names.add(name);
      else unresolvedIdentifiers.add(name);
      return;
    }
    const { program, path } = context;
    const binding = path.scope.getBinding(name);
    const type = typeDeclaration(path, name);
    if (!binding && !type && path.scope.hasBinding(name)) return;
    if (!binding && !type) {
      visit(name, scope - 1);
      return;
    }
    if (program.imports.has(name)) {
      program.names.add(name);
      return;
    }
    if (
      binding?.path.isImportSpecifier() ||
      binding?.path.isImportDefaultSpecifier() ||
      binding?.path.isImportNamespaceSpecifier()
    ) {
      program.declarations.add(binding.path.node);
      return;
    }
    const declaration = binding?.path.isVariableDeclarator()
      ? binding.path
      : binding?.path.isFunctionDeclaration() || binding?.path.isClassDeclaration()
        ? binding.path
        : (binding?.path.getStatementParent() ?? type);
    if (!declaration || program.declarations.has(declaration.node)) return;
    program.declarations.add(declaration.node);
    const dependency = (name: string) => {
      if (name !== binding?.identifier.name) visit(name, scope);
    };
    declaration.traverse({
      TSTypeReference(reference) {
        if (
          t.isIdentifier(reference.node.typeName) &&
          (path.scope.getBinding(reference.node.typeName.name) ||
            typeDeclaration(path, reference.node.typeName.name))
        )
          dependency(reference.node.typeName.name);
      },
      ReferencedIdentifier(reference) {
        if (reference.findParent((parent) => parent.isTSType())) return;
        const target = reference.scope.getBinding(reference.node.name);
        if (!target || target.scope === path.scope) dependency(reference.node.name);
      },
    });
  };
  for (const name of [...identifiers, ...componentNames].map((name) => name.split('.')[0]))
    visit(name);
  if (!programs[0].declarations.size) {
    for (const name of programs[0].names) {
      const binding = programs[0].imports.get(name);
      if (binding) programs[1].imports.set(name, binding);
      programs[1].names.add(name);
    }
    programs[0].names.clear();
  }
  const blocks: string[] = [];
  for (const [index, program] of programs.entries()) {
    const declarations = program.ast.program.body.flatMap<t.Statement>((item) => {
      const statement =
        t.isExportNamedDeclaration(item) && item.declaration ? item.declaration : item;
      if (t.isImportDeclaration(statement)) {
        const selected = statement.specifiers.filter((specifier) =>
          program.declarations.has(specifier)
        );
        if (!selected.length) return [];
        const imported = t.cloneNode(statement);
        imported.specifiers = selected;
        return [imported];
      }
      if (t.isVariableDeclaration(statement)) {
        const selected = statement.declarations.filter((declaration) =>
          program.declarations.has(declaration)
        );
        return selected.length ? [t.variableDeclaration(statement.kind, selected)] : [];
      }
      return program.declarations.has(statement) ? [statement] : [];
    });
    const refs = [...program.names].map((name) => resolveComponentImport(name, program.imports));
    const statements = buildImportStatements({
      refs: refs.map((ref) => ({
        ...ref,
        importOverride: componentNames.has(ref.componentName) ? importOverride : undefined,
      })),
    });
    const declarationSource = declarations.map((statement) => babelPrint(statement));
    const lines = [
      ...statements,
      ...(statements.length && declarationSource.length ? [''] : []),
      ...declarationSource,
    ];
    if (lines.length)
      blocks.push(
        `<script${index === 0 && moduleScript && (programs[1].declarations.size || programs[1].names.size) ? ' module' : ''}${declarationSource.length && program.script?.typescript ? ' lang="ts"' : ''}>\n${lines
          .map((line) =>
            line
              .split('\n')
              .map((line) => (line ? '  ' + line : ''))
              .join('\n')
          )
          .join('\n')}\n</script>`
      );
  }
  const refs = [...names].map((name) => resolveComponentImport(name, bindings));
  const statements = buildImportStatements({
    refs: refs.map((ref) => ({
      ...ref,
      importOverride: componentNames.has(ref.componentName) ? importOverride : undefined,
    })),
  });
  if (statements.length) {
    const imports = statements.map((line) => '  ' + line).join('\n');
    const last = blocks.length - 1;
    if (last >= 0 && !blocks[last].startsWith('<script module'))
      blocks[last] = blocks[last].replace(/(<script[^>]*>\n)/, '$1' + imports + '\n\n');
    else blocks.push(`<script>\n${imports}\n</script>`);
  }
  const unresolved = [...componentNames].filter((name) =>
    unresolvedIdentifiers.has(name.split('.')[0])
  );
  for (const name of unresolved) unresolvedIdentifiers.delete(name.split('.')[0]);
  return {
    ...(blocks.length ? { block: blocks.join('\n\n') } : {}),
    unresolved,
    ...(unresolvedIdentifiers.size ? { unresolvedIdentifiers: [...unresolvedIdentifiers] } : {}),
  };
}

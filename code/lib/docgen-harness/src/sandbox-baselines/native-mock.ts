import { parse } from 'svelte/compiler';
import ts from 'typescript';

import { sourceDigest, type StorySource } from './capture/story-source.ts';

export function omitNativeMocks(
  snippet: string,
  evidence: StorySource | undefined,
  sha: string | undefined,
  storyId: string | undefined,
  preserveSeparator = false
): string {
  if (!evidence || evidence.sha !== sha || sourceDigest(evidence.source) !== evidence.digest)
    return snippet;
  try {
    const source = parse(evidence.source, { modern: true });
    const script = source.module;
    if (!script || source.instance) return snippet;
    const file = ts.createSourceFile(
      'story.ts',
      evidence.source
        .slice(script.start, script.end)
        .replace(/^<script\b[^>]*>/, '')
        .replace(/<\/script\s*>$/, ''),
      ts.ScriptTarget.Latest,
      true
    );
    const mocks = new Set<string>();
    const metas = new Set<string>();
    for (const statement of file.statements) {
      if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier))
        continue;
      if (statement.importClause?.isTypeOnly) continue;
      const bindings = statement.importClause?.namedBindings;
      if (!bindings || !ts.isNamedImports(bindings)) continue;
      for (const binding of bindings.elements) {
        if (binding.isTypeOnly) continue;
        const imported = binding.propertyName?.text ?? binding.name.text;
        if (statement.moduleSpecifier.text === 'storybook/test' && imported === 'fn')
          mocks.add(binding.name.text);
        if (
          statement.moduleSpecifier.text === '@storybook/svelte-vite' &&
          imported === 'defineMeta'
        )
          metas.add(binding.name.text);
      }
    }
    const args = new Map<string, boolean>();
    const readArgs = (expression: ts.Expression) => {
      if (!ts.isObjectLiteralExpression(expression)) return false;
      for (const property of expression.properties) {
        if (!ts.isPropertyAssignment(property)) return false;
        const name = property.name;
        if (!ts.isIdentifier(name) && !ts.isStringLiteral(name)) return false;
        let value = property.initializer;
        while (ts.isCallExpression(value) && ts.isPropertyAccessExpression(value.expression))
          value = value.expression.expression;
        args.set(
          name.text,
          ts.isCallExpression(value) &&
            ts.isIdentifier(value.expression) &&
            mocks.has(value.expression.text)
        );
      }
      return true;
    };
    let storyBinding: string | undefined;
    for (const statement of file.statements) {
      if (!ts.isVariableStatement(statement)) continue;
      for (const declaration of statement.declarationList.declarations) {
        const value = declaration.initializer;
        if (
          !value ||
          !ts.isCallExpression(value) ||
          !ts.isIdentifier(value.expression) ||
          !metas.has(value.expression.text) ||
          !ts.isObjectLiteralExpression(value.arguments[0])
        )
          continue;
        if (storyBinding || !ts.isObjectBindingPattern(declaration.name)) return snippet;
        storyBinding = declaration.name.elements
          .find(
            (element) =>
              (element.propertyName?.getText(file) ?? element.name.getText(file)) === 'Story'
          )
          ?.name.getText(file);
        for (const property of value.arguments[0].properties) {
          if (!ts.isPropertyAssignment(property)) return snippet;
          if (property.name.getText(file) === 'args' && !readArgs(property.initializer))
            return snippet;
        }
      }
    }
    const stories = source.fragment.nodes.filter(
      (node): node is Extract<typeof node, { type: 'Component' }> =>
        node.type === 'Component' && node.name === storyBinding
    );
    const story = stories.find((node) =>
      node.attributes.some(
        (attribute) =>
          attribute.type === 'Attribute' &&
          attribute.name === 'name' &&
          Array.isArray(attribute.value) &&
          attribute.value[0]?.type === 'Text' &&
          storyId?.endsWith(
            `--${attribute.value[0].data.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`
          )
      )
    );
    if (!story) return snippet;
    for (const attribute of story.attributes) {
      if (attribute.type === 'SpreadAttribute') return snippet;
      if (attribute.type !== 'Attribute' || attribute.name !== 'args') continue;
      const value = Array.isArray(attribute.value) ? attribute.value[0] : attribute.value;
      if (!value || value === true || value.type !== 'ExpressionTag') return snippet;
      const text = evidence.source.slice(value.start + 1, value.end - 1);
      const parsed = ts.createSourceFile('args.ts', `(${text})`, ts.ScriptTarget.Latest, true);
      const statement = parsed.statements[0];
      if (
        !statement ||
        !ts.isExpressionStatement(statement) ||
        !ts.isParenthesizedExpression(statement.expression) ||
        !readArgs(statement.expression.expression)
      )
        return snippet;
    }
    const ast = parse(snippet, { modern: true });
    const root = ast.fragment.nodes.find((node) => node.type !== 'Text' || node.data.trim());
    if (root?.type !== 'RegularElement') return snippet;
    const removals = root.attributes.filter((attribute) => {
      if (attribute.type !== 'Attribute' || !args.get(attribute.name)) return false;
      const value = Array.isArray(attribute.value) ? attribute.value[0] : attribute.value;
      return (
        value &&
        value !== true &&
        value.type === 'ExpressionTag' &&
        value.expression.type === 'Identifier' &&
        value.expression.name === attribute.name
      );
    });
    for (const attribute of removals.reverse()) {
      const start = preserveSeparator
        ? attribute.start
        : (/\s*$/.exec(snippet.slice(0, attribute.start))?.index ?? attribute.start);
      snippet = snippet.slice(0, start) + snippet.slice(attribute.end);
    }
    return snippet;
  } catch {
    return snippet;
  }
}

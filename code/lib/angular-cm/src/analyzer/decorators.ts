import type * as ts from 'typescript';

import { resolvedSymbol, type AnalyzerContext } from './context.ts';

export interface DecoratorInfo {
  name: string;
  call?: ts.CallExpression;
}

/**
 * Whether `node` resolves to a declaration in `@angular/core`.
 *
 * Unresolvable symbols fall back to bare-name matching rather than losing extraction entirely in
 * projects whose `@angular/core` types are unreachable.
 */
export const isAngularCoreOrUnresolved = (ctx: AnalyzerContext, node: ts.Node): boolean => {
  const symbol = resolvedSymbol(ctx, node);
  return !symbol?.declarations?.length || isDeclaredInAngularCore(symbol);
};

export const isDeclaredInAngularCore = (symbol: ts.Symbol): boolean =>
  symbol.declarations?.some((declaration) =>
    declaration.getSourceFile().fileName.includes('/@angular/core/')
  ) ?? false;

// Angular matches decorators by imported symbol, including aliases re-exported through barrels.
const importedName = (
  ctx: AnalyzerContext,
  target: ts.Identifier | ts.PropertyAccessExpression
): string => {
  const symbol = resolvedSymbol(ctx, target);
  if (symbol?.declarations?.length) {
    return symbol.name;
  }
  if (ctx.ts.isIdentifier(target)) {
    const local = ctx.checker.getSymbolAtLocation(target);
    const specifier = local?.declarations?.find(ctx.ts.isImportSpecifier);
    return specifier?.propertyName?.text ?? target.text;
  }
  return target.name.text;
};

export const getDecorators = (ctx: AnalyzerContext, node: ts.Node): DecoratorInfo[] => {
  const { ts } = ctx;
  if (!ts.canHaveDecorators(node)) {
    return [];
  }
  const decorators: DecoratorInfo[] = [];
  for (const decorator of ts.getDecorators(node) ?? []) {
    const expression = decorator.expression;
    const call = ts.isCallExpression(expression) ? expression : undefined;
    const target = call ? call.expression : expression;
    // A same-named decorator from another package is not Angular's, so the spelling alone cannot
    // decide this.
    if (!isAngularCoreOrUnresolved(ctx, target)) {
      continue;
    }
    const name =
      ts.isIdentifier(target) || ts.isPropertyAccessExpression(target)
        ? importedName(ctx, target)
        : target.getText();
    decorators.push({ name, call });
  }
  return decorators;
};

const objectArgOf = (
  ctx: AnalyzerContext,
  call: ts.CallExpression | undefined
): ts.ObjectLiteralExpression | undefined => {
  const arg = call?.arguments[0];
  return arg && ctx.ts.isObjectLiteralExpression(arg) ? arg : undefined;
};

export const decoratorObjectArg = (
  ctx: AnalyzerContext,
  node: ts.Node,
  name: string
): ts.ObjectLiteralExpression | undefined =>
  objectArgOf(ctx, getDecorators(ctx, node).find((decorator) => decorator.name === name)?.call);

export const decoratorStringArg = (
  ctx: AnalyzerContext,
  decorator: DecoratorInfo
): string | undefined => {
  const arg = decorator.call?.arguments[0];
  return arg && ctx.ts.isStringLiteralLike(arg) ? arg.text : undefined;
};

/** The value of `key`, as the initializer or, for `{ key }`, the identifier `resolveReference` follows. */
export const objectProperty = (
  ctx: AnalyzerContext,
  object: ts.ObjectLiteralExpression,
  key: string
): ts.Expression | undefined => {
  const { ts } = ctx;
  for (const property of object.properties) {
    if (ts.isShorthandPropertyAssignment(property) && property.name.text === key) {
      return property.name;
    }
    if (
      ts.isPropertyAssignment(property) &&
      (ts.isIdentifier(property.name) || ts.isStringLiteralLike(property.name)) &&
      property.name.text === key
    ) {
      return property.initializer;
    }
  }
  return undefined;
};

// Bounds the constant-to-initializer chain, which a self-referencing constant would otherwise loop.
const MAX_REFERENCE_DEPTH = 10;

/**
 * Follow a reference to a constant through to its initializer, as decorator metadata allows.
 *
 * Anything that is not a constant, such as a class, is returned as it is.
 */
export const resolveReference = (
  ctx: AnalyzerContext,
  expression: ts.Expression
): ts.Expression | undefined => {
  const { ts } = ctx;
  let current = unwrap(ctx, expression);
  for (let depth = 0; depth < MAX_REFERENCE_DEPTH; depth++) {
    if (!ts.isIdentifier(current)) {
      return current;
    }
    const symbol = ts.isShorthandPropertyAssignment(current.parent)
      ? ctx.checker.getShorthandAssignmentValueSymbol(current.parent)
      : resolvedSymbol(ctx, current);
    const declaration = symbol?.valueDeclaration;
    if (!declaration || !ts.isVariableDeclaration(declaration)) {
      return current;
    }
    if (!declaration.initializer) {
      return undefined;
    }
    current = unwrap(ctx, declaration.initializer);
  }
  return undefined;
};

// `as const`, `satisfies`, parentheses and `!` change nothing Angular reads.
export const unwrap = (ctx: AnalyzerContext, expression: ts.Expression): ts.Expression => {
  const { ts } = ctx;
  let current = expression;
  while (
    ts.isParenthesizedExpression(current) ||
    ts.isAsExpression(current) ||
    ts.isSatisfiesExpression(current) ||
    ts.isNonNullExpression(current) ||
    ts.isTypeAssertionExpression(current)
  ) {
    current = current.expression;
  }
  return current;
};

export interface BindingName {
  name: string;
  alias?: string;
}

/** Parse Angular's `'name'` / `'name: alias'` binding string, as `inputs`, `outputs` and `hostDirectives` take it. */
export const parseBindingName = (text: string): BindingName | undefined => {
  const [name, alias] = text.split(':').map((part) => part.trim());
  return name ? { name, ...(alias ? { alias } : {}) } : undefined;
};

export const stringOption = (
  ctx: AnalyzerContext,
  object: ts.ObjectLiteralExpression,
  key: string
): string | undefined => {
  const initializer = objectProperty(ctx, object, key);
  return initializer && ctx.ts.isStringLiteralLike(initializer) ? initializer.text : undefined;
};

const booleanOption = (
  ctx: AnalyzerContext,
  object: ts.ObjectLiteralExpression,
  key: string
): boolean | undefined => {
  const initializer = objectProperty(ctx, object, key);
  if (initializer?.kind === ctx.ts.SyntaxKind.TrueKeyword) {
    return true;
  }
  if (initializer?.kind === ctx.ts.SyntaxKind.FalseKeyword) {
    return false;
  }
  // An initializer this cannot evaluate - `required: SOME_CONST`, or the `{ required }` shorthand -
  // is reported as unspecified rather than as `false`, so the caller's own default decides.
  return undefined;
};

interface InputDecoratorConfig {
  alias?: string;
  // The actual boolean value of `@Input({ required })`, not merely whether the key is present.
  required?: boolean;
  transform?: ts.Expression;
}

export const parseInputDecoratorConfig = (
  ctx: AnalyzerContext,
  decorator: DecoratorInfo
): InputDecoratorConfig => {
  const aliasArg = decoratorStringArg(ctx, decorator);
  if (aliasArg !== undefined) {
    return { alias: aliasArg };
  }
  const options = objectArgOf(ctx, decorator.call);
  if (!options) {
    return {};
  }
  const alias = stringOption(ctx, options, 'alias');
  const required = booleanOption(ctx, options, 'required');
  const transform = objectProperty(ctx, options, 'transform');
  return {
    ...(alias === undefined ? {} : { alias }),
    ...(required === undefined ? {} : { required }),
    ...(transform === undefined ? {} : { transform }),
  };
};

export interface MetadataIOEntry {
  bucket: 'inputs' | 'outputs';
  name: string;
  alias?: string;
  required?: boolean;
}

// Angular accepts `'prop'` and `'prop: publicName'` in both arrays, but `{ name, alias, required }`
// objects in `inputs` only.
export const readMetadataInputsOutputs = (
  ctx: AnalyzerContext,
  classNode: ts.ClassLikeDeclaration,
  decoratorName: string
): MetadataIOEntry[] => {
  const { ts } = ctx;
  const metadata = decoratorObjectArg(ctx, classNode, decoratorName);
  if (!metadata) {
    return [];
  }
  const entries: MetadataIOEntry[] = [];
  for (const bucket of ['inputs', 'outputs'] as const) {
    const initializer = objectProperty(ctx, metadata, bucket);
    const list = initializer && resolveReference(ctx, initializer);
    if (!list || !ts.isArrayLiteralExpression(list)) {
      continue;
    }
    for (const listElement of list.elements) {
      const element = resolveReference(ctx, listElement);
      if (!element) {
        continue;
      }
      if (ts.isStringLiteralLike(element)) {
        const binding = parseBindingName(element.text);
        if (binding) {
          entries.push({ bucket, ...binding });
        }
      } else if (bucket === 'inputs' && ts.isObjectLiteralExpression(element)) {
        const name = stringOption(ctx, element, 'name');
        if (!name) {
          continue;
        }
        const alias = stringOption(ctx, element, 'alias');
        const required = booleanOption(ctx, element, 'required');
        entries.push({
          bucket,
          name,
          ...(alias ? { alias } : {}),
          ...(required !== undefined ? { required } : {}),
        });
      }
    }
  }
  return entries;
};

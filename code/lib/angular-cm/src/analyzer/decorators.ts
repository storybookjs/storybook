import type * as ts from 'typescript';

import type { AnalyzerContext } from './context.ts';

export interface DecoratorInfo {
  name: string;
  call?: ts.CallExpression;
}

export const getDecorators = (ctx: AnalyzerContext, node: ts.Node): DecoratorInfo[] => {
  const { ts } = ctx;
  if (!ts.canHaveDecorators(node)) {
    return [];
  }
  return (ts.getDecorators(node) ?? []).map((decorator) => {
    const expression = decorator.expression;
    const call = ts.isCallExpression(expression) ? expression : undefined;
    const target = call ? call.expression : expression;
    const name = ts.isIdentifier(target)
      ? target.text
      : ts.isPropertyAccessExpression(target)
        ? target.name.text
        : target.getText();
    return { name, call };
  });
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

export const objectProperty = (
  ctx: AnalyzerContext,
  object: ts.ObjectLiteralExpression,
  key: string
): ts.Expression | undefined => {
  for (const property of object.properties) {
    if (
      ctx.ts.isPropertyAssignment(property) &&
      ctx.ts.isIdentifier(property.name) &&
      property.name.text === key
    ) {
      return property.initializer;
    }
  }
  return undefined;
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
  return initializer === undefined ? undefined : initializer.kind === ctx.ts.SyntaxKind.TrueKeyword;
};

interface InputDecoratorConfig {
  alias?: string;
  // The actual boolean value of `@Input({ required })`, not merely whether the key is present.
  required?: boolean;
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
  return {
    ...(alias === undefined ? {} : { alias }),
    ...(required === undefined ? {} : { required }),
  };
};

interface MetadataIOEntry {
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
  for (const property of metadata.properties) {
    if (!ts.isPropertyAssignment(property) || !ts.isIdentifier(property.name)) {
      continue;
    }
    const bucket = property.name.text;
    if (
      (bucket !== 'inputs' && bucket !== 'outputs') ||
      !ts.isArrayLiteralExpression(property.initializer)
    ) {
      continue;
    }
    for (const element of property.initializer.elements) {
      if (ts.isStringLiteralLike(element)) {
        const [name, alias] = element.text.split(':').map((part) => part.trim());
        entries.push({ bucket, name, ...(alias ? { alias } : {}) });
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

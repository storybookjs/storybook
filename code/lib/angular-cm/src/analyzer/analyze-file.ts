import { logger } from 'storybook/internal/node-logger';

import type * as tsModule from 'typescript';

import type { Class, Directive, Injectable, Pipe, Property } from '../types.ts';
import type { AngularFileMeta } from '../types.ts';
import { resolvedSymbol, type AnalyzerContext } from './context.ts';
import type { DocumentedClassKind } from './members.ts';
import { collectClassMembers } from './class-members.ts';
import { decoratorObjectArg, getDecorators, objectProperty, stringOption } from './decorators.ts';
import { getJsDocDescription, getJsDocTagsField, hasJsDocTag } from './jsdoc.ts';
import { TypeIndex } from './type-index.ts';

export function analyzeSourceFile(
  ts: typeof tsModule,
  sourceFile: tsModule.SourceFile,
  checker: tsModule.TypeChecker
): AngularFileMeta {
  const types = new TypeIndex(ts, checker);
  const ctx: AnalyzerContext = { ts, checker, types };
  const meta: AngularFileMeta = {
    components: [],
    directives: [],
    pipes: [],
    injectables: [],
    classes: [],
    miscellaneous: { typealiases: [], enumerations: [] },
  };

  for (const statement of sourceFile.statements) {
    if (ts.isEnumDeclaration(statement) || ts.isTypeAliasDeclaration(statement)) {
      types.addDeclaration(statement);
      continue;
    }
    if (!ts.isClassDeclaration(statement) || !statement.name) {
      continue;
    }
    if (hasJsDocTag(ts, statement, 'ignore')) {
      logger.debug(`[angular-cm] ${statement.name.text} left out of docgen: tagged @ignore`);
      continue;
    }
    const kind = classify(ctx, statement);
    if (kind === 'ngmodule') {
      logger.debug(`[angular-cm] ${statement.name.text} left out of docgen: an @NgModule`);
      continue;
    }
    const name = statement.name.text;
    const file = sourceFile.fileName;
    const members = collectClassMembers(ctx, statement, kind);
    const common = {
      file,
      ...getJsDocDescription(ts, statement),
      ...getJsDocTagsField(ts, statement),
    };

    if (kind === 'component' || kind === 'directive') {
      const metadata = decoratorObjectArg(
        ctx,
        statement,
        kind === 'component' ? 'Component' : 'Directive'
      );
      const selector = metadata && decoratorSelector(ctx, metadata);
      const standalone = metadata && decoratorStandalone(ctx, metadata);
      const record: Directive & typeof common & { selector?: string; standalone?: boolean } = {
        name,
        type: kind,
        ...(selector === undefined ? {} : { selector }),
        ...(standalone === undefined ? {} : { standalone }),
        inputsClass: members.inputs,
        outputsClass: members.outputs,
        propertiesClass: members.properties,
        methodsClass: members.methods,
        ...common,
      };
      (kind === 'component' ? meta.components : meta.directives).push(record);
    } else if (kind === 'pipe') {
      const record: Pipe & typeof common = {
        name,
        ngname: pipeName(ctx, statement) ?? name,
        type: 'pipe',
        properties: members.properties,
        methods: members.methods,
        ...common,
      };
      meta.pipes.push(record);
    } else if (kind === 'injectable') {
      const record: Injectable & typeof common = {
        name,
        type: 'injectable',
        properties: members.properties,
        methods: members.methods,
        ...common,
      };
      meta.injectables.push(record);
    } else {
      // A plain class keeps its IO split out too; the extractor ignores the extra arrays.
      const record: Class &
        typeof common & { inputsClass?: Property[]; outputsClass?: Property[] } = {
        name,
        type: 'class',
        properties: members.properties,
        methods: members.methods,
        ...(members.inputs.length ? { inputsClass: members.inputs } : {}),
        ...(members.outputs.length ? { outputsClass: members.outputs } : {}),
        ...common,
      };
      meta.classes.push(record);
    }
  }

  meta.miscellaneous = types.toMiscellaneous();
  return meta;
}

type ClassKind = DocumentedClassKind | 'ngmodule';

const KNOWN_DECORATORS: Record<string, ClassKind> = {
  Component: 'component',
  Directive: 'directive',
  Pipe: 'pipe',
  Injectable: 'injectable',
  NgModule: 'ngmodule',
};

const classify = (ctx: AnalyzerContext, node: tsModule.ClassDeclaration): ClassKind => {
  for (const decorator of getDecorators(ctx, node)) {
    const kind = KNOWN_DECORATORS[decorator.name];
    if (kind) {
      return kind;
    }
  }
  return 'class';
};

const decoratorSelector = (
  ctx: AnalyzerContext,
  metadata: tsModule.ObjectLiteralExpression
): string | undefined => {
  const selector = objectProperty(ctx, metadata, 'selector');
  const value = selector && resolveInitializer(ctx, selector);
  return value && ctx.ts.isStringLiteralLike(value) ? value.text : undefined;
};

const decoratorStandalone = (
  ctx: AnalyzerContext,
  metadata: tsModule.ObjectLiteralExpression
): boolean | undefined => {
  const standalone = objectProperty(ctx, metadata, 'standalone');
  const value = standalone && resolveInitializer(ctx, standalone);
  if (value?.kind === ctx.ts.SyntaxKind.TrueKeyword) {
    return true;
  }
  if (value?.kind === ctx.ts.SyntaxKind.FalseKeyword) {
    return false;
  }
  return undefined;
};

// A reference to a variable resolves to its initializer, a slice of what ngtsc's own partial
// evaluator accepts in decorator metadata.
const resolveInitializer = (
  ctx: AnalyzerContext,
  expression: tsModule.Expression
): tsModule.Expression | undefined => {
  const { ts } = ctx;
  if (!ts.isIdentifier(expression)) {
    return expression;
  }
  const target = resolvedSymbol(ctx, expression);
  const declaration = target?.valueDeclaration;
  return declaration && ts.isVariableDeclaration(declaration) ? declaration.initializer : undefined;
};

const pipeName = (ctx: AnalyzerContext, node: tsModule.ClassDeclaration): string | undefined => {
  const metadata = decoratorObjectArg(ctx, node, 'Pipe');
  return metadata && stringOption(ctx, metadata, 'name');
};

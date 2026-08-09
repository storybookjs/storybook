import type * as tsModule from 'typescript';

import type { Class, Directive, Injectable, Pipe, Property } from '@storybook/angular-compodoc';
import type { AngularFileMeta } from '../types.ts';
import type { AnalyzerContext } from './context.ts';
import { decoratorObjectArg, getDecorators, objectProperty, stringOption } from './decorators.ts';
import { getJsDocDescription, getJsDocTagsField, hasJsDocTag } from './jsdoc.ts';
import { mergeInheritedMembers } from './inheritance.ts';
import { applyMetadataInputsOutputs, sortMembers, visitClassMembers } from './members.ts';
import { MiscCollector } from './misc-collector.ts';

export function analyzeSourceFile(
  ts: typeof tsModule,
  sourceFile: tsModule.SourceFile,
  checker: tsModule.TypeChecker
): AngularFileMeta {
  const misc = new MiscCollector();
  const ctx: AnalyzerContext = { ts, checker, misc };
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
      misc.addDeclaration(ctx, statement);
      continue;
    }
    if (!ts.isClassDeclaration(statement) || !statement.name) {
      continue;
    }
    if (hasJsDocTag(ts, statement, 'ignore')) {
      continue;
    }
    const kind = classify(ctx, statement);
    if (kind === 'ngmodule') {
      continue;
    }
    const name = statement.name.text;
    const file = sourceFile.fileName;
    const members = visitClassMembers(ctx, statement);
    mergeInheritedMembers(ctx, statement, members);
    if (kind === 'component' || kind === 'directive') {
      applyMetadataInputsOutputs(ctx, statement, kind, members);
    }
    sortMembers(members);
    const common = {
      file,
      ...getJsDocDescription(ts, statement),
      ...getJsDocTagsField(ts, statement),
    };

    if (kind === 'component' || kind === 'directive') {
      const selector = decoratorSelector(ctx, statement, kind);
      const record: Directive & typeof common & { selector?: string } = {
        name,
        type: kind,
        ...(selector === undefined ? {} : { selector }),
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

  meta.miscellaneous = misc.toMiscellaneous();
  return meta;
}

type ClassKind = 'component' | 'directive' | 'pipe' | 'injectable' | 'ngmodule' | 'class';

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
  node: tsModule.ClassDeclaration,
  kind: 'component' | 'directive'
): string | undefined => {
  const metadata = decoratorObjectArg(ctx, node, kind === 'component' ? 'Component' : 'Directive');
  const selector = metadata && objectProperty(ctx, metadata, 'selector');
  return selector && selectorText(ctx, selector);
};

const selectorText = (
  ctx: AnalyzerContext,
  expression: tsModule.Expression
): string | undefined => {
  const { ts, checker } = ctx;
  if (ts.isStringLiteralLike(expression)) {
    return expression.text;
  }
  if (!ts.isIdentifier(expression)) {
    return undefined;
  }
  const symbol = checker.getSymbolAtLocation(expression);
  const target =
    symbol && symbol.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(symbol) : symbol;
  const declaration = target?.valueDeclaration;
  if (
    declaration &&
    ts.isVariableDeclaration(declaration) &&
    declaration.initializer &&
    ts.isStringLiteralLike(declaration.initializer)
  ) {
    return declaration.initializer.text;
  }
  return undefined;
};

const pipeName = (ctx: AnalyzerContext, node: tsModule.ClassDeclaration): string | undefined => {
  const metadata = decoratorObjectArg(ctx, node, 'Pipe');
  return metadata && stringOption(ctx, metadata, 'name');
};

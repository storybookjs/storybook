import type * as ts from 'typescript';

import type { Argument, Method, Property } from '@storybook/angular-compodoc';
import type { AnalyzerContext } from './context.ts';
import type { DecoratorInfo } from './decorators.ts';
import {
  decoratorStringArg,
  getDecorators,
  parseInputDecoratorConfig,
  readMetadataInputsOutputs,
} from './decorators.ts';
import { getJsDocDescription, getJsDocTagsField, hasJsDocTag } from './jsdoc.ts';
import { initializerText, memberName } from './node-text.ts';
import { buildSignalEntry, parseSignalCall } from './signals.ts';
import { inferTypeString, renderTypeNode, stripImportQualifiers } from './type-renderer.ts';

export { memberName };

export interface ClassMembers {
  inputs: Property[];
  outputs: Property[];
  properties: Property[];
  methods: Method[];
}

// Compodoc parity: private, protected, static and `#` members and lifecycle hooks all stay in.
export function visitClassMembers(
  ctx: AnalyzerContext,
  classNode: ts.ClassLikeDeclaration
): ClassMembers {
  const { ts } = ctx;
  const members: ClassMembers = { inputs: [], outputs: [], properties: [], methods: [] };
  const visitedAccessors = new Set<string>();

  for (const member of classNode.members) {
    if (hasJsDocTag(ts, member, 'ignore')) {
      continue;
    }
    if (ts.isConstructorDeclaration(member)) {
      visitConstructorProperties(ctx, member, members);
    } else if (ts.isPropertyDeclaration(member)) {
      visitProperty(ctx, member, members);
    } else if (ts.isMethodDeclaration(member)) {
      if (isPreferredMethodDeclaration(ctx, classNode, member)) {
        members.methods.push(visitMethod(ctx, member));
      }
    } else if (ts.isGetAccessor(member) || ts.isSetAccessor(member)) {
      visitAccessorPair(ctx, classNode, member, members, visitedAccessors);
    }
  }
  return members;
}

// Must run after the inheritance merge, so metadata naming an inherited field reclassifies it too.
export function applyMetadataInputsOutputs(
  ctx: AnalyzerContext,
  classNode: ts.ClassLikeDeclaration,
  kind: 'component' | 'directive',
  members: ClassMembers
): void {
  const decoratorName = kind === 'component' ? 'Component' : 'Directive';
  for (const entry of readMetadataInputsOutputs(ctx, classNode, decoratorName)) {
    const index = members.properties.findIndex((property) => property.name === entry.name);
    if (index < 0) {
      continue;
    }
    const [property] = members.properties.splice(index, 1);
    const renamed = { ...property, name: entry.alias ?? property.name };
    if (entry.bucket === 'inputs') {
      members.inputs.push({
        ...renamed,
        ...(entry.required !== undefined
          ? { required: entry.required, optional: !entry.required }
          : {}),
      });
    } else {
      members.outputs.push(renamed);
    }
  }
}

export function sortMembers(members: ClassMembers): void {
  const byName = <T extends { name: string }>(a: T, b: T) => a.name.localeCompare(b.name);
  members.inputs.sort(byName);
  members.outputs.sort(byName);
  members.properties.sort(byName);
  members.methods.sort(byName);
}

const visitProperty = (
  ctx: AnalyzerContext,
  member: ts.PropertyDeclaration,
  members: ClassMembers
): void => {
  const decorators = getDecorators(ctx, member);
  const inputDecorator = decorators.find((decorator) => decorator.name === 'Input');
  if (inputDecorator) {
    members.inputs.push(buildDecoratorInput(ctx, member, inputDecorator));
    return;
  }
  const outputDecorator = decorators.find((decorator) => decorator.name === 'Output');
  if (outputDecorator) {
    members.outputs.push(buildDecoratorOutput(ctx, member, outputDecorator));
    return;
  }
  const signal = parseSignalCall(ctx, member);
  if (signal) {
    const entry = buildSignalEntry(ctx, member, signal);
    if (signal.kind !== 'output') {
      members.inputs.push(entry);
    }
    if (signal.kind !== 'input') {
      // model() lands in BOTH arrays under the same bare name; the extractor keys on that.
      members.outputs.push(entry);
    }
    return;
  }
  members.properties.push(buildPlainProperty(ctx, member, decorators));
};

// Compodoc collapses an arrow default to `() => {...}` only in its plain-property visitor, so
// decorator IO keeps the raw initializer source instead of going through `initializerText`.
const buildDecoratorInput = (
  ctx: AnalyzerContext,
  member: ts.PropertyDeclaration,
  decorator: DecoratorInfo
): Property => {
  const config = parseInputDecoratorConfig(ctx, decorator);
  const type = typeOfPropertyish(ctx, member);
  return {
    name: config.alias ?? memberName(ctx, member.name),
    ...(type === undefined ? {} : { type }),
    optional: config.required !== undefined ? !config.required : !!member.questionToken,
    ...(config.required === undefined ? {} : { required: config.required }),
    ...(member.initializer ? { defaultValue: member.initializer.getText() } : {}),
    ...getJsDocDescription(ctx.ts, member),
    ...getJsDocTagsField(ctx.ts, member),
  };
};

const buildDecoratorOutput = (
  ctx: AnalyzerContext,
  member: ts.PropertyDeclaration,
  decorator: DecoratorInfo
): Property => {
  const type = typeOfPropertyish(ctx, member);
  return {
    name: decoratorStringArg(ctx, decorator) ?? memberName(ctx, member.name),
    ...(type === undefined ? {} : { type }),
    ...(member.initializer ? { defaultValue: member.initializer.getText() } : {}),
    ...getJsDocDescription(ctx.ts, member),
    ...getJsDocTagsField(ctx.ts, member),
  };
};

const buildPlainProperty = (
  ctx: AnalyzerContext,
  member: ts.PropertyDeclaration,
  decorators: DecoratorInfo[]
): Property => {
  const type = typeOfPropertyish(ctx, member);
  const names = decorators.map((decorator) => decorator.name);
  return {
    name: memberName(ctx, member.name),
    ...(type === undefined ? {} : { type }),
    optional: !!member.questionToken,
    ...(member.initializer ? { defaultValue: initializerText(ctx, member.initializer) } : {}),
    ...getJsDocDescription(ctx.ts, member),
    ...getJsDocTagsField(ctx.ts, member),
    ...(names.length ? { decorators: names.map((name) => ({ name })) } : {}),
  };
};

// Overloads produce several same-named MethodDeclarations, of which only the implementation
// signature (the one with a body) is emitted.
const isPreferredMethodDeclaration = (
  ctx: AnalyzerContext,
  classNode: ts.ClassLikeDeclaration,
  member: ts.MethodDeclaration
): boolean => {
  const { ts } = ctx;
  const name = memberName(ctx, member.name);
  const declarations = classNode.members.filter(
    (candidate): candidate is ts.MethodDeclaration =>
      ts.isMethodDeclaration(candidate) && memberName(ctx, candidate.name) === name
  );
  return member === (declarations.find((candidate) => candidate.body) ?? declarations[0]);
};

const visitMethod = (ctx: AnalyzerContext, member: ts.MethodDeclaration): Method => {
  const { ts } = ctx;
  const args: Argument[] = member.parameters
    .filter((parameter) => !ts.isIdentifier(parameter.name) || parameter.name.text !== 'this')
    .map((parameter) => ({
      name: parameter.name.getText(),
      type:
        (parameter.type ? renderTypeNode(ctx, parameter.type) : inferTypeString(ctx, parameter)) ??
        'any',
      optional: !!parameter.questionToken,
    }));
  const returnType =
    (member.type ? renderTypeNode(ctx, member.type) : inferReturnType(ctx, member)) ?? 'void';
  return {
    name: memberName(ctx, member.name),
    args,
    returnType,
    ...getJsDocDescription(ts, member),
    ...getJsDocTagsField(ts, member),
  };
};

const inferReturnType = (
  ctx: AnalyzerContext,
  member: ts.MethodDeclaration
): string | undefined => {
  const signature = ctx.checker.getSignatureFromDeclaration(member);
  if (!signature) {
    return undefined;
  }
  return stripImportQualifiers(
    ctx.checker.typeToString(signature.getReturnType(), member, ctx.ts.TypeFormatFlags.NoTruncation)
  );
};

const visitConstructorProperties = (
  ctx: AnalyzerContext,
  constructor: ts.ConstructorDeclaration,
  members: ClassMembers
): void => {
  const { ts } = ctx;
  for (const parameter of constructor.parameters) {
    // Compodoc 2.x surfaces only parameter properties declared with an explicit `public`, which
    // also keeps the `private readonly` service injections of real projects out of the props table.
    const isPublicParameterProperty = (ts.getModifiers(parameter) ?? []).some(
      (modifier) => modifier.kind === ts.SyntaxKind.PublicKeyword
    );
    if (!isPublicParameterProperty) {
      continue;
    }
    const type = parameter.type
      ? renderTypeNode(ctx, parameter.type)
      : inferTypeString(ctx, parameter);
    members.properties.push({
      name: parameter.name.getText(),
      ...(type === undefined ? {} : { type }),
      optional: !!parameter.questionToken,
      ...(parameter.initializer
        ? { defaultValue: initializerText(ctx, parameter.initializer) }
        : {}),
      ...getJsDocDescription(ts, parameter),
    });
  }
};

const visitAccessorPair = (
  ctx: AnalyzerContext,
  classNode: ts.ClassLikeDeclaration,
  member: ts.GetAccessorDeclaration | ts.SetAccessorDeclaration,
  members: ClassMembers,
  visited: Set<string>
): void => {
  const { ts } = ctx;
  const name = memberName(ctx, member.name);
  if (visited.has(name)) {
    return;
  }
  visited.add(name);
  const getter = classNode.members.find(
    (candidate): candidate is ts.GetAccessorDeclaration =>
      ts.isGetAccessor(candidate) && memberName(ctx, candidate.name) === name
  );
  const setter = classNode.members.find(
    (candidate): candidate is ts.SetAccessorDeclaration =>
      ts.isSetAccessor(candidate) && memberName(ctx, candidate.name) === name
  );
  const typeNode = getter?.type ?? setter?.parameters[0]?.type;
  const type = typeNode ? renderTypeNode(ctx, typeNode) : inferTypeString(ctx, (getter ?? setter)!);
  // The doc comment (and its tags, e.g. `@default`) may sit on either accessor; the getter wins
  // when both carry one.
  const getterDescription = getter ? getJsDocDescription(ts, getter) : {};
  const docSource = getterDescription.rawdescription !== undefined || !setter ? getter : setter;
  const description = docSource === getter ? getterDescription : getJsDocDescription(ts, setter!);
  const tags = docSource ? getJsDocTagsField(ts, docSource) : {};
  const decorators = [
    ...(getter ? getDecorators(ctx, getter) : []),
    ...(setter ? getDecorators(ctx, setter) : []),
  ];
  const inputDecorator = decorators.find((decorator) => decorator.name === 'Input');
  if (inputDecorator) {
    const config = parseInputDecoratorConfig(ctx, inputDecorator);
    members.inputs.push({
      name: config.alias ?? name,
      ...(type === undefined ? {} : { type }),
      optional: config.required !== undefined ? !config.required : false,
      ...(config.required === undefined ? {} : { required: config.required }),
      ...description,
      ...tags,
    });
    return;
  }
  const outputDecorator = decorators.find((decorator) => decorator.name === 'Output');
  if (outputDecorator) {
    members.outputs.push({
      name: decoratorStringArg(ctx, outputDecorator) ?? name,
      ...(type === undefined ? {} : { type }),
      ...description,
      ...tags,
    });
    return;
  }
  // Undecorated non-public accessors are implementation detail (host-binding getters, CVA
  // plumbing); a props-table row for them is noise.
  const nonPublic = [getter, setter].some((accessor) =>
    (accessor ? (ts.getModifiers(accessor) ?? []) : []).some(
      (modifier) =>
        modifier.kind === ts.SyntaxKind.PrivateKeyword ||
        modifier.kind === ts.SyntaxKind.ProtectedKeyword
    )
  );
  if (nonPublic) {
    return;
  }
  members.properties.push({
    name,
    ...(type === undefined ? {} : { type }),
    optional: false,
    ...description,
    ...tags,
  });
};

const typeOfPropertyish = (
  ctx: AnalyzerContext,
  member: ts.PropertyDeclaration
): string | undefined => {
  if (member.type) {
    return renderTypeNode(ctx, member.type);
  }
  if (member.initializer && ctx.ts.isNewExpression(member.initializer)) {
    return member.initializer.expression.getText();
  }
  return inferTypeString(ctx, member);
};

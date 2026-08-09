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

/**
 * A collected member, paired with the identity Angular itself merges on.
 *
 * `value.name` is the public spelling a template binds and the props table shows, which an alias
 * makes differ from the field. Inheritance must key on the field, so that a base's
 * `@Input('label') text` and a child's `@Input() text` are recognised as one member.
 */
export interface MemberEntry<T> {
  declName: string;
  isStatic: boolean;
  value: T;
}

export interface ClassMembers {
  inputs: MemberEntry<Property>[];
  outputs: MemberEntry<Property>[];
  properties: MemberEntry<Property>[];
  methods: MemberEntry<Method>[];
}

export type EmittedMembers = {
  [K in keyof ClassMembers]: ClassMembers[K][number]['value'][];
};

export const memberKey = (entry: MemberEntry<unknown>): string =>
  entry.isStatic ? `static:${entry.declName}` : entry.declName;

/** Drop the collection-only identity, leaving the arrays the compodoc record carries. */
export function emitMembers(members: ClassMembers): EmittedMembers {
  const values = <T>(entries: MemberEntry<T>[]) => entries.map((entry) => entry.value);
  return {
    inputs: values(members.inputs),
    outputs: values(members.outputs),
    properties: values(members.properties),
    methods: values(members.methods),
  };
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
        members.methods.push(entryFor(ctx, member, visitMethod(ctx, member)));
      }
    } else if (ts.isGetAccessor(member) || ts.isSetAccessor(member)) {
      visitAccessorPair(ctx, classNode, member, members, visitedAccessors);
    }
  }
  return members;
}

/**
 * Reclassify the fields named in a `@Component`/`@Directive` `inputs`/`outputs` array.
 *
 * Runs after the inheritance merge so metadata naming an inherited field reclassifies it too, and
 * again per base inside that merge so a base's own metadata is not lost on the way down.
 */
export function applyMetadataInputsOutputs(
  ctx: AnalyzerContext,
  classNode: ts.ClassLikeDeclaration,
  members: ClassMembers
): void {
  for (const decoratorName of ['Component', 'Directive']) {
    for (const entry of readMetadataInputsOutputs(ctx, classNode, decoratorName)) {
      const index = members.properties.findIndex(
        (property) => property.declName === entry.name && !property.isStatic
      );
      if (index < 0) {
        continue;
      }
      const [property] = members.properties.splice(index, 1);
      const renamed = {
        ...property,
        value: { ...property.value, name: entry.alias ?? entry.name },
      };
      if (entry.bucket === 'inputs') {
        members.inputs.push({
          ...renamed,
          value: {
            ...renamed.value,
            ...(entry.required !== undefined
              ? { required: entry.required, optional: !entry.required }
              : {}),
          },
        });
      } else {
        members.outputs.push(renamed);
      }
    }
  }
}

export function sortMembers(members: ClassMembers): void {
  const byName = (a: MemberEntry<{ name: string }>, b: MemberEntry<{ name: string }>) =>
    a.value.name.localeCompare(b.value.name);
  members.inputs.sort(byName);
  members.outputs.sort(byName);
  members.properties.sort(byName);
  members.methods.sort(byName);
}

const entryFor = <T>(
  ctx: AnalyzerContext,
  member: ts.ClassElement & { name: ts.PropertyName },
  value: T
): MemberEntry<T> => ({
  declName: memberName(ctx, member.name),
  isStatic: isStatic(ctx, member),
  value,
});

const visitProperty = (
  ctx: AnalyzerContext,
  member: ts.PropertyDeclaration,
  members: ClassMembers
): void => {
  const decorators = getDecorators(ctx, member);
  const inputDecorator = decorators.find((decorator) => decorator.name === 'Input');
  if (inputDecorator) {
    members.inputs.push(entryFor(ctx, member, buildDecoratorInput(ctx, member, inputDecorator)));
    return;
  }
  const outputDecorator = decorators.find((decorator) => decorator.name === 'Output');
  if (outputDecorator) {
    members.outputs.push(entryFor(ctx, member, buildDecoratorOutput(ctx, member, outputDecorator)));
    return;
  }
  const signal = parseSignalCall(ctx, member);
  if (signal) {
    const entry = entryFor(ctx, member, buildSignalEntry(ctx, member, signal));
    if (signal.kind !== 'output') {
      members.inputs.push(entry);
    }
    if (signal.kind !== 'input') {
      // model() lands in BOTH arrays under the same bare name; the extractor keys on that.
      members.outputs.push(entry);
    }
    return;
  }
  members.properties.push(entryFor(ctx, member, buildPlainProperty(ctx, member, decorators)));
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
    // Always emitted, so a decorator input and the equivalent signal input agree: the consumer
    // reads a missing `required` as true, which would badge `@Input() label = 'x'` as required.
    required: config.required ?? false,
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

const isStatic = (ctx: AnalyzerContext, node: ts.Node): boolean =>
  (ctx.ts.getModifiers(node as ts.HasModifiers) ?? []).some(
    (modifier) => modifier.kind === ctx.ts.SyntaxKind.StaticKeyword
  );

// A static and an instance member may share a name, so neither identifies the other's overloads.
const isSameMember = (
  ctx: AnalyzerContext,
  a: ts.ClassElement,
  b: ts.ClassElement & { name: ts.PropertyName }
): a is ts.ClassElement & { name: ts.PropertyName } =>
  !!a.name &&
  memberName(ctx, a.name as ts.PropertyName) === memberName(ctx, b.name) &&
  isStatic(ctx, a) === isStatic(ctx, b);

// Overloads produce several same-named MethodDeclarations, of which only the implementation
// signature (the one with a body) is emitted.
const isPreferredMethodDeclaration = (
  ctx: AnalyzerContext,
  classNode: ts.ClassLikeDeclaration,
  member: ts.MethodDeclaration
): boolean => {
  const { ts } = ctx;
  const declarations = classNode.members.filter(
    (candidate): candidate is ts.MethodDeclaration =>
      ts.isMethodDeclaration(candidate) && isSameMember(ctx, candidate, member)
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
    // Only parameter properties declare a field, and only publicly visible ones belong in the props
    // table: the `private readonly` service injections of real projects would otherwise fill it.
    const modifiers = (ts.getModifiers(parameter) ?? []).map((modifier) => modifier.kind);
    const declaresField = modifiers.some(
      (kind) =>
        kind === ts.SyntaxKind.PublicKeyword ||
        kind === ts.SyntaxKind.PrivateKeyword ||
        kind === ts.SyntaxKind.ProtectedKeyword ||
        kind === ts.SyntaxKind.ReadonlyKeyword
    );
    const isHidden = modifiers.some(
      (kind) => kind === ts.SyntaxKind.PrivateKeyword || kind === ts.SyntaxKind.ProtectedKeyword
    );
    if (!declaresField || isHidden) {
      continue;
    }
    const type = parameter.type
      ? renderTypeNode(ctx, parameter.type)
      : inferTypeString(ctx, parameter);
    members.properties.push({
      declName: parameter.name.getText(),
      isStatic: false,
      value: {
        name: parameter.name.getText(),
        ...(type === undefined ? {} : { type }),
        optional: !!parameter.questionToken,
        ...(parameter.initializer
          ? { defaultValue: initializerText(ctx, parameter.initializer) }
          : {}),
        ...getJsDocDescription(ts, parameter),
        ...getJsDocTagsField(ts, parameter),
      },
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
  const visitKey = isStatic(ctx, member) ? `static:${name}` : name;
  if (visited.has(visitKey)) {
    return;
  }
  visited.add(visitKey);
  const getter = classNode.members.find(
    (candidate): candidate is ts.GetAccessorDeclaration =>
      ts.isGetAccessor(candidate) && isSameMember(ctx, candidate, member)
  );
  const setter = classNode.members.find(
    (candidate): candidate is ts.SetAccessorDeclaration =>
      ts.isSetAccessor(candidate) && isSameMember(ctx, candidate, member)
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
  const accessorEntry = <T>(value: T): MemberEntry<T> => ({
    declName: name,
    isStatic: isStatic(ctx, member),
    value,
  });
  const inputDecorator = decorators.find((decorator) => decorator.name === 'Input');
  if (inputDecorator) {
    const config = parseInputDecoratorConfig(ctx, inputDecorator);
    members.inputs.push(
      accessorEntry({
        name: config.alias ?? name,
        ...(type === undefined ? {} : { type }),
        optional: config.required !== undefined ? !config.required : false,
        required: config.required ?? false,
        ...description,
        ...tags,
      })
    );
    return;
  }
  const outputDecorator = decorators.find((decorator) => decorator.name === 'Output');
  if (outputDecorator) {
    members.outputs.push(
      accessorEntry({
        name: decoratorStringArg(ctx, outputDecorator) ?? name,
        ...(type === undefined ? {} : { type }),
        ...description,
        ...tags,
      })
    );
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
  members.properties.push(
    accessorEntry({
      name,
      ...(type === undefined ? {} : { type }),
      optional: false,
      ...description,
      ...tags,
      // The props table routes the view-child and content-child sections off this field, so an
      // accessor-declared query must carry it exactly as a property-declared one does.
      ...(decorators.length
        ? { decorators: decorators.map((decorator) => ({ name: decorator.name })) }
        : {}),
    })
  );
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

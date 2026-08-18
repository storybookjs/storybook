import { logger } from 'storybook/internal/node-logger';

import type * as ts from 'typescript';

import type { Argument, Method, Property } from '../types.ts';
import type { AnalyzerContext } from './context.ts';
import type { DecoratorInfo } from './decorators.ts';
import {
  decoratorStringArg,
  getDecorators,
  parseInputDecoratorConfig,
  readMetadataInputsOutputs,
} from './decorators.ts';
import { defaultInitializer } from './default-initializer.ts';
import { analyzeInputTransform, type InputTransformSource } from './input-transform.ts';
import { getJsDocDescription, getJsDocTagsField, hasJsDocTag } from './jsdoc.ts';
import { memberName } from './node-text.ts';
import { buildSignalEntry, parseSignalCall } from './signals.ts';

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
  declaration: ts.NamedDeclaration;
  /** A metadata type the class property's checker type does not represent. */
  typeSource?: { kind: 'signal'; signalKind: 'input' | 'output' | 'model' } | InputTransformSource;
  value: T;
}

export interface ClassMembers {
  inputs: MemberEntry<Property>[];
  outputs: MemberEntry<Property>[];
  properties: MemberEntry<Property>[];
  methods: MemberEntry<Method>[];
}

export const sameMemberIdentity = (
  left: MemberEntry<unknown>,
  right: MemberEntry<unknown>
): boolean => left.declName === right.declName && left.isStatic === right.isStatic;

const owningClassName = (node: ts.Node): string => {
  let candidate: ts.Node | undefined = node.parent;
  while (candidate && !('members' in candidate)) {
    candidate = candidate.parent;
  }
  return (candidate as ts.ClassLikeDeclaration | undefined)?.name?.text ?? 'an anonymous class';
};

/**
 * Record a member the analyzer deliberately leaves out.
 *
 * "Why is this prop missing from the table" is the question this package gets asked, and every
 * other answer to it requires reading the source.
 */
const dropped = (node: ts.Node, name: string, reason: string): void => {
  logger.debug(`[angular-cm] ${owningClassName(node)}.${name} left out of docgen: ${reason}`);
};

/** What a class is to Angular, which decides whether its statics can document anything. */
export type DocumentedClassKind = 'component' | 'directive' | 'pipe' | 'injectable' | 'class';

const ANGULAR_GENERATED_STATIC = /^(ngAcceptInputType_|ɵ)/;

// Private, protected and `#` members and lifecycle hooks all stay in; filtering them is the
// extractor's decision, not this visitor's. Statics are the exception, and only for a component or
// directive: Angular binds and coerces instance members alone, so a static there is either an
// `ngAcceptInputType_*`/`ɵ*` internal or a field no template can reach. A service or plain class
// documents its own statics, and only the generated ones are noise.
export function visitClassMembers(
  ctx: AnalyzerContext,
  classNode: ts.ClassLikeDeclaration,
  kind: DocumentedClassKind
): ClassMembers {
  const { ts } = ctx;
  const members: ClassMembers = { inputs: [], outputs: [], properties: [], methods: [] };
  const visitedAccessors = new Set<ts.AccessorDeclaration>();

  for (const member of classNode.members) {
    if (hasJsDocTag(ts, member, 'ignore')) {
      dropped(member, member.name ? memberName(ts, member.name) : '<unnamed>', 'tagged @ignore');
      continue;
    }
    if (isStatic(ctx, member)) {
      const staticName = member.name ? memberName(ts, member.name) : '<unnamed>';
      const bindsTemplateMembers = kind === 'component' || kind === 'directive';
      if (bindsTemplateMembers || ANGULAR_GENERATED_STATIC.test(staticName)) {
        dropped(member, staticName, 'a static member');
        continue;
      }
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

const entryFor = <T>(
  ctx: AnalyzerContext,
  member: ts.ClassElement & { name: ts.PropertyName },
  value: T,
  typeSource?: MemberEntry<T>['typeSource']
): MemberEntry<T> => ({
  declName: memberName(ctx.ts, member.name),
  isStatic: isStatic(ctx, member),
  declaration: member,
  ...(typeSource ? { typeSource } : {}),
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
    const input = buildDecoratorInput(ctx, member, inputDecorator);
    members.inputs.push(entryFor(ctx, member, input.value, input.typeSource));
    return;
  }
  const outputDecorator = decorators.find((decorator) => decorator.name === 'Output');
  if (outputDecorator) {
    members.outputs.push(entryFor(ctx, member, buildDecoratorOutput(ctx, member, outputDecorator)));
    return;
  }
  const signal = parseSignalCall(ctx, member);
  if (signal) {
    const entry = entryFor(
      ctx,
      member,
      {
        ...buildSignalEntry(ctx, member, signal),
        ...memberApiFields(ctx, member),
      },
      { kind: 'signal', signalKind: signal.kind }
    );
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

const buildDecoratorInput = (
  ctx: AnalyzerContext,
  member: ts.PropertyDeclaration,
  decorator: DecoratorInfo
): { value: Property; typeSource?: MemberEntry<Property>['typeSource'] } => {
  const config = parseInputDecoratorConfig(ctx, decorator);
  const transform = config.transform ? analyzeInputTransform(ctx, config.transform) : undefined;
  const type = transform?.type ?? typeOfPropertyish(ctx, member);
  return {
    value: {
      name: config.alias ?? memberName(ctx.ts, member.name),
      ...(type === undefined ? {} : { type }),
      optional: config.required !== undefined ? !config.required : !!member.questionToken,
      ...(config.required === undefined ? {} : { required: config.required }),
      ...(member.initializer ? { initializer: defaultInitializer(ctx, member.initializer) } : {}),
      ...memberApiFields(ctx, member),
      ...getJsDocDescription(ctx.ts, member),
      ...getJsDocTagsField(ctx.ts, member),
    },
    ...(transform ? { typeSource: transform.source } : {}),
  };
};

const buildDecoratorOutput = (
  ctx: AnalyzerContext,
  member: ts.PropertyDeclaration,
  decorator: DecoratorInfo
): Property => {
  const type = typeOfPropertyish(ctx, member);
  return {
    name: decoratorStringArg(ctx, decorator) ?? memberName(ctx.ts, member.name),
    ...(type === undefined ? {} : { type }),
    ...(member.initializer ? { initializer: defaultInitializer(ctx, member.initializer) } : {}),
    ...memberApiFields(ctx, member),
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
    name: memberName(ctx.ts, member.name),
    ...(type === undefined ? {} : { type }),
    optional: !!member.questionToken,
    ...(member.initializer ? { initializer: defaultInitializer(ctx, member.initializer) } : {}),
    ...memberApiFields(ctx, member),
    ...getJsDocDescription(ctx.ts, member),
    ...getJsDocTagsField(ctx.ts, member),
    ...(names.length ? { decorators: names.map((name) => ({ name })) } : {}),
  };
};

const accessibilityOf = (
  ctx: AnalyzerContext,
  node: ts.Node
): 'private' | 'protected' | undefined => {
  for (const modifier of ctx.ts.getModifiers(node as ts.HasModifiers) ?? []) {
    if (modifier.kind === ctx.ts.SyntaxKind.PrivateKeyword) {
      return 'private';
    }
    if (modifier.kind === ctx.ts.SyntaxKind.ProtectedKeyword) {
      return 'protected';
    }
  }
  return undefined;
};

// Several declarations for an accessor pair, whose modifiers and doc comment may sit on either half.
const memberApiFields = (
  ctx: AnalyzerContext,
  ...nodes: (ts.Node | undefined)[]
): Pick<Property, 'visibility' | 'internal'> => {
  const declared = nodes.filter((node): node is ts.Node => node !== undefined);
  const visibility = declared.map((node) => accessibilityOf(ctx, node)).find(Boolean);
  return {
    ...(visibility === undefined ? {} : { visibility }),
    ...(declared.some((node) => hasJsDocTag(ctx.ts, node, 'internal')) ? { internal: true } : {}),
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
  memberName(ctx.ts, a.name as ts.PropertyName) === memberName(ctx.ts, b.name) &&
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
        (parameter.type ? ctx.types.render(parameter.type) : ctx.types.infer(parameter)) ?? 'any',
      optional: !!parameter.questionToken,
    }));
  const returnType =
    (member.type ? ctx.types.render(member.type) : inferReturnType(ctx, member)) ?? 'void';
  return {
    name: memberName(ctx.ts, member.name),
    args,
    returnType,
    ...memberApiFields(ctx, member),
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
  return ctx.types.renderCheckerType(signature.getReturnType(), member);
};

const visitConstructorProperties = (
  ctx: AnalyzerContext,
  constructor: ts.ConstructorDeclaration,
  members: ClassMembers
): void => {
  const { ts } = ctx;
  for (const parameter of constructor.parameters) {
    // Only parameter properties declare a field; a plain parameter is no member at all.
    const declaresField = (ts.getModifiers(parameter) ?? []).some(
      (modifier) =>
        modifier.kind === ts.SyntaxKind.PublicKeyword ||
        modifier.kind === ts.SyntaxKind.PrivateKeyword ||
        modifier.kind === ts.SyntaxKind.ProtectedKeyword ||
        modifier.kind === ts.SyntaxKind.ReadonlyKeyword
    );
    if (!declaresField) {
      continue;
    }
    const type = parameter.type ? ctx.types.render(parameter.type) : ctx.types.infer(parameter);
    members.properties.push({
      declName: parameter.name.getText(),
      isStatic: false,
      declaration: parameter,
      value: {
        name: parameter.name.getText(),
        ...(type === undefined ? {} : { type }),
        optional: !!parameter.questionToken,
        ...(parameter.initializer
          ? { initializer: defaultInitializer(ctx, parameter.initializer) }
          : {}),
        ...memberApiFields(ctx, parameter),
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
  visited: Set<ts.AccessorDeclaration>
): void => {
  const { ts } = ctx;
  const name = memberName(ctx.ts, member.name);
  if (visited.has(member)) {
    return;
  }
  const getter = classNode.members.find(
    (candidate): candidate is ts.GetAccessorDeclaration =>
      ts.isGetAccessor(candidate) && isSameMember(ctx, candidate, member)
  );
  const setter = classNode.members.find(
    (candidate): candidate is ts.SetAccessorDeclaration =>
      ts.isSetAccessor(candidate) && isSameMember(ctx, candidate, member)
  );
  if (getter) {
    visited.add(getter);
  }
  if (setter) {
    visited.add(setter);
  }
  const typeNode = getter?.type ?? setter?.parameters[0]?.type;
  const type = typeNode ? ctx.types.render(typeNode) : ctx.types.infer((getter ?? setter)!);
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
  const apiFields = memberApiFields(ctx, getter, setter);
  const declaration = (getter ?? setter)!;
  const accessorEntry = <T>(
    value: T,
    typeSource?: MemberEntry<T>['typeSource']
  ): MemberEntry<T> => ({
    declName: name,
    isStatic: isStatic(ctx, declaration),
    declaration,
    ...(typeSource ? { typeSource } : {}),
    value,
  });
  const inputDecorator = decorators.find((decorator) => decorator.name === 'Input');
  if (inputDecorator) {
    const config = parseInputDecoratorConfig(ctx, inputDecorator);
    const transform = config.transform ? analyzeInputTransform(ctx, config.transform) : undefined;
    const inputType = transform?.type ?? type;
    members.inputs.push(
      accessorEntry(
        {
          name: config.alias ?? name,
          ...(inputType === undefined ? {} : { type: inputType }),
          optional: config.required !== undefined ? !config.required : false,
          ...(config.required === undefined ? {} : { required: config.required }),
          ...apiFields,
          ...description,
          ...tags,
        },
        transform?.source
      )
    );
    return;
  }
  const outputDecorator = decorators.find((decorator) => decorator.name === 'Output');
  if (outputDecorator) {
    members.outputs.push(
      accessorEntry({
        name: decoratorStringArg(ctx, outputDecorator) ?? name,
        ...(type === undefined ? {} : { type }),
        ...apiFields,
        ...description,
        ...tags,
      })
    );
    return;
  }
  members.properties.push(
    accessorEntry({
      name,
      ...(type === undefined ? {} : { type }),
      optional: false,
      ...apiFields,
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
    return ctx.types.render(member.type);
  }
  if (member.initializer && ctx.ts.isNewExpression(member.initializer)) {
    return member.initializer.expression.getText();
  }
  return ctx.types.infer(member);
};

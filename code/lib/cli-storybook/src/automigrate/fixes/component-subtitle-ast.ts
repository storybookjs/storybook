import { traverse, types as t } from 'storybook/internal/babel';

import type { Expression, ObjectExpression } from '@babel/types';
import type { Scope } from '@babel/traverse';

import {
  findSpreadProperty,
  findUnresolvedComputedProperty,
  getObjectPropertyValue,
  getStaticProperties,
  getStaticPropertyName,
} from '../helpers/config-object.ts';

export class ComponentSubtitleMigrationError extends Error {}

export type CandidateClassification = 'none' | 'direct' | 'unsafe';

const staticTruthiness = (value: Expression): boolean | undefined => {
  if (t.isStringLiteral(value) || t.isNumericLiteral(value) || t.isBooleanLiteral(value)) {
    return Boolean(value.value);
  }
  if (t.isNullLiteral(value)) {
    return false;
  }
  if (t.isTemplateLiteral(value) && value.expressions.length === 0) {
    return Boolean(value.quasis[0]?.value.cooked);
  }
  return undefined;
};

const isPureLiteral = (value: Expression) =>
  t.isStringLiteral(value) ||
  t.isNumericLiteral(value) ||
  t.isBooleanLiteral(value) ||
  t.isNullLiteral(value) ||
  t.isBigIntLiteral(value) ||
  t.isRegExpLiteral(value) ||
  (t.isTemplateLiteral(value) && value.expressions.length === 0);

export const hasSpreadProperty = (object: ObjectExpression) => Boolean(findSpreadProperty(object));

const hasUnresolvedComputedProperty = (object: ObjectExpression) =>
  Boolean(findUnresolvedComputedProperty(object));

export const localSubtitleTruthiness = (parameters: ObjectExpression): boolean | undefined => {
  if (hasSpreadProperty(parameters) || hasUnresolvedComputedProperty(parameters)) {
    return undefined;
  }
  const docsMembers = getStaticProperties(parameters, 'docs');
  if (docsMembers.length === 0) {
    return false;
  }
  if (
    docsMembers.length !== 1 ||
    !t.isObjectProperty(docsMembers[0]) ||
    !t.isObjectExpression(docsMembers[0].value)
  ) {
    return undefined;
  }
  const docs = docsMembers[0].value;
  if (hasSpreadProperty(docs) || hasUnresolvedComputedProperty(docs)) {
    return undefined;
  }
  const subtitleMembers = getStaticProperties(docs, 'subtitle');
  if (subtitleMembers.length === 0) {
    return false;
  }
  if (
    subtitleMembers.length !== 1 ||
    !t.isObjectProperty(subtitleMembers[0]) ||
    !t.isExpression(subtitleMembers[0].value)
  ) {
    return undefined;
  }
  return staticTruthiness(subtitleMembers[0].value);
};

export const migrateParameters = (
  parameters: ObjectExpression,
  inheritedSubtitleCanWin = false
) => {
  const legacyMembers = getStaticProperties(parameters, 'componentSubtitle');
  if (legacyMembers.length === 0) {
    return false;
  }
  if (legacyMembers.length !== 1 || findSpreadProperty(parameters)) {
    throw new ComponentSubtitleMigrationError(
      'parameters.componentSubtitle is declared in an ambiguous parameters object'
    );
  }

  const legacyProperty = legacyMembers[0];
  if (!t.isObjectProperty(legacyProperty)) {
    throw new ComponentSubtitleMigrationError(
      'parameters.componentSubtitle does not have a movable value'
    );
  }

  const docsMembers = getStaticProperties(parameters, 'docs');
  if (docsMembers.length > 1) {
    throw new ComponentSubtitleMigrationError('parameters.docs is declared more than once');
  }

  const legacyValue = getObjectPropertyValue(legacyProperty);
  if (!legacyValue) {
    throw new ComponentSubtitleMigrationError(
      'parameters.componentSubtitle does not have a movable value'
    );
  }
  const docsProperty = docsMembers[0];
  if (!docsProperty) {
    if (inheritedSubtitleCanWin) {
      throw new ComponentSubtitleMigrationError(
        'an inherited parameters.docs.subtitle value can take precedence'
      );
    }
    legacyProperty.key = t.identifier('docs');
    legacyProperty.computed = false;
    legacyProperty.value = t.objectExpression([
      t.objectProperty(t.identifier('subtitle'), legacyValue),
    ]);
    return true;
  }
  if (!t.isObjectProperty(docsProperty) || !t.isObjectExpression(docsProperty.value)) {
    throw new ComponentSubtitleMigrationError('parameters.docs is not an object literal');
  }
  if (!isPureLiteral(legacyValue)) {
    throw new ComponentSubtitleMigrationError(
      'parameters.componentSubtitle has an expression whose evaluation cannot be moved safely'
    );
  }
  if (findSpreadProperty(docsProperty.value)) {
    throw new ComponentSubtitleMigrationError('parameters.docs contains a spread property');
  }
  if (hasUnresolvedComputedProperty(docsProperty.value)) {
    throw new ComponentSubtitleMigrationError(
      'parameters.docs contains an unresolved computed property'
    );
  }

  const subtitleMembers = getStaticProperties(docsProperty.value, 'subtitle');
  if (subtitleMembers.length > 1) {
    throw new ComponentSubtitleMigrationError(
      'parameters.docs.subtitle is declared more than once'
    );
  }
  const subtitleProperty = subtitleMembers[0];
  if (!subtitleProperty) {
    if (inheritedSubtitleCanWin) {
      throw new ComponentSubtitleMigrationError(
        'an inherited parameters.docs.subtitle value can take precedence'
      );
    }
    docsProperty.value.properties.push(t.objectProperty(t.identifier('subtitle'), legacyValue));
  } else {
    const subtitleValue = getObjectPropertyValue(subtitleProperty);
    if (!t.isObjectProperty(subtitleProperty) || !subtitleValue) {
      throw new ComponentSubtitleMigrationError(
        'parameters.docs.subtitle does not have a supported value'
      );
    }
    const truthiness = staticTruthiness(subtitleValue);
    if (truthiness === undefined) {
      throw new ComponentSubtitleMigrationError('parameters.docs.subtitle has dynamic truthiness');
    }
    if (!truthiness) {
      subtitleProperty.value = legacyValue;
    }
  }

  parameters.properties.splice(parameters.properties.indexOf(legacyProperty), 1);
  return true;
};

const resolveNode = (value: t.Node, scope: Scope, seenBindings = new Set<t.Node>()) => {
  let current: t.Node | null | undefined = value;
  let currentScope = scope;

  while (current) {
    while (t.isTSAsExpression(current) || t.isTSSatisfiesExpression(current)) {
      current = current.expression;
    }
    if (t.isVariableDeclarator(current)) {
      current = current.init;
      continue;
    }
    if (!t.isIdentifier(current)) {
      break;
    }
    const binding = currentScope.getBinding(current.name);
    if (!binding || seenBindings.has(binding.path.node)) {
      break;
    }
    seenBindings.add(binding.path.node);
    current = binding.path.node;
    currentScope = binding.path.scope;
  }

  return current ?? undefined;
};

export const resolveObjectExpression = (value: t.Node, scope: Scope) => {
  const resolved = resolveNode(value, scope);
  return t.isObjectExpression(resolved) ? resolved : undefined;
};

const mergeClassification = (
  current: CandidateClassification,
  next: CandidateClassification
): CandidateClassification => {
  if (current === 'unsafe' || next === 'unsafe') {
    return 'unsafe';
  }
  return current === 'direct' || next === 'direct' ? 'direct' : 'none';
};

const containsClassifiedObject = (
  value: t.Node,
  scope: Scope,
  classifyObject: (
    object: ObjectExpression,
    scope: Scope,
    seen: Set<t.Node>
  ) => CandidateClassification,
  seenNodes = new Set<t.Node>(),
  seenObjects = new Set<t.Node>(),
  seenBindings = new Set<t.Node>()
): boolean => {
  const resolved = resolveNode(value, scope, seenBindings);
  if (!resolved || seenNodes.has(resolved)) {
    return false;
  }
  seenNodes.add(resolved);

  if (t.isObjectExpression(resolved)) {
    return classifyObject(resolved, scope, seenObjects) !== 'none';
  }

  const keys =
    t.isCallExpression(resolved) || t.isNewExpression(resolved)
      ? ['arguments']
      : (t.VISITOR_KEYS[resolved.type] ?? []);
  for (const key of keys) {
    const children = resolved[key as keyof typeof resolved];
    const nodes = Array.isArray(children) ? children : [children];
    if (
      nodes.some(
        (child) =>
          t.isNode(child) &&
          containsClassifiedObject(
            child,
            scope,
            classifyObject,
            seenNodes,
            seenObjects,
            seenBindings
          )
      )
    ) {
      return true;
    }
  }
  return false;
};

const containsParametersCandidate = (value: t.Node, scope: Scope) =>
  containsClassifiedObject(value, scope, classifyParameters);

const containsStoryObjectCandidate = (value: t.Node, scope: Scope) =>
  containsClassifiedObject(value, scope, classifyStoryObject);

const classifyParameters = (
  parameters: ObjectExpression,
  scope: Scope,
  seen = new Set<t.Node>()
): CandidateClassification => {
  if (seen.has(parameters)) {
    return 'none';
  }
  seen.add(parameters);

  const legacyMembers = getStaticProperties(parameters, 'componentSubtitle');
  if (legacyMembers.some((member) => t.isObjectMethod(member))) {
    return 'unsafe';
  }

  let classification: CandidateClassification = legacyMembers.length > 0 ? 'direct' : 'none';
  const computedMembers = parameters.properties.filter(
    (member) =>
      !t.isSpreadElement(member) && member.computed && getStaticPropertyName(member) === undefined
  );
  if (
    (classification !== 'none' && computedMembers.length > 0) ||
    computedMembers.some((member) => containsParametersCandidate(member, scope))
  ) {
    classification = 'unsafe';
  }
  for (const property of parameters.properties) {
    if (!t.isSpreadElement(property)) {
      continue;
    }
    const spreadObject = resolveObjectExpression(property.argument, scope);
    if (
      (spreadObject && classifyParameters(spreadObject, scope, seen) !== 'none') ||
      (!spreadObject && containsParametersCandidate(property.argument, scope))
    ) {
      classification = 'unsafe';
    }
  }
  return classification;
};

export const classifyStoryObject = (
  storyObject: ObjectExpression,
  scope: Scope,
  seen = new Set<t.Node>()
): CandidateClassification => {
  if (seen.has(storyObject)) {
    return 'none';
  }
  seen.add(storyObject);

  let classification: CandidateClassification = 'none';
  for (const parametersMember of getStaticProperties(storyObject, 'parameters')) {
    if (!t.isObjectProperty(parametersMember)) {
      if (containsParametersCandidate(parametersMember, scope)) {
        return 'unsafe';
      }
      continue;
    }
    const parameters = resolveObjectExpression(parametersMember.value, scope);
    if (!parameters) {
      if (containsParametersCandidate(parametersMember.value, scope)) {
        return 'unsafe';
      }
      continue;
    }
    const parametersClassification = classifyParameters(parameters, scope);
    classification = mergeClassification(
      classification,
      t.isObjectExpression(parametersMember.value) || parametersClassification === 'none'
        ? parametersClassification
        : 'unsafe'
    );
  }

  if (
    storyObject.properties.some(
      (member) =>
        !t.isSpreadElement(member) &&
        member.computed &&
        getStaticPropertyName(member) === undefined &&
        containsParametersCandidate(member, scope)
    )
  ) {
    classification = 'unsafe';
  }

  for (const property of storyObject.properties) {
    if (!t.isSpreadElement(property)) {
      continue;
    }
    const spreadObject = resolveObjectExpression(property.argument, scope);
    if (
      (spreadObject && classifyStoryObject(spreadObject, scope, seen) !== 'none') ||
      (!spreadObject && containsStoryObjectCandidate(property.argument, scope))
    ) {
      classification = 'unsafe';
    }
  }
  return classification;
};

export const resolvePreviewObjectExpression = (value: t.Node, scope: Scope) => {
  const resolved = resolveNode(value, scope);
  if (t.isObjectExpression(resolved)) {
    return resolved;
  }
  if (t.isCallExpression(resolved)) {
    const firstArgument = resolved.arguments[0];
    if (firstArgument && t.isExpression(firstArgument)) {
      return resolveObjectExpression(firstArgument, scope);
    }
  }
  return undefined;
};

export const classifyDefaultExport = (ast: t.Node): CandidateClassification => {
  let classification: CandidateClassification = 'none';
  traverse(ast, {
    ExportDefaultDeclaration(path) {
      const object = resolvePreviewObjectExpression(path.node.declaration, path.scope);
      if (object) {
        classification = mergeClassification(
          classification,
          classifyStoryObject(object, path.scope)
        );
      }
    },
  });
  return classification;
};

import { readFile, writeFile } from 'node:fs/promises';

import { traverse, types as t } from 'storybook/internal/babel';
import { formatConfig, loadConfig, loadCsf, printCsf } from 'storybook/internal/csf-tools';

import type { Expression, ObjectExpression, ObjectMethod, ObjectProperty } from '@babel/types';
import type { Scope } from '@babel/traverse';
import picocolors from 'picocolors';

import { getObjectProperty, getStoryObject } from '../helpers/ast-utils.ts';
import type { Fix } from '../types.ts';

interface ComponentSubtitleOptions {
  files: string[];
  previewConfigPath?: string;
}

class ComponentSubtitleMigrationError extends Error {}

type ObjectMember = ObjectMethod | ObjectProperty;
type CandidateClassification = 'none' | 'direct' | 'unsafe';

const propertyName = (property: ObjectMember) => {
  if (property.computed) {
    if (t.isStringLiteral(property.key)) {
      return property.key.value;
    }
    if (t.isTemplateLiteral(property.key) && property.key.expressions.length === 0) {
      return property.key.quasis[0]?.value.cooked;
    }
    return undefined;
  }
  if (t.isIdentifier(property.key)) {
    return property.key.name;
  }
  if (t.isStringLiteral(property.key)) {
    return property.key.value;
  }
  return undefined;
};

const namedMembers = (object: ObjectExpression, name: string) =>
  object.properties.filter(
    (property): property is ObjectMember =>
      (t.isObjectProperty(property) || t.isObjectMethod(property)) &&
      propertyName(property) === name
  );

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

const localSubtitleTruthiness = (parameters: ObjectExpression): boolean | undefined => {
  if (hasSpreadProperty(parameters) || hasUnresolvedComputedProperty(parameters)) {
    return undefined;
  }
  const docsMembers = namedMembers(parameters, 'docs');
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
  const subtitleMembers = namedMembers(docs, 'subtitle');
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

const migrateParameters = (parameters: ObjectExpression, inheritedSubtitleCanWin = false) => {
  const legacyMembers = namedMembers(parameters, 'componentSubtitle');
  if (legacyMembers.length === 0) {
    return false;
  }
  if (
    legacyMembers.length !== 1 ||
    parameters.properties.some((property) => t.isSpreadElement(property))
  ) {
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

  const docsMembers = namedMembers(parameters, 'docs');
  if (docsMembers.length > 1) {
    throw new ComponentSubtitleMigrationError('parameters.docs is declared more than once');
  }

  const legacyValue = legacyProperty.value;
  if (!t.isExpression(legacyValue)) {
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
  if (docsProperty.value.properties.some((property) => t.isSpreadElement(property))) {
    throw new ComponentSubtitleMigrationError('parameters.docs contains a spread property');
  }

  if (hasUnresolvedComputedProperty(docsProperty.value)) {
    throw new ComponentSubtitleMigrationError(
      'parameters.docs contains an unresolved computed property'
    );
  }

  const subtitleMembers = namedMembers(docsProperty.value, 'subtitle');
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
    if (!t.isObjectProperty(subtitleProperty) || !t.isExpression(subtitleProperty.value)) {
      throw new ComponentSubtitleMigrationError(
        'parameters.docs.subtitle does not have a supported value'
      );
    }
    const truthiness = staticTruthiness(subtitleProperty.value);
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

const resolveObjectExpression = (value: t.Node, scope: Scope) => {
  const resolved = resolveNode(value, scope);
  return t.isObjectExpression(resolved) ? resolved : undefined;
};

const unresolvedComputedMembers = (object: ObjectExpression) =>
  object.properties.filter(
    (property): property is ObjectMember =>
      (t.isObjectProperty(property) || t.isObjectMethod(property)) &&
      property.computed &&
      propertyName(property) === undefined
  );

const hasUnresolvedComputedProperty = (object: ObjectExpression) =>
  unresolvedComputedMembers(object).length > 0;

const hasSpreadProperty = (object: ObjectExpression) =>
  object.properties.some((property) => t.isSpreadElement(property));

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

  const legacyMembers = namedMembers(parameters, 'componentSubtitle');
  if (legacyMembers.some((member) => t.isObjectMethod(member))) {
    return 'unsafe';
  }

  let classification: CandidateClassification = legacyMembers.length > 0 ? 'direct' : 'none';
  const computedMembers = unresolvedComputedMembers(parameters);
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

const classifyStoryObject = (
  storyObject: ObjectExpression,
  scope: Scope,
  seen = new Set<t.Node>()
): CandidateClassification => {
  if (seen.has(storyObject)) {
    return 'none';
  }
  seen.add(storyObject);

  let classification: CandidateClassification = 'none';
  for (const parametersMember of namedMembers(storyObject, 'parameters')) {
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
    unresolvedComputedMembers(storyObject).some((member) =>
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

const resolvePreviewObjectExpression = (value: t.Node, scope: Scope) => {
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

const classifyDefaultExport = (ast: t.Node): CandidateClassification => {
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

export const transformPreviewSource = (source: string) => {
  const config = loadConfig(source).parse();
  const classification = classifyDefaultExport(config._ast);
  if (classification === 'unsafe') {
    throw new ComponentSubtitleMigrationError(
      'parameters.componentSubtitle is not in a direct preview parameters object'
    );
  }
  const parameters = config.getFieldNode(['parameters']);
  const changed = t.isObjectExpression(parameters) && migrateParameters(parameters);
  return changed ? formatConfig(config) : null;
};

const previewSubtitleCanWin = (source: string) => {
  const config = loadConfig(source).parse();
  const parameters = config.getFieldNode(['parameters']);
  let defaultExportHasSpread = false;
  traverse(config._ast, {
    ExportDefaultDeclaration(path) {
      const object = resolvePreviewObjectExpression(path.node.declaration, path.scope);
      defaultExportHasSpread = object ? hasSpreadProperty(object) : true;
    },
  });
  if (defaultExportHasSpread) {
    return true;
  }
  if (parameters === undefined) {
    return false;
  }
  return !t.isObjectExpression(parameters) || localSubtitleTruthiness(parameters) !== false;
};

export const transformStorySource = (source: string, inheritedSubtitleCanWin = false) => {
  const csf = loadCsf(source, { makeTitle: (title?: string) => title || 'default' }).parse();
  let changed = false;
  const metaObject = csf._metaPath
    ? resolveObjectExpression(csf._metaPath.node.declaration, csf._metaPath.scope)
    : undefined;
  if (
    metaObject &&
    csf._metaPath &&
    classifyStoryObject(metaObject, csf._metaPath.scope) === 'unsafe'
  ) {
    throw new ComponentSubtitleMigrationError(
      'parameters.componentSubtitle is not in a direct CSF parameters object'
    );
  }
  const metaParameters = metaObject && getObjectProperty(metaObject, 'parameters');
  const metaCanHideSubtitle = Boolean(
    metaObject &&
    (hasSpreadProperty(metaObject) ||
      (metaParameters !== undefined && !t.isObjectExpression(metaParameters)))
  );
  const metaSubtitleTruthiness = t.isObjectExpression(metaParameters)
    ? localSubtitleTruthiness(metaParameters)
    : false;

  if (metaParameters) {
    if (t.isObjectExpression(metaParameters)) {
      changed = migrateParameters(metaParameters, inheritedSubtitleCanWin) || changed;
    }
  }

  const storyObjects = new Set<ObjectExpression>();
  for (const declaration of Object.values(csf._storyExports)) {
    const storyObject = getStoryObject(declaration);
    if (storyObject) {
      storyObjects.add(storyObject);
    }
  }
  const storyScopes = new Map<ObjectExpression, Scope>();
  traverse(csf._ast, {
    ObjectExpression(path) {
      if (storyObjects.has(path.node)) {
        storyScopes.set(path.node, path.scope);
      }
    },
    ExportNamedDeclaration(path) {
      for (const specifier of path.node.specifiers) {
        if (t.isExportSpecifier(specifier)) {
          const storyObject = resolveObjectExpression(specifier.local, path.scope);
          if (storyObject && classifyStoryObject(storyObject, path.scope) !== 'none') {
            throw new ComponentSubtitleMigrationError(
              'parameters.componentSubtitle is not in a direct CSF parameters object'
            );
          }
        }
      }
    },
  });

  for (const storyObject of storyObjects) {
    const storyScope = storyScopes.get(storyObject);
    if (storyScope) {
      const classification = classifyStoryObject(storyObject, storyScope);
      if (classification === 'unsafe' || (classification !== 'none' && metaCanHideSubtitle)) {
        throw new ComponentSubtitleMigrationError(
          'parameters.componentSubtitle is not in a direct CSF parameters object'
        );
      }
    }
    const parameters = storyObject && getObjectProperty(storyObject, 'parameters');
    if (parameters) {
      if (t.isObjectExpression(parameters)) {
        changed =
          migrateParameters(
            parameters,
            inheritedSubtitleCanWin || metaSubtitleTruthiness !== false
          ) || changed;
      }
    }
  }
  return changed ? printCsf(csf).code : null;
};

export const componentSubtitle: Fix<ComponentSubtitleOptions> = {
  id: 'component-subtitle',
  link: 'https://github.com/storybookjs/storybook/blob/next/MIGRATION.md#parameterscomponentsubtitle-removed',

  async check({ previewConfigPath, storiesPaths }) {
    const files = [...storiesPaths];
    if (previewConfigPath) {
      files.unshift(previewConfigPath);
    }
    const matchingFiles = (
      await Promise.all(
        files.map(async (file) => {
          try {
            const source = await readFile(file, 'utf-8');
            const transformed =
              file === previewConfigPath
                ? transformPreviewSource(source)
                : transformStorySource(source);
            return transformed ? file : null;
          } catch (error) {
            return error instanceof ComponentSubtitleMigrationError ? file : null;
          }
        })
      )
    ).filter((file): file is string => file !== null);
    return matchingFiles.length > 0 ? { files: matchingFiles, previewConfigPath } : null;
  },

  prompt() {
    return `Move deprecated ${picocolors.cyan('parameters.componentSubtitle')} values to ${picocolors.cyan('parameters.docs.subtitle')}?`;
  },

  async run({ dryRun, result }) {
    const transformedFiles: Array<{ file: string; source: string }> = [];
    const errors: Array<{ file: string; error: Error }> = [];
    let inheritedSubtitleCanWin = false;

    if (result.previewConfigPath) {
      try {
        inheritedSubtitleCanWin = previewSubtitleCanWin(
          await readFile(result.previewConfigPath, 'utf-8')
        );
      } catch (error) {
        errors.push({ file: result.previewConfigPath, error: error as Error });
      }
    }

    for (const file of result.files) {
      if (errors.some((entry) => entry.file === file)) {
        continue;
      }
      try {
        const source = await readFile(file, 'utf-8');
        const transformed =
          file === result.previewConfigPath
            ? transformPreviewSource(source)
            : transformStorySource(source, inheritedSubtitleCanWin);
        if (transformed) {
          transformedFiles.push({ file, source: transformed });
        }
      } catch (error) {
        errors.push({ file, error: error as Error });
      }
    }

    if (errors.length > 0) {
      throw new ComponentSubtitleMigrationError(
        `Could not migrate parameters.componentSubtitle automatically:\n${errors
          .map(({ file, error }) => `- ${file}: ${error.message}`)
          .join('\n')}\nMove each value to parameters.docs.subtitle manually.`
      );
    }

    if (!dryRun) {
      await Promise.all(transformedFiles.map(({ file, source }) => writeFile(file, source)));
    }
  },
};

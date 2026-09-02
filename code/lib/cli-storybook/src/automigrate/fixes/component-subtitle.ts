import { readFile, writeFile } from 'node:fs/promises';

import { traverse, types as t } from 'storybook/internal/babel';
import { formatConfig, loadConfig, loadCsf, printCsf } from 'storybook/internal/csf-tools';

import type { Expression, ObjectExpression, ObjectProperty } from '@babel/types';
import type { Scope } from '@babel/traverse';
import picocolors from 'picocolors';

import { getObjectProperty, getStoryObject } from '../helpers/ast-utils.ts';
import type { Fix } from '../types.ts';

interface ComponentSubtitleOptions {
  files: string[];
  previewConfigPath?: string;
}

class ComponentSubtitleMigrationError extends Error {}

const propertyName = (property: ObjectProperty) => {
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

const directProperties = (object: ObjectExpression, name: string) =>
  object.properties.filter(
    (property): property is ObjectProperty =>
      t.isObjectProperty(property) && propertyName(property) === name
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
  if (parameters.properties.some((property) => t.isSpreadElement(property))) {
    return undefined;
  }
  const docsProperties = directProperties(parameters, 'docs');
  if (docsProperties.length === 0) {
    return false;
  }
  if (docsProperties.length !== 1 || !t.isObjectExpression(docsProperties[0].value)) {
    return undefined;
  }
  const docs = docsProperties[0].value;
  if (docs.properties.some((property) => t.isSpreadElement(property))) {
    return undefined;
  }
  const subtitleProperties = directProperties(docs, 'subtitle');
  if (subtitleProperties.length === 0) {
    return false;
  }
  if (subtitleProperties.length !== 1 || !t.isExpression(subtitleProperties[0].value)) {
    return undefined;
  }
  return staticTruthiness(subtitleProperties[0].value);
};

const migrateParameters = (parameters: ObjectExpression, inheritedSubtitleCanWin = false) => {
  const legacyProperties = directProperties(parameters, 'componentSubtitle');
  if (legacyProperties.length === 0) {
    return false;
  }
  if (
    legacyProperties.length !== 1 ||
    parameters.properties.some((property) => t.isSpreadElement(property))
  ) {
    throw new ComponentSubtitleMigrationError(
      'parameters.componentSubtitle is declared in an ambiguous parameters object'
    );
  }

  const docsProperties = directProperties(parameters, 'docs');
  if (docsProperties.length > 1) {
    throw new ComponentSubtitleMigrationError('parameters.docs is declared more than once');
  }

  const legacyProperty = legacyProperties[0];
  const legacyValue = legacyProperty.value;
  if (!t.isExpression(legacyValue)) {
    throw new ComponentSubtitleMigrationError(
      'parameters.componentSubtitle does not have a movable value'
    );
  }
  const docsProperty = docsProperties[0];
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
  if (!t.isObjectExpression(docsProperty.value)) {
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

  const subtitleProperties = directProperties(docsProperty.value, 'subtitle');
  if (subtitleProperties.length > 1) {
    throw new ComponentSubtitleMigrationError(
      'parameters.docs.subtitle is declared more than once'
    );
  }
  const subtitleProperty = subtitleProperties[0];
  if (!subtitleProperty) {
    if (inheritedSubtitleCanWin) {
      throw new ComponentSubtitleMigrationError(
        'an inherited parameters.docs.subtitle value can take precedence'
      );
    }
    docsProperty.value.properties.push(t.objectProperty(t.identifier('subtitle'), legacyValue));
  } else {
    if (!t.isExpression(subtitleProperty.value)) {
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

const resolveObjectExpression = (value: t.Node, scope: Scope) => {
  let current: t.Node | null | undefined = value;
  if (t.isIdentifier(current)) {
    current = scope.getBinding(current.name)?.path.node;
  }
  if (t.isVariableDeclarator(current)) {
    current = current.init;
  }
  while (t.isTSAsExpression(current) || t.isTSSatisfiesExpression(current)) {
    current = current.expression;
  }
  return t.isObjectExpression(current) ? current : undefined;
};

const hasUnresolvedComputedProperty = (object: ObjectExpression) =>
  object.properties.some(
    (property) =>
      t.isObjectProperty(property) && property.computed && propertyName(property) === undefined
  );

const hasSpreadProperty = (object: ObjectExpression) =>
  object.properties.some((property) => t.isSpreadElement(property));

const defaultExportHasSpread = (ast: t.Node) => {
  let hasSpread = false;
  traverse(ast, {
    ExportDefaultDeclaration(path) {
      const object = resolveObjectExpression(path.node.declaration, path.scope);
      hasSpread = object ? hasSpreadProperty(object) : true;
    },
  });
  return hasSpread;
};

export const transformPreviewSource = (source: string) => {
  const config = loadConfig(source).parse();
  const parameters = config.getFieldNode(['parameters']);
  const hasRootSpread = defaultExportHasSpread(config._ast);
  const hasUnknownComputed =
    t.isObjectExpression(parameters) && hasUnresolvedComputedProperty(parameters);
  const changed = t.isObjectExpression(parameters) && migrateParameters(parameters);
  if (
    source.includes('componentSubtitle') &&
    (hasRootSpread ||
      hasUnknownComputed ||
      (parameters !== undefined && !t.isObjectExpression(parameters)))
  ) {
    throw new ComponentSubtitleMigrationError(
      'parameters.componentSubtitle is not in a direct preview parameters object'
    );
  }
  return changed ? formatConfig(config) : null;
};

const previewSubtitleCanWin = (source: string) => {
  const config = loadConfig(source).parse();
  const parameters = config.getFieldNode(['parameters']);
  if (defaultExportHasSpread(config._ast)) {
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
  let foundDynamicParameters = false;
  const metaObject = csf._metaPath
    ? resolveObjectExpression(csf._metaPath.node.declaration, csf._metaPath.scope)
    : undefined;
  const metaParameters = metaObject && getObjectProperty(metaObject, 'parameters');
  foundDynamicParameters = Boolean(metaObject && hasSpreadProperty(metaObject));
  const metaSubtitleTruthiness = t.isObjectExpression(metaParameters)
    ? localSubtitleTruthiness(metaParameters)
    : false;

  if (metaParameters) {
    if (t.isObjectExpression(metaParameters)) {
      foundDynamicParameters =
        foundDynamicParameters || hasUnresolvedComputedProperty(metaParameters);
      changed = migrateParameters(metaParameters, inheritedSubtitleCanWin) || changed;
    } else {
      foundDynamicParameters = true;
    }
  }

  const storyObjects = new Set<ObjectExpression>();
  for (const declaration of Object.values(csf._storyExports)) {
    const storyObject = getStoryObject(declaration);
    if (storyObject) {
      storyObjects.add(storyObject);
    }
  }
  traverse(csf._ast, {
    ExportNamedDeclaration(path) {
      for (const specifier of path.node.specifiers) {
        if (t.isExportSpecifier(specifier)) {
          const storyObject = resolveObjectExpression(specifier.local, path.scope);
          if (storyObject) {
            const parameters = getObjectProperty(storyObject, 'parameters');
            foundDynamicParameters =
              foundDynamicParameters ||
              hasSpreadProperty(storyObject) ||
              (t.isObjectExpression(parameters) &&
                directProperties(parameters, 'componentSubtitle').length > 0);
          }
        }
      }
    },
  });

  for (const storyObject of storyObjects) {
    const parameters = storyObject && getObjectProperty(storyObject, 'parameters');
    foundDynamicParameters = foundDynamicParameters || hasSpreadProperty(storyObject);
    if (parameters) {
      if (t.isObjectExpression(parameters)) {
        foundDynamicParameters =
          foundDynamicParameters || hasUnresolvedComputedProperty(parameters);
        changed =
          migrateParameters(
            parameters,
            inheritedSubtitleCanWin || metaSubtitleTruthiness !== false
          ) || changed;
      } else {
        foundDynamicParameters = true;
      }
    }
  }

  if (foundDynamicParameters && (changed || source.includes('componentSubtitle'))) {
    throw new ComponentSubtitleMigrationError(
      'parameters.componentSubtitle is not in a direct CSF parameters object'
    );
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
            return error instanceof ComponentSubtitleMigrationError ||
              (await readFile(file, 'utf-8')).includes('componentSubtitle')
              ? file
              : null;
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

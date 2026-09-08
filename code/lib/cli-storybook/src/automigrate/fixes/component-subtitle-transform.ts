import { traverse, types as t } from 'storybook/internal/babel';
import { formatConfig, loadConfig, loadCsf, printCsf } from 'storybook/internal/csf-tools';

import type { ObjectExpression } from '@babel/types';
import type { Scope } from '@babel/traverse';

import { getObjectProperty, getStoryObject } from '../helpers/ast-utils.ts';
import {
  classifyDefaultExport,
  classifyStoryObject,
  ComponentSubtitleMigrationError,
  hasSpreadProperty,
  localSubtitleTruthiness,
  migrateParameters,
  resolveObjectExpression,
  resolvePreviewObjectExpression,
} from './component-subtitle-ast.ts';

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

export const previewSubtitleCanWin = (source: string) => {
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

  if (t.isObjectExpression(metaParameters)) {
    changed = migrateParameters(metaParameters, inheritedSubtitleCanWin) || changed;
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
    const parameters = getObjectProperty(storyObject, 'parameters');
    if (t.isObjectExpression(parameters)) {
      changed =
        migrateParameters(
          parameters,
          inheritedSubtitleCanWin || metaSubtitleTruthiness !== false
        ) || changed;
    }
  }
  return changed ? printCsf(csf).code : null;
};

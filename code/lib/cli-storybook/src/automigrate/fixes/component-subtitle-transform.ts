import type { NodePath } from 'storybook/internal/babel';
import { traverse, types as t } from 'storybook/internal/babel';
import type { CsfFile, CsfObject } from 'storybook/internal/csf-tools';
import { formatConfig, loadConfig, loadCsf, printCsf } from 'storybook/internal/csf-tools';

import type { ObjectExpression } from '@babel/types';

type Scope = NodePath['scope'];

import { getObjectProperty } from '../helpers/ast-utils.ts';
import {
  classifyDefaultExport,
  classifyStoryObject,
  ComponentSubtitleMigrationError,
  hasSpreadProperty,
  isPureLiteral,
  localSubtitleTruthiness,
  migrateParameters,
  resolveObjectExpression,
  resolvePreviewObjectExpression,
  staticTruthiness,
} from './component-subtitle-ast.ts';

const componentSubtitlePath = ['parameters', 'componentSubtitle'] as const;
const docsSubtitlePath = ['parameters', 'docs', 'subtitle'] as const;

const getDirectStoryObject = (declaration: t.Node) => {
  const value = t.isVariableDeclarator(declaration)
    ? declaration.init
    : t.isExportDefaultDeclaration(declaration)
      ? declaration.declaration
      : undefined;
  const unwrapped =
    t.isTSAsExpression(value) || t.isTSSatisfiesExpression(value) ? value.expression : value;
  return t.isObjectExpression(unwrapped) ? unwrapped : undefined;
};

const mutationError = (message: string) => {
  throw new ComponentSubtitleMigrationError(message);
};

const migrateCsfObject = (csf: CsfFile, object: CsfObject, inheritedSubtitleCanWin: boolean) => {
  const diagnosticsBefore = csf.mutationDiagnostics.length;
  const legacyValue = object.get(componentSubtitlePath);
  if (!legacyValue) {
    return;
  }

  const subtitle = object.get(docsSubtitlePath);
  if (csf.mutationDiagnostics.length > diagnosticsBefore) {
    const diagnostic = csf.mutationDiagnostics.at(-1);
    if (diagnostic?.code === 'spread-field' || diagnostic?.code === 'dynamic-key') {
      mutationError('parameters.componentSubtitle is declared in an ambiguous parameters object');
    }
    mutationError('parameters.docs.subtitle does not have a supported value');
  }
  if (!subtitle) {
    if (inheritedSubtitleCanWin) {
      mutationError('an inherited parameters.docs.subtitle value can take precedence');
    }
    const result = object.move(componentSubtitlePath, docsSubtitlePath);
    if (!result.ok) {
      mutationError(result.diagnostic.message);
    }
    return;
  }

  if (!isPureLiteral(legacyValue)) {
    mutationError(
      'parameters.componentSubtitle has an expression whose evaluation cannot be moved safely'
    );
  }
  const truthiness = staticTruthiness(subtitle);
  if (truthiness === undefined) {
    mutationError('parameters.docs.subtitle has dynamic truthiness');
  }
  if (!truthiness) {
    let liveLegacyValue: t.Expression | undefined;
    object.transform(componentSubtitlePath, (value) => {
      liveLegacyValue = value;
      return undefined;
    });
    const result = object.transform(docsSubtitlePath, () => liveLegacyValue);
    if (!result.ok) {
      mutationError(result.diagnostic.message);
    }
  }
  const result = object.remove(componentSubtitlePath);
  if (!result.ok) {
    mutationError(result.diagnostic.message);
  }
};

const inspectStoryCandidates = (csf: CsfFile) => {
  const metaObject = csf._metaPath
    ? resolveObjectExpression(csf._metaPath.node.declaration, csf._metaPath.scope)
    : undefined;
  if (
    metaObject &&
    csf._metaPath &&
    classifyStoryObject(metaObject, csf._metaPath.scope) === 'unsafe'
  ) {
    mutationError('parameters.componentSubtitle is not in a direct CSF parameters object');
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

  const storyObjects = new Set<ObjectExpression>();
  for (const declaration of Object.values(csf._storyExports)) {
    const storyObject = getDirectStoryObject(declaration);
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
            mutationError('parameters.componentSubtitle is not in a direct CSF parameters object');
          }
        }
      }
    },
  });

  for (const storyObject of storyObjects) {
    const storyScope = storyScopes.get(storyObject);
    const classification = storyScope ? classifyStoryObject(storyObject, storyScope) : 'none';
    if (classification === 'unsafe' || (classification !== 'none' && metaCanHideSubtitle)) {
      mutationError('parameters.componentSubtitle is not in a direct CSF parameters object');
    }
  }

  return metaSubtitleTruthiness !== false;
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
  const metaSubtitleCanWin = inspectStoryCandidates(csf);
  const objects = csf.objects({ annotations: ['parameters'] });
  const meta = objects.find((object) => object.target.kind === 'meta');

  if (meta) {
    migrateCsfObject(csf, meta, inheritedSubtitleCanWin);
  }
  for (const object of objects) {
    if (object !== meta) {
      migrateCsfObject(csf, object, inheritedSubtitleCanWin || metaSubtitleCanWin);
    }
  }
  return csf.changed ? printCsf(csf).code : null;
};

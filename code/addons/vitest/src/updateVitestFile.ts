import * as fs from 'node:fs/promises';

import type { BabelFile } from 'storybook/internal/babel';

import type { ObjectExpression } from '@babel/types';
import { join } from 'pathe';

import { resolvePackageDir } from '../../../core/src/shared/utils/module';

export const loadTemplate = async (name: string, replacements: Record<string, string>) => {
  let template = await fs.readFile(
    join(resolvePackageDir('@storybook/addon-vitest'), 'templates', name),
    'utf8'
  );
  Object.entries(replacements).forEach(([key, value]) => (template = template.replace(key, value)));
  return template;
};

// Recursively merge object properties from source into target
// Handles nested objects and shallowly merging of arrays
const mergeProperties = (
  source: ObjectExpression['properties'],
  target: ObjectExpression['properties']
) => {
  for (const sourceProp of source) {
    if (sourceProp.type === 'ObjectProperty') {
      const targetProp = target.find(
        (p) =>
          sourceProp.key.type === 'Identifier' &&
          p.type === 'ObjectProperty' &&
          p.key.type === 'Identifier' &&
          p.key.name === sourceProp.key.name
      );
      if (targetProp && targetProp.type === 'ObjectProperty') {
        if (
          sourceProp.value.type === 'ObjectExpression' &&
          targetProp.value.type === 'ObjectExpression'
        ) {
          mergeProperties(sourceProp.value.properties, targetProp.value.properties);
        } else if (
          sourceProp.value.type === 'ArrayExpression' &&
          targetProp.value.type === 'ArrayExpression'
        ) {
          targetProp.value.elements.push(...sourceProp.value.elements);
        } else {
          targetProp.value = sourceProp.value;
        }
      } else {
        target.push(sourceProp);
      }
    }
  }
};

/**
 * Merges a source Vitest configuration AST into a target configuration AST.
 *
 * This function intelligently combines configuration elements from a source file (typically a
 * template) into an existing target configuration file, avoiding duplicates and preserving the
 * structure of both files.
 *
 * The function performs the following operations:
 *
 * 1. **Import Merging**: Adds new import statements from source that don't exist in target (determined
 *    by local specifier name). Imports are inserted after existing imports.
 * 2. **Variable Declaration Merging**: Copies variable declarations from source to target if they
 *    don't already exist (determined by variable name). Variables are inserted after imports.
 * 3. **Configuration Object Merging**: Merges the configuration object properties from source into
 *    target's default export. Supports both direct object exports and function-wrapped exports
 *    (e.g., `defineConfig({})`). The merging is recursive:
 *
 *    - Nested objects are merged deeply
 *    - Arrays are concatenated (shallow merge)
 *    - Primitive values are overwritten
 *
 * @param source - The source Babel AST (template configuration to merge from)
 * @param target - The target Babel AST (existing configuration to merge into)
 * @returns {boolean} - True if the target was modified, false otherwise
 */
export const updateConfigFile = (source: BabelFile['ast'], target: BabelFile['ast']) => {
  let updated = false;
  for (const sourceNode of source.program.body) {
    if (sourceNode.type === 'ImportDeclaration') {
      // Insert imports that don't already exist (according to their local specifier name)
      if (
        !target.program.body.some(
          (targetNode) =>
            targetNode.type === sourceNode.type &&
            targetNode.specifiers.some((s) => s.local.name === sourceNode.specifiers[0].local.name)
        )
      ) {
        const lastImport = target.program.body.findLastIndex((n) => n.type === 'ImportDeclaration');
        target.program.body.splice(lastImport + 1, 0, sourceNode);
      }
    } else if (sourceNode.type === 'VariableDeclaration') {
      // Copy over variable declarations, making sure they're inserted after any imports
      if (
        !target.program.body.some(
          (targetNode) =>
            targetNode.type === sourceNode.type &&
            targetNode.declarations.some(
              (d) =>
                'name' in d.id &&
                'name' in sourceNode.declarations[0].id &&
                d.id.name === sourceNode.declarations[0].id.name
            )
        )
      ) {
        const lastImport = target.program.body.findLastIndex((n) => n.type === 'ImportDeclaration');
        target.program.body.splice(lastImport + 1, 0, sourceNode);
      }
    } else if (sourceNode.type === 'ExportDefaultDeclaration') {
      const exportDefault = target.program.body.find((n) => n.type === 'ExportDefaultDeclaration');
      if (
        exportDefault &&
        sourceNode.declaration.type === 'CallExpression' &&
        sourceNode.declaration.arguments.length > 0 &&
        sourceNode.declaration.arguments[0].type === 'ObjectExpression'
      ) {
        const { properties } = sourceNode.declaration.arguments[0];
        if (exportDefault.declaration.type === 'ObjectExpression') {
          mergeProperties(properties, exportDefault.declaration.properties);
          updated = true;
        } else if (
          exportDefault.declaration.type === 'CallExpression' &&
          exportDefault.declaration.callee.type === 'Identifier' &&
          exportDefault.declaration.callee.name === 'defineConfig' &&
          exportDefault.declaration.arguments[0]?.type === 'ObjectExpression'
        ) {
          mergeProperties(properties, exportDefault.declaration.arguments[0].properties);
          updated = true;
        }
      }
    }
  }
  return updated;
};

export const updateWorkspaceFile = (source: BabelFile['ast'], target: BabelFile['ast']) => {
  let updated = false;
  for (const sourceNode of source.program.body) {
    if (sourceNode.type === 'ImportDeclaration') {
      // Insert imports that don't already exist
      if (
        !target.program.body.some(
          (targetNode) =>
            targetNode.type === sourceNode.type &&
            targetNode.source.value === sourceNode.source.value &&
            targetNode.specifiers.some((s) => s.local.name === sourceNode.specifiers[0].local.name)
        )
      ) {
        const lastImport = target.program.body.findLastIndex((n) => n.type === 'ImportDeclaration');
        target.program.body.splice(lastImport + 1, 0, sourceNode);
      }
    } else if (sourceNode.type === 'VariableDeclaration') {
      // Copy over variable declarations, making sure they're inserted after any imports
      if (
        !target.program.body.some(
          (targetNode) =>
            targetNode.type === sourceNode.type &&
            targetNode.declarations.some(
              (d) =>
                'name' in d.id &&
                'name' in sourceNode.declarations[0].id &&
                d.id.name === sourceNode.declarations[0].id.name
            )
        )
      ) {
        const lastImport = target.program.body.findLastIndex((n) => n.type === 'ImportDeclaration');
        target.program.body.splice(lastImport + 1, 0, sourceNode);
      }
    } else if (sourceNode.type === 'ExportDefaultDeclaration') {
      // Merge workspace array, which is the default export on both sides but may or may not be
      // wrapped in a defineWorkspace call
      const exportDefault = target.program.body.find((n) => n.type === 'ExportDefaultDeclaration');
      if (
        exportDefault &&
        sourceNode.declaration.type === 'CallExpression' &&
        sourceNode.declaration.arguments.length > 0 &&
        sourceNode.declaration.arguments[0].type === 'ArrayExpression' &&
        sourceNode.declaration.arguments[0].elements.length > 0
      ) {
        const { elements } = sourceNode.declaration.arguments[0];
        if (exportDefault.declaration.type === 'ArrayExpression') {
          exportDefault.declaration.elements.push(...elements);
          updated = true;
        } else if (
          exportDefault.declaration.type === 'CallExpression' &&
          exportDefault.declaration.callee.type === 'Identifier' &&
          exportDefault.declaration.callee.name === 'defineWorkspace' &&
          exportDefault.declaration.arguments[0]?.type === 'ArrayExpression'
        ) {
          exportDefault.declaration.arguments[0].elements.push(...elements);
          updated = true;
        }
      }
    }
  }
  return updated;
};

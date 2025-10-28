import * as fs from 'node:fs/promises';

import type { BabelFile, types as t } from 'storybook/internal/babel';

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
  source: t.ObjectExpression['properties'],
  target: t.ObjectExpression['properties']
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

  // First, check if we can actually modify the configuration
  const sourceExportDefault = source.program.body.find(
    (n) => n.type === 'ExportDefaultDeclaration'
  );
  if (!sourceExportDefault || sourceExportDefault.declaration.type !== 'CallExpression') {
    return false;
  }

  const targetExportDefault = target.program.body.find(
    (n) => n.type === 'ExportDefaultDeclaration'
  );
  if (!targetExportDefault) {
    return false;
  }

  // Check if this is a function notation that we don't support
  if (
    targetExportDefault.declaration.type === 'CallExpression' &&
    targetExportDefault.declaration.callee.type === 'Identifier' &&
    targetExportDefault.declaration.callee.name === 'defineConfig' &&
    targetExportDefault.declaration.arguments.length > 0 &&
    targetExportDefault.declaration.arguments[0].type === 'ArrowFunctionExpression'
  ) {
    // This is function notation that we don't support
    return false;
  }

  // Check if we can handle mergeConfig patterns
  let canHandleConfig = false;
  if (targetExportDefault.declaration.type === 'ObjectExpression') {
    canHandleConfig = true;
  } else if (
    targetExportDefault.declaration.type === 'CallExpression' &&
    targetExportDefault.declaration.callee.type === 'Identifier' &&
    targetExportDefault.declaration.callee.name === 'defineConfig' &&
    targetExportDefault.declaration.arguments[0]?.type === 'ObjectExpression'
  ) {
    canHandleConfig = true;
  } else if (
    targetExportDefault.declaration.type === 'CallExpression' &&
    targetExportDefault.declaration.callee.type === 'Identifier' &&
    targetExportDefault.declaration.callee.name === 'mergeConfig' &&
    targetExportDefault.declaration.arguments.length >= 2
  ) {
    canHandleConfig = true;
  }

  if (!canHandleConfig) {
    return false;
  }

  // If we get here, we can modify the configuration, so add imports and variables first
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
        } else if (
          exportDefault.declaration.type === 'CallExpression' &&
          exportDefault.declaration.callee.type === 'Identifier' &&
          exportDefault.declaration.callee.name === 'mergeConfig' &&
          exportDefault.declaration.arguments.length >= 2
        ) {
          // We first collect all the potential config object nodes from mergeConfig, these can be:
          // - defineConfig({ ... }) calls
          // - plain object expressions { ... } without a defineConfig helper
          const configObjectNodes: t.ObjectExpression[] = [];

          for (const arg of exportDefault.declaration.arguments) {
            if (
              arg?.type === 'CallExpression' &&
              arg.callee.type === 'Identifier' &&
              arg.callee.name === 'defineConfig' &&
              arg.arguments[0]?.type === 'ObjectExpression'
            ) {
              configObjectNodes.push(arg.arguments[0] as t.ObjectExpression);
            } else if (arg?.type === 'ObjectExpression') {
              configObjectNodes.push(arg);
            }
          }

          // Prefer a config object that already contains a `test` property
          const configObjectWithTest = configObjectNodes.find((obj) =>
            obj.properties.some(
              (p) =>
                p.type === 'ObjectProperty' && p.key.type === 'Identifier' && p.key.name === 'test'
            )
          );

          const targetConfigObject = configObjectWithTest || configObjectNodes[0];

          if (!targetConfigObject) {
            return false;
          }

          // Check if there's already a test property in the target config
          const existingTestProp = targetConfigObject.properties.find(
            (p) =>
              p.type === 'ObjectProperty' && p.key.type === 'Identifier' && p.key.name === 'test'
          ) as t.ObjectProperty | undefined;

          if (existingTestProp && existingTestProp.value.type === 'ObjectExpression') {
            // Find the test property from the template (either workspace or projects)
            const templateTestProp = properties.find(
              (p) =>
                p.type === 'ObjectProperty' && p.key.type === 'Identifier' && p.key.name === 'test'
            ) as t.ObjectProperty | undefined;

            if (templateTestProp && templateTestProp.value.type === 'ObjectExpression') {
              // Find the workspace/projects array in the template
              const workspaceOrProjectsProp = templateTestProp.value.properties.find(
                (p) =>
                  p.type === 'ObjectProperty' &&
                  p.key.type === 'Identifier' &&
                  (p.key.name === 'workspace' || p.key.name === 'projects')
              ) as t.ObjectProperty | undefined;

              if (
                workspaceOrProjectsProp &&
                workspaceOrProjectsProp.value.type === 'ArrayExpression'
              ) {
                // Extract coverage config before creating the test project
                const coverageProp = existingTestProp.value.properties.find(
                  (p) =>
                    p.type === 'ObjectProperty' &&
                    p.key.type === 'Identifier' &&
                    p.key.name === 'coverage'
                ) as t.ObjectProperty | undefined;

                // Create a new test config without the coverage property
                const testPropsWithoutCoverage = existingTestProp.value.properties.filter(
                  (p) => p !== coverageProp
                );

                const testConfigForProject: t.ObjectExpression = {
                  type: 'ObjectExpression',
                  properties: testPropsWithoutCoverage,
                };

                // Create the existing test project
                const existingTestProject: t.ObjectExpression = {
                  type: 'ObjectExpression',
                  properties: [
                    {
                      type: 'ObjectProperty',
                      key: { type: 'Identifier', name: 'extends' },
                      value: { type: 'BooleanLiteral', value: true },
                      computed: false,
                      shorthand: false,
                    },
                    {
                      type: 'ObjectProperty',
                      key: { type: 'Identifier', name: 'test' },
                      value: testConfigForProject,
                      computed: false,
                      shorthand: false,
                    },
                  ],
                };

                // Add the existing test project to the template's array
                workspaceOrProjectsProp.value.elements.unshift(existingTestProject);

                // Remove the existing test property from the target config since we're moving it to the array
                targetConfigObject.properties = targetConfigObject.properties.filter(
                  (p) => p !== existingTestProp
                );

                // If there was a coverage config, add it to the template's test config (at the top level of the test object)
                // Insert it at the beginning so it appears before workspace/projects
                if (coverageProp && templateTestProp.value.type === 'ObjectExpression') {
                  templateTestProp.value.properties.unshift(coverageProp);
                }

                // Merge the template properties (which now include our existing test project in the array)
                mergeProperties(properties, targetConfigObject.properties);
              } else {
                // Fallback to original behavior if template structure is unexpected
                mergeProperties(properties, targetConfigObject.properties);
              }
            } else {
              // Fallback to original behavior if template doesn't have expected structure
              mergeProperties(properties, targetConfigObject.properties);
            }
          } else {
            // No existing test config, just merge normally
            mergeProperties(properties, targetConfigObject.properties);
          }
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

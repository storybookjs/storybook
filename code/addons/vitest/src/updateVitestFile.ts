import { resolveExpression } from 'storybook/internal/babel';
import type { BabelFile, types as t } from 'storybook/internal/babel';

import { normalize } from 'pathe';

/**
 * Each template is imported separately to allow the build system to process the template as raw
 * text. A mix of globs and the "?raw" string query is not supported in esbuild
 */
async function getTemplatePath(name: string) {
  switch (name) {
    case 'vitest.config.template':
      return import('../templates/vitest.config.template?raw');
    case 'vitest.config.4.template':
      return import('../templates/vitest.config.4.template?raw');
    case 'vitest.config.3.2.template':
      return import('../templates/vitest.config.3.2.template?raw');
    case 'vitest.workspace.template':
      return import('../templates/vitest.workspace.template?raw');
    default:
      throw new Error(`Unknown template: ${name}`);
  }
}

export const loadTemplate = async (name: string, replacements: Record<string, string>) => {
  // Dynamically import the template file as plain text
  const templateModule = await getTemplatePath(name);
  let template = templateModule.default;
  // Normalize Windows paths (backslashes) to forward slashes for JavaScript string compatibility
  Object.entries(replacements).forEach(
    ([key, value]) => (template = template.replace(key, normalize(value)))
  );
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

/** Returns true if the call expression is a defineConfig or defineProject call. */
const isDefineConfigLike = (node: t.CallExpression): boolean =>
  node.callee.type === 'Identifier' &&
  (node.callee.name === 'defineConfig' || node.callee.name === 'defineProject');

/**
 * Resolves the value of a `test` ObjectProperty to an ObjectExpression. Handles both inline objects
 * and shorthand identifier references, e.g.: `{ test: { ... } }` → returns the inline
 * ObjectExpression `const test = {...}; { test }` → resolves the identifier to its initializer
 */
const resolveTestPropValue = (
  testProp: t.ObjectProperty,
  ast: BabelFile['ast']
): t.ObjectExpression | null => {
  if (testProp.value.type === 'ObjectExpression') {
    return testProp.value;
  }
  const resolved = resolveExpression(testProp.value as t.Expression, ast);
  return resolved?.type === 'ObjectExpression' ? resolved : null;
};

/** Finds a named ObjectProperty in an object expression's properties. */
const findNamedProp = (
  properties: t.ObjectExpression['properties'],
  name: string
): t.ObjectProperty | undefined =>
  properties.find(
    (p): p is t.ObjectProperty =>
      p.type === 'ObjectProperty' && p.key.type === 'Identifier' && p.key.name === name
  );

/** Type guard for a property that is a `workspace` or `projects` key with an array value. */
const isWorkspaceOrProjectsArrayProp = (
  p: t.ObjectMethod | t.ObjectProperty | t.SpreadElement
): p is t.ObjectProperty =>
  p.type === 'ObjectProperty' &&
  p.key.type === 'Identifier' &&
  (p.key.name === 'workspace' || p.key.name === 'projects') &&
  p.value.type === 'ArrayExpression';

/**
 * Appends storybook project(s) from template into an existing `test.workspace`/`test.projects`
 * array, then merges any additional test-level options (e.g. coverage) that don't already exist.
 */
const appendToExistingProjectRefs = (
  existingProjectRefsProp: t.ObjectProperty,
  resolvedTestValue: t.ObjectExpression,
  templateTestProp: t.ObjectProperty | undefined,
  properties: t.ObjectExpression['properties'],
  targetConfigObject: t.ObjectExpression
) => {
  const existingKeyName =
    existingProjectRefsProp.key.type === 'Identifier' ? existingProjectRefsProp.key.name : null;

  if (templateTestProp && templateTestProp.value.type === 'ObjectExpression') {
    // Append template workspace/projects entries to existing workspace/projects array
    const templateProjectRefsProp = templateTestProp.value.properties.find(
      (p): p is t.ObjectProperty =>
        isWorkspaceOrProjectsArrayProp(p) &&
        (existingKeyName === null ||
          (p.key.type === 'Identifier' && p.key.name === existingKeyName))
    );
    if (templateProjectRefsProp && templateProjectRefsProp.value.type === 'ArrayExpression') {
      (existingProjectRefsProp.value as t.ArrayExpression).elements.push(
        ...(templateProjectRefsProp.value as t.ArrayExpression).elements
      );
    }

    // Merge other test-level options from template (e.g. coverage) that don't already exist
    const existingTestPropNames = new Set(
      resolvedTestValue.properties
        .filter(
          (p): p is t.ObjectProperty => p.type === 'ObjectProperty' && p.key.type === 'Identifier'
        )
        .map((p) => (p.key as t.Identifier).name)
    );
    for (const templateProp of templateTestProp.value.properties) {
      if (
        templateProp.type === 'ObjectProperty' &&
        templateProp.key.type === 'Identifier' &&
        (templateProp.key as t.Identifier).name !== 'projects' &&
        (templateProp.key as t.Identifier).name !== 'workspace' &&
        !existingTestPropNames.has((templateProp.key as t.Identifier).name)
      ) {
        resolvedTestValue.properties.push(templateProp);
      }
    }
  }

  // Merge only non-test properties from template
  const otherTemplateProps = properties.filter(
    (p) => !(p.type === 'ObjectProperty' && p.key.type === 'Identifier' && p.key.name === 'test')
  );
  if (otherTemplateProps.length > 0) {
    mergeProperties(otherTemplateProps, targetConfigObject.properties);
  }
};

/**
 * Wraps the existing test config as one project entry inside the template's workspace/projects
 * array, hoisting shared properties (coverage, env, pool, maxWorkers) to the top-level test
 * object.
 */
const wrapTestConfigAsProject = (
  resolvedTestValue: t.ObjectExpression,
  existingTestProp: t.ObjectProperty,
  templateTestProp: t.ObjectProperty,
  properties: t.ObjectExpression['properties'],
  targetConfigObject: t.ObjectExpression
) => {
  const workspaceOrProjectsProp =
    templateTestProp.value.type === 'ObjectExpression'
      ? (templateTestProp.value.properties.find(
          (p) =>
            p.type === 'ObjectProperty' &&
            p.key.type === 'Identifier' &&
            (p.key.name === 'workspace' || p.key.name === 'projects')
        ) as t.ObjectProperty | undefined)
      : undefined;

  if (!workspaceOrProjectsProp || workspaceOrProjectsProp.value.type !== 'ArrayExpression') {
    mergeProperties(properties, targetConfigObject.properties);
    return;
  }

  // Properties that should stay at the top-level test object (shared across all projects)
  const TOP_LEVEL_TEST_PROPERTIES = [
    'shard',
    'watch',
    'run',
    'cache',
    'update',
    'reporters',
    'outputFile',
    'teardownTimeout',
    'silent',
    'forceRerunTriggers',
    'testNamePattern',
    'ui',
    'open',
    'uiBase',
    'snapshotFormat',
    'resolveSnapshotPath',
    'passWithNoTests',
    'onConsoleLog',
    'onStackTrace',
    'dangerouslyIgnoreUnhandledErrors',
    'slowTestThreshold',
    'inspect',
    'inspectBrk',
    'coverage',
    'watchTriggerPatterns',
  ];

  const topLevelProps = TOP_LEVEL_TEST_PROPERTIES.map((name) =>
    findNamedProp(resolvedTestValue.properties, name)
  ).filter(Boolean) as t.ObjectProperty[];

  const topLevelPropSet = new Set(topLevelProps);
  const projectTestProps = resolvedTestValue.properties.filter(
    (p) => !topLevelPropSet.has(p as any)
  );

  // Create the existing test project: { extends: true, test: { ...projectTestProps } }
  const existingTestProject: t.ObjectExpression = {
    type: 'ObjectExpression',
    properties: [
      {
        type: 'ObjectProperty',
        key: { type: 'Identifier', name: 'extends' } as t.Identifier,
        value: { type: 'BooleanLiteral', value: true } as t.BooleanLiteral,
        computed: false,
        shorthand: false,
      } as t.ObjectProperty,
      {
        type: 'ObjectProperty',
        key: { type: 'Identifier', name: 'test' } as t.Identifier,
        value: {
          type: 'ObjectExpression',
          properties: projectTestProps,
        } as t.ObjectExpression,
        computed: false,
        shorthand: false,
      } as t.ObjectProperty,
    ],
  };

  // Add the existing test project to the template's array
  workspaceOrProjectsProp.value.elements.unshift(existingTestProject);

  // Remove the existing test property from the target config (it's now in the array)
  targetConfigObject.properties = targetConfigObject.properties.filter(
    (p) => p !== existingTestProp
  );

  // Hoist top-level properties to the test object so they apply to all projects
  if (topLevelProps.length > 0 && templateTestProp.value.type === 'ObjectExpression') {
    templateTestProp.value.properties.unshift(...topLevelProps);
  }

  mergeProperties(properties, targetConfigObject.properties);
};

/**
 * Merges template properties into a config object, handling Vitest `test.projects` migration
 * semantics:
 *
 * - Append when projects already exists
 * - Wrap existing test config as a project when template introduces projects/workspace
 * - Otherwise perform a regular merge
 */
const mergeTemplateIntoConfigObject = (
  targetConfigObject: t.ObjectExpression,
  properties: t.ObjectExpression['properties'],
  target: BabelFile['ast']
) => {
  const existingTestProp = findNamedProp(targetConfigObject.properties, 'test');
  const resolvedTestValue = existingTestProp
    ? resolveTestPropValue(existingTestProp, target)
    : null;
  const templateTestProp = findNamedProp(properties, 'test');

  if (existingTestProp && resolvedTestValue !== null) {
    const existingProjectRefsProp = resolvedTestValue.properties.find(
      isWorkspaceOrProjectsArrayProp
    );

    if (existingProjectRefsProp) {
      appendToExistingProjectRefs(
        existingProjectRefsProp,
        resolvedTestValue,
        templateTestProp,
        properties,
        targetConfigObject
      );
      return;
    }

    if (templateTestProp && templateTestProp.value.type === 'ObjectExpression') {
      wrapTestConfigAsProject(
        resolvedTestValue,
        existingTestProp,
        templateTestProp,
        properties,
        targetConfigObject
      );
      return;
    }
  }

  mergeProperties(properties, targetConfigObject.properties);
};

/**
 * Extracts the effective mergeConfig call from a declaration, handling wrappers:
 *
 * - TypeScript type annotations (as X, satisfies X)
 * - DefineConfig(mergeConfig(...)) outer wrapper
 * - Variable references (export default config where config = mergeConfig(...))
 */
const getEffectiveMergeConfigCall = (
  decl: t.Expression | t.Declaration,
  ast: BabelFile['ast']
): t.CallExpression | null => {
  const resolved = resolveExpression(decl, ast);
  if (!resolved || resolved.type !== 'CallExpression') {
    return null;
  }

  // Handle defineConfig(mergeConfig(...)) – arg may itself be wrapped in a TS type expression
  if (isDefineConfigLike(resolved) && resolved.arguments.length > 0) {
    const innerArg = resolveExpression(resolved.arguments[0] as t.Expression, ast);
    if (
      innerArg?.type === 'CallExpression' &&
      innerArg.callee.type === 'Identifier' &&
      innerArg.callee.name === 'mergeConfig'
    ) {
      return innerArg;
    }
  }

  // Handle mergeConfig(...) directly
  if (resolved.callee.type === 'Identifier' && resolved.callee.name === 'mergeConfig') {
    return resolved;
  }

  return null;
};

/**
 * Resolves the target's default export to the actual config object expression we can merge into.
 * Handles: export default defineConfig({}), export default defineProject({}), export default {},
 * and export default config (where config is a variable holding one of those), as well as
 * TypeScript type annotations on the declaration.
 */
const getTargetConfigObject = (
  target: BabelFile['ast'],
  exportDefault: t.ExportDefaultDeclaration
): t.ObjectExpression | null => {
  const resolved = resolveExpression(exportDefault.declaration, target);
  if (!resolved) {
    return null;
  }
  if (resolved.type === 'ObjectExpression') {
    return resolved;
  }
  if (
    resolved.type === 'CallExpression' &&
    isDefineConfigLike(resolved) &&
    resolved.arguments[0]?.type === 'ObjectExpression'
  ) {
    return resolved.arguments[0] as t.ObjectExpression;
  }
  return null;
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

  // Check if this is a function notation that we don't support (defineConfig(() => ({})))
  // Resolve through TS type wrappers and variable references before checking.
  const effectiveDecl = resolveExpression(targetExportDefault.declaration, target);
  if (
    effectiveDecl?.type === 'CallExpression' &&
    isDefineConfigLike(effectiveDecl) &&
    effectiveDecl.arguments.length > 0 &&
    effectiveDecl.arguments[0].type === 'ArrowFunctionExpression'
  ) {
    return false;
  }

  // Check if we can handle the config pattern (direct object, defineConfig/defineProject,
  // mergeConfig, or any of these wrapped in TS type annotations / variable references)
  let canHandleConfig = false;
  if (getTargetConfigObject(target, targetExportDefault) !== null) {
    canHandleConfig = true;
  } else if (getEffectiveMergeConfigCall(targetExportDefault.declaration, target) !== null) {
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
        const targetConfigObject = getTargetConfigObject(target, exportDefault);
        if (targetConfigObject !== null) {
          mergeTemplateIntoConfigObject(targetConfigObject, properties, target);
          updated = true;
        } else {
          const mergeConfigCall = getEffectiveMergeConfigCall(exportDefault.declaration, target);
          if (mergeConfigCall && mergeConfigCall.arguments.length >= 2) {
            // Collect all potential config object nodes from mergeConfig arguments.
            // Each argument may be: defineConfig/defineProject({...}), a plain object {…},
            // an Identifier (variable reference), or wrapped in a TS type annotation.
            const configObjectNodes: t.ObjectExpression[] = [];

            for (const arg of mergeConfigCall.arguments) {
              const resolved = resolveExpression(arg as t.Expression, target);
              if (resolved?.type === 'ObjectExpression') {
                configObjectNodes.push(resolved);
              } else if (
                resolved?.type === 'CallExpression' &&
                isDefineConfigLike(resolved) &&
                resolved.arguments[0]?.type === 'ObjectExpression'
              ) {
                configObjectNodes.push(resolved.arguments[0] as t.ObjectExpression);
              }
            }

            // Prefer a config object that already contains a `test` property
            const configObjectWithTest = configObjectNodes.find((obj) =>
              obj.properties.some(
                (p) =>
                  p.type === 'ObjectProperty' &&
                  p.key.type === 'Identifier' &&
                  p.key.name === 'test'
              )
            );

            const targetConfigObject = configObjectWithTest || configObjectNodes[0];

            if (!targetConfigObject) {
              return false;
            }

            mergeTemplateIntoConfigObject(targetConfigObject, properties, target);
            updated = true;
          }
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

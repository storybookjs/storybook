import { readFile, writeFile } from 'node:fs/promises';

import { types as t } from 'storybook/internal/babel';
import type { ConfigFile, CsfFile } from 'storybook/internal/csf-tools';
import { formatConfig, loadConfig, loadCsf, writeCsf } from 'storybook/internal/csf-tools';

import type { ArrayExpression, Expression, ObjectExpression } from '@babel/types';

import {
  addProperty,
  getKeyFromName,
  getObjectProperty,
  removeProperty,
  transformStoryParameters,
  transformValuesToOptions,
} from '../helpers/ast-utils';
import type { Fix } from '../types';

interface AddonGlobalsApiOptions {
  previewConfig: ConfigFile;
  previewConfigPath: string;
  needsViewportMigration: boolean;
  needsBackgroundsMigration: boolean;
  viewportsOptions:
    | {
        defaultViewport?: string;
        viewports?: Expression;
      }
    | undefined;
  backgroundsOptions:
    | {
        default?: string;
        values?: Expression;
        disable?: boolean;
      }
    | undefined;
}

/**
 * Migrate viewport and backgrounds addons to use the new globals API in Storybook 9
 *
 * - Migrate viewports to use options and initialGlobals
 * - Migrate backgrounds to use options and initialGlobals
 */
export const addonGlobalsApi: Fix<AddonGlobalsApiOptions> = {
  id: 'addon-globals-api',
  link: 'https://github.com/storybookjs/storybook/blob/next/MIGRATION.md#viewportbackgrounds-addon-synchronized-configuration-and-globals-usage',

  async check({ previewConfigPath }) {
    if (!previewConfigPath) {
      return null;
    }

    const previewConfig = loadConfig((await readFile(previewConfigPath)).toString()).parse();

    const getFieldNode = previewConfig.getFieldNode.bind(previewConfig);
    const getFieldValue = previewConfig.getFieldValue.bind(previewConfig);

    // Reusable function to check addon migration status
    const checkAddonMigration = (addonName: 'viewport' | 'backgrounds') => {
      const paramPath = ['parameters', addonName];
      const addonParams = getFieldNode(paramPath) as ObjectExpression | undefined;

      if (!addonParams) {
        return { needsMigration: false };
      }

      const hasOptions = getFieldNode([...paramPath, 'options']) !== undefined;

      // Define fields to check based on addon type
      const fieldsToCheck =
        addonName === 'viewport'
          ? ['viewports', 'defaultViewport']
          : ['values', 'default', 'disable'];

      // Check if any old format fields exist
      const hasOldFormat = fieldsToCheck.some(
        (field) => getFieldNode([...paramPath, field]) !== undefined
      );

      // Only migrate if using old format and not already migrated
      const needsMigration = hasOldFormat && !hasOptions;

      // Collect relevant options from old format
      const options: Record<string, any> = {};

      if (needsMigration) {
        fieldsToCheck.forEach((field) => {
          const value =
            (addonName === 'viewport' && field === 'viewports') ||
            (addonName === 'backgrounds' && field === 'values')
              ? getFieldNode([...paramPath, field])
              : getFieldValue([...paramPath, field]);

          if (value !== undefined) {
            // Convert field names if necessary (maintaining the expected output structure)
            const optionKey = addonName === 'viewport' ? field : field;
            options[optionKey] = value;
          }
        });
      }

      return { needsMigration, options };
    };

    // Check migration status for both addons
    const viewportMigration = checkAddonMigration('viewport');
    const backgroundsMigration = checkAddonMigration('backgrounds');

    // Return null if there's nothing to migrate
    if (!viewportMigration.needsMigration && !backgroundsMigration.needsMigration) {
      return null;
    }

    return {
      previewConfig,
      previewConfigPath,
      needsViewportMigration: viewportMigration.needsMigration,
      needsBackgroundsMigration: backgroundsMigration.needsMigration,
      viewportsOptions: viewportMigration.options,
      backgroundsOptions: backgroundsMigration.options,
    };
  },

  prompt() {
    return "You're using a deprecated config API for viewport/backgrounds. The globals API will be used instead.";
  },

  async run({ dryRun = false, result, storiesPaths }) {
    const {
      previewConfig,
      needsViewportMigration,
      needsBackgroundsMigration,
      viewportsOptions,
      backgroundsOptions,
    } = result;

    const getFieldNode = previewConfig.getFieldNode.bind(previewConfig);

    if (needsViewportMigration) {
      // Get the viewport parameter object
      const viewports = getFieldNode(['parameters', 'viewport', 'viewports']) as ObjectExpression;

      if (viewportsOptions?.viewports) {
        // Remove the old viewports property
        previewConfig.removeField(['parameters', 'viewport', 'viewports']);
        addProperty(
          getFieldNode(['parameters', 'viewport']) as ObjectExpression,
          'options',
          viewports
        );
      }

      // If defaultViewport exists, create initialGlobals.viewport
      if (viewportsOptions?.defaultViewport) {
        // Remove the old defaultViewport property
        const viewportNode = getFieldNode(['parameters', 'viewport']);
        removeProperty(viewportNode as ObjectExpression, 'defaultViewport');

        previewConfig.setFieldValue(
          ['initialGlobals', 'viewport', 'value'],
          viewportsOptions.defaultViewport
        );
        previewConfig.setFieldValue(['initialGlobals', 'viewport', 'isRotated'], false);
      }
    }

    if (needsBackgroundsMigration) {
      if (backgroundsOptions?.values) {
        // Transform values array to options object
        const optionsObject = transformValuesToOptions(
          backgroundsOptions.values as ArrayExpression
        );

        // Remove the old values property
        previewConfig.removeField(['parameters', 'backgrounds', 'values']);
        addProperty(
          getFieldNode(['parameters', 'backgrounds']) as ObjectExpression,
          'options',
          optionsObject
        );
      }

      // If default exists, create initialGlobals.backgrounds
      if (backgroundsOptions?.default) {
        // Remove the old default property
        removeProperty(getFieldNode(['parameters', 'backgrounds']) as ObjectExpression, 'default');

        previewConfig.setFieldValue(
          ['initialGlobals', 'backgrounds', 'value'],
          getKeyFromName(backgroundsOptions.values as ArrayExpression, backgroundsOptions.default)
        );
      }

      // If disable exists, rename to disabled
      if (backgroundsOptions?.disable === true) {
        // Remove the old disable property
        removeProperty(getFieldNode(['parameters', 'backgrounds']) as ObjectExpression, 'disable');

        addProperty(
          getFieldNode(['parameters', 'backgrounds']) as ObjectExpression,
          'disabled',
          t.booleanLiteral(true)
        );
      }
    }

    // Write the updated config back to the file
    if (!dryRun) {
      await writeFile(result.previewConfigPath, formatConfig(previewConfig));
    }

    // Update stories
    if (needsViewportMigration || needsBackgroundsMigration) {
      await transformStoryFiles(
        storiesPaths,
        {
          needsViewportMigration,
          needsBackgroundsMigration,
          viewportsOptions,
          backgroundsOptions,
        },
        dryRun
      );
    }
  },
};

// Story transformation function
async function transformStoryFiles(
  files: string[],
  options: {
    needsViewportMigration: boolean;
    needsBackgroundsMigration: boolean;
    viewportsOptions: any;
    backgroundsOptions: any;
  },
  dryRun: boolean
): Promise<Array<{ file: string; error: Error }>> {
  const errors: Array<{ file: string; error: Error }> = [];
  const { default: pLimit } = await import('p-limit');
  const limit = pLimit(10);

  await Promise.all(
    files.map((file) =>
      limit(async () => {
        try {
          const content = await readFile(file, 'utf-8');
          const transformed = transformStoryFile(content, options);

          if (transformed && !dryRun) {
            await writeCsf(transformed, file);
          }
        } catch (error) {
          errors.push({ file, error: error as Error });
        }
      })
    )
  );

  return errors;
}

// Transform a single story file
export function transformStoryFile(
  source: string,
  options: {
    needsViewportMigration: boolean;
    needsBackgroundsMigration: boolean;
    viewportsOptions: any;
    backgroundsOptions: any;
  }
): CsfFile | null {
  const { needsViewportMigration, needsBackgroundsMigration, backgroundsOptions } = options;

  // Load the story file using CSF tools
  const storyConfig = loadCsf(source, {
    makeTitle: (title?: string) => title || 'default',
  }).parse();

  // Use the story transformer utility to handle all story iteration
  const hasChanges = transformStoryParameters(storyConfig, (parameters, storyObject) => {
    let newGlobals: ObjectExpression | undefined;
    let viewportParams: ObjectExpression | undefined;
    let backgroundsParams: ObjectExpression | undefined;
    let storyHasChanges = false;

    // Handle viewport migration
    if (needsViewportMigration) {
      viewportParams = getObjectProperty(parameters, 'viewport') as ObjectExpression;
      if (viewportParams) {
        const defaultViewport = getObjectProperty(viewportParams, 'defaultViewport');
        const defaultOrientation = getObjectProperty(viewportParams, 'defaultOrientation');
        const disableViewport = getObjectProperty(viewportParams, 'disable');

        // Handle both string literals and member expressions for defaultViewport
        let viewportValue: t.StringLiteral | t.MemberExpression | null = null;
        if (defaultViewport) {
          if (t.isStringLiteral(defaultViewport)) {
            viewportValue = defaultViewport;
          } else if (t.isMemberExpression(defaultViewport)) {
            // Preserve the member expression as-is
            viewportValue = defaultViewport;
          }
        }

        if (viewportValue) {
          // Create globals.viewport
          if (!newGlobals) {
            newGlobals = t.objectExpression([]);
          }

          // Determine isRotated based on defaultOrientation
          let isRotated = false;
          if (defaultOrientation && t.isStringLiteral(defaultOrientation)) {
            isRotated = defaultOrientation.value === 'portrait';
          }

          newGlobals.properties.push(
            t.objectProperty(
              t.identifier('viewport'),
              t.objectExpression([
                t.objectProperty(t.identifier('value'), viewportValue),
                t.objectProperty(t.identifier('isRotated'), t.booleanLiteral(isRotated)),
              ])
            )
          );

          // Remove defaultViewport from parameters
          removeProperty(viewportParams, 'defaultViewport');
          storyHasChanges = true;
        }

        // Handle defaultOrientation removal
        if (defaultOrientation) {
          removeProperty(viewportParams, 'defaultOrientation');
          storyHasChanges = true;
        }

        // Handle disable -> disabled rename
        if (disableViewport && t.isBooleanLiteral(disableViewport)) {
          removeProperty(viewportParams, 'disable');
          // Rename disable to disabled (preserve both true and false values)
          addProperty(viewportParams, 'disabled', disableViewport);
          storyHasChanges = true;
        }
      }
    }

    // Handle backgrounds migration
    if (needsBackgroundsMigration) {
      backgroundsParams = getObjectProperty(parameters, 'backgrounds') as ObjectExpression;
      if (backgroundsParams) {
        const defaultBackground = getObjectProperty(backgroundsParams, 'default');
        const disableBackground = getObjectProperty(backgroundsParams, 'disable');
        const valuesBackground = getObjectProperty(backgroundsParams, 'values');

        // Handle values -> options transformation
        if (valuesBackground && t.isArrayExpression(valuesBackground)) {
          // Transform values array to options object
          const optionsObject = transformValuesToOptions(valuesBackground);

          // Remove the old values property
          removeProperty(backgroundsParams, 'values');
          addProperty(backgroundsParams, 'options', optionsObject);
          storyHasChanges = true;
        }

        if (defaultBackground && t.isStringLiteral(defaultBackground)) {
          // Create globals.backgrounds
          if (!newGlobals) {
            newGlobals = t.objectExpression([]);
          }

          const backgroundKey = getKeyFromName(
            backgroundsOptions?.values as ArrayExpression,
            defaultBackground.value
          );

          newGlobals.properties.push(
            t.objectProperty(
              t.identifier('backgrounds'),
              t.objectExpression([
                t.objectProperty(t.identifier('value'), t.stringLiteral(backgroundKey)),
              ])
            )
          );

          // Remove default from parameters
          removeProperty(backgroundsParams, 'default');
          storyHasChanges = true;
        }

        // Handle disable -> disabled rename
        if (disableBackground && t.isBooleanLiteral(disableBackground)) {
          removeProperty(backgroundsParams, 'disable');
          // Rename disable to disabled (preserve both true and false values)
          addProperty(backgroundsParams, 'disabled', disableBackground);
          storyHasChanges = true;
        }
      }
    }

    // Add globals to story if we created any
    if (newGlobals && newGlobals.properties.length > 0) {
      const existingGlobals = getObjectProperty(storyObject, 'globals') as
        | ObjectExpression
        | undefined;

      if (existingGlobals) {
        // Merge new globals with existing globals
        newGlobals.properties.forEach((newGlobal) => {
          if (t.isObjectProperty(newGlobal) && t.isIdentifier(newGlobal.key)) {
            const globalName = newGlobal.key.name;
            const existingGlobal = getObjectProperty(existingGlobals, globalName) as
              | ObjectExpression
              | undefined;

            if (existingGlobal) {
              // Merge properties if both are object expressions
              if (t.isObjectExpression(newGlobal.value) && t.isObjectExpression(existingGlobal)) {
                newGlobal.value.properties.forEach((newProp) => {
                  if (t.isObjectProperty(newProp) && t.isIdentifier(newProp.key)) {
                    const propName = newProp.key.name;
                    const existingProp = getObjectProperty(existingGlobal, propName);

                    if (!existingProp) {
                      existingGlobal.properties.push(newProp);
                    }
                  }
                });
              }
            } else {
              // Add new global to existing globals
              existingGlobals.properties.push(newGlobal);
            }
          }
        });
      } else {
        // No existing globals, add new ones
        storyObject.properties.push(t.objectProperty(t.identifier('globals'), newGlobals));
      }
      storyHasChanges = true;
    }

    // Clean up empty parameter objects
    if (viewportParams && viewportParams.properties.length === 0) {
      removeProperty(parameters, 'viewport');
      storyHasChanges = true;
    }

    if (backgroundsParams && backgroundsParams.properties.length === 0) {
      removeProperty(parameters, 'backgrounds');
      storyHasChanges = true;
    }

    // Remove parameters if it's now empty
    if (parameters.properties.length === 0) {
      removeProperty(storyObject, 'parameters');
      storyHasChanges = true;
    }

    return storyHasChanges;
  });

  return hasChanges ? storyConfig : null;
}

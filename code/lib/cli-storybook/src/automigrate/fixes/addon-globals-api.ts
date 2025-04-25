import { readFile, writeFile } from 'node:fs/promises';

import { types as t } from 'storybook/internal/babel';
import type { ConfigFile } from 'storybook/internal/csf-tools';
import { formatConfig, loadConfig } from 'storybook/internal/csf-tools';

import type { ArrayExpression, Expression, ObjectExpression } from '@babel/types';
import picocolors from 'picocolors';
import { dedent } from 'ts-dedent';

import type { Fix } from '../types';

const MIGRATION =
  'https://github.com/storybookjs/storybook/blob/next/MIGRATION.md#viewportbackgrounds-addon-synchronized-configuration-and-globals-usage';

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
  versionRange: ['<9.0.0', '^9.0.0-0 || ^9.0.0'],

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

  prompt({ needsViewportMigration, needsBackgroundsMigration }) {
    return dedent`
      We've detected that you're using the ${needsViewportMigration && needsBackgroundsMigration ? 'viewport and backgrounds addons' : needsViewportMigration ? 'viewport addon' : 'backgrounds addon'} with the deprecated configuration API.
      
      In Storybook 9, ${needsViewportMigration && needsBackgroundsMigration ? 'these addons have' : 'this addon has'} been updated to use the new globals API which ensures a consistent experience while navigating between stories.
      
      We'll update your configuration to use the new API:
      ${needsViewportMigration ? `- ${picocolors.yellow('viewports')} → ${picocolors.yellow('options')} and ${picocolors.yellow('defaultViewport')} → ${picocolors.yellow('initialGlobals.viewport')}\n` : ''}${needsBackgroundsMigration ? `- ${picocolors.yellow('values')} → ${picocolors.yellow('options')} and ${picocolors.yellow('default')} → ${picocolors.yellow('initialGlobals.backgrounds')}\n` : ''}
      
      Learn more: ${picocolors.cyan(MIGRATION)}
    `;
  },

  async run({ dryRun, result }) {
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
  },
};

// Helper functions

function getObjectProperty(obj: ObjectExpression, propertyName: string): Expression | undefined {
  if (!obj || !obj.properties) {
    return undefined;
  }

  const property = obj.properties.find(
    (prop) =>
      t.isObjectProperty(prop) &&
      ((t.isIdentifier(prop.key) && prop.key.name === propertyName) ||
        (t.isStringLiteral(prop.key) && prop.key.value === propertyName))
  ) as t.ObjectProperty;

  return property?.value as Expression;
}

function removeProperty(obj: ObjectExpression, propertyName: string): void {
  if (!obj || !obj.properties) {
    return;
  }

  const index = obj.properties.findIndex(
    (prop) =>
      t.isObjectProperty(prop) &&
      ((t.isIdentifier(prop.key) && prop.key.name === propertyName) ||
        (t.isStringLiteral(prop.key) && prop.key.value === propertyName))
  );

  if (index !== -1) {
    obj.properties.splice(index, 1);
  }
}

function addProperty(obj: ObjectExpression, propertyName: string, value: Expression): void {
  if (!obj) {
    return;
  }

  obj.properties.push(t.objectProperty(t.identifier(propertyName), value));
}

function transformValuesToOptions(valuesArray: ArrayExpression): Expression {
  // Transform [{ name: 'Light', value: '#FFF' }] to { light: { name: 'Light', value: '#FFF' } }
  const optionsObject = t.objectExpression([]);

  if (valuesArray && t.isArrayExpression(valuesArray) && valuesArray.elements) {
    valuesArray.elements.forEach((element) => {
      if (t.isObjectExpression(element)) {
        const nameProperty = getObjectProperty(element, 'name');

        if (t.isStringLiteral(nameProperty)) {
          const key = nameProperty.value.toLowerCase().replace(/\s+/g, '_');

          optionsObject.properties.push(t.objectProperty(t.identifier(key), element));
        }
      }
    });
  }

  return optionsObject;
}

function getKeyFromName(valuesArray: ArrayExpression, name: string): string {
  // Generate a key from a name in the values array
  if (valuesArray && t.isArrayExpression(valuesArray) && valuesArray.elements) {
    for (const element of valuesArray.elements) {
      if (t.isObjectExpression(element)) {
        const nameProperty = getObjectProperty(element, 'name');

        if (t.isStringLiteral(nameProperty) && nameProperty.value === name) {
          return name.toLowerCase().replace(/\s+/g, '_');
        }
      }
    }
  }

  // If not found, generate a key from the name
  return name.toLowerCase().replace(/\s+/g, '_');
}

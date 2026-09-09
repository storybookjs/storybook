import { readFile, writeFile } from 'node:fs/promises';

import { types as t } from 'storybook/internal/babel';
import type { ConfigFile, CsfFile, CsfObject } from 'storybook/internal/csf-tools';
import { formatConfig, loadConfig, loadCsf, writeCsf } from 'storybook/internal/csf-tools';

import type { ArrayExpression, Expression, ObjectExpression } from '@babel/types';

import {
  addProperty,
  getKeyFromName,
  removeProperty,
  transformValuesToOptions,
} from '../helpers/ast-utils.ts';
import type { Fix } from '../types.ts';

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

type StoryGlobalsMigrationOptions = Pick<
  AddonGlobalsApiOptions,
  'needsViewportMigration' | 'needsBackgroundsMigration' | 'viewportsOptions' | 'backgroundsOptions'
>;

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
      const options: {
        [key: string]: Expression | string | boolean | undefined;
        viewports?: Expression;
        defaultViewport?: string;
        values?: Expression;
        default?: string;
        disable?: boolean;
      } = {};

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

      if (typeof backgroundsOptions?.disable === 'boolean') {
        const backgrounds = getFieldNode(['parameters', 'backgrounds']) as ObjectExpression;
        const disabled = getFieldNode(['parameters', 'backgrounds', 'disabled']);
        removeProperty(backgrounds, 'disable');
        if (!disabled) {
          addProperty(backgrounds, 'disabled', t.booleanLiteral(backgroundsOptions.disable));
        }
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
  options: StoryGlobalsMigrationOptions,
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
  options: StoryGlobalsMigrationOptions
): CsfFile | null {
  const storyConfig = loadCsf(source, {
    makeTitle: (title?: string) => title || 'default',
  }).parse();

  const objects = storyConfig.objects({ annotations: ['parameters'] });
  for (const object of objects) {
    migrateStoryGlobals(storyConfig, object, options);
  }

  return storyConfig.changed ? storyConfig : null;
}

const migrateStoryGlobals = (
  csf: CsfFile,
  object: CsfObject,
  options: StoryGlobalsMigrationOptions
) => {
  const diagnosticsBefore = csf.mutationDiagnostics.length;
  const viewportDefault = options.needsViewportMigration
    ? object.get(['parameters', 'viewport', 'defaultViewport'])
    : undefined;
  const viewportOrientation = options.needsViewportMigration
    ? object.get(['parameters', 'viewport', 'defaultOrientation'])
    : undefined;
  const viewportDisable = options.needsViewportMigration
    ? object.get(['parameters', 'viewport', 'disable'])
    : undefined;
  const viewportDisabled = options.needsViewportMigration
    ? object.get(['parameters', 'viewport', 'disabled'])
    : undefined;
  const viewportGlobal = options.needsViewportMigration
    ? object.get(['globals', 'viewport', 'value'])
    : undefined;
  const viewportRotated = options.needsViewportMigration
    ? object.get(['globals', 'viewport', 'isRotated'])
    : undefined;
  const backgroundValues = options.needsBackgroundsMigration
    ? object.get(['parameters', 'backgrounds', 'values'])
    : undefined;
  const backgroundOptions = options.needsBackgroundsMigration
    ? object.get(['parameters', 'backgrounds', 'options'])
    : undefined;
  const backgroundDefault = options.needsBackgroundsMigration
    ? object.get(['parameters', 'backgrounds', 'default'])
    : undefined;
  const backgroundDisable = options.needsBackgroundsMigration
    ? object.get(['parameters', 'backgrounds', 'disable'])
    : undefined;
  const backgroundDisabled = options.needsBackgroundsMigration
    ? object.get(['parameters', 'backgrounds', 'disabled'])
    : undefined;
  const backgroundGlobal = options.needsBackgroundsMigration
    ? object.get(['globals', 'backgrounds', 'value'])
    : undefined;

  if (csf.mutationDiagnostics.length > diagnosticsBefore) {
    return;
  }

  const canSetGlobals = object.target.kind !== 'story-annotation';
  if (
    canSetGlobals &&
    (t.isStringLiteral(viewportDefault) || t.isMemberExpression(viewportDefault))
  ) {
    if (!viewportGlobal) {
      object.set(['globals', 'viewport', 'value'], viewportDefault);
      const orientationCanBeMigrated =
        !viewportOrientation ||
        (t.isStringLiteral(viewportOrientation) &&
          (viewportOrientation.value === 'portrait' || viewportOrientation.value === 'landscape'));
      if (!viewportRotated && orientationCanBeMigrated) {
        object.set(
          ['globals', 'viewport', 'isRotated'],
          t.isStringLiteral(viewportOrientation) && viewportOrientation.value === 'portrait'
        );
        object.remove(['parameters', 'viewport', 'defaultOrientation']);
      }
    }
    object.remove(['parameters', 'viewport', 'defaultViewport']);
  }
  if (t.isBooleanLiteral(viewportDisable)) {
    if (viewportDisabled) {
      object.remove(['parameters', 'viewport', 'disable']);
    } else {
      object.rename(['parameters', 'viewport', 'disable'], 'disabled');
    }
  }

  if (t.isArrayExpression(backgroundValues) && !backgroundOptions) {
    object.set(
      ['parameters', 'backgrounds', 'options'],
      transformValuesToOptions(backgroundValues)
    );
    object.remove(['parameters', 'backgrounds', 'values']);
  }
  if (canSetGlobals && t.isStringLiteral(backgroundDefault)) {
    if (!backgroundGlobal) {
      object.set(
        ['globals', 'backgrounds', 'value'],
        getKeyFromName(options.backgroundsOptions?.values, backgroundDefault.value)
      );
    }
    object.remove(['parameters', 'backgrounds', 'default']);
  }
  if (t.isBooleanLiteral(backgroundDisable)) {
    if (backgroundDisabled) {
      object.remove(['parameters', 'backgrounds', 'disable']);
    } else {
      object.rename(['parameters', 'backgrounds', 'disable'], 'disabled');
    }
  }
};

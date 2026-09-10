import { readFile, writeFile } from 'node:fs/promises';

import { types as t } from 'storybook/internal/babel';
import type {
  ConfigFile,
  CsfFile,
  CsfMutationDiagnostic,
  CsfObject,
} from 'storybook/internal/csf-tools';
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
        disable?: boolean;
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

type StoryTransformResult =
  | { ok: true; file: string; transformed: CsfFile | null }
  | {
      ok: false;
      file: string;
      failure:
        | { kind: 'diagnostic'; diagnostic: CsfMutationDiagnostic }
        | { kind: 'error'; message: string };
    };

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

      const fieldsToCheck =
        addonName === 'viewport' ? ['viewports', 'defaultViewport'] : ['values', 'default'];

      const hasOldFormat = fieldsToCheck.some(
        (field) => getFieldNode([...paramPath, field]) !== undefined
      );
      const disable = getFieldValue([...paramPath, 'disable']);
      const needsFormatMigration = hasOldFormat && !hasOptions;
      const needsMigration = needsFormatMigration || typeof disable === 'boolean';

      // Collect relevant options from old format
      const options: {
        [key: string]: Expression | string | boolean | undefined;
        viewports?: Expression;
        defaultViewport?: string;
        values?: Expression;
        default?: string;
        disable?: boolean;
      } = {};

      if (needsFormatMigration) {
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
      if (typeof disable === 'boolean') {
        options.disable = disable;
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

      if (typeof viewportsOptions?.disable === 'boolean') {
        const viewport = getFieldNode(['parameters', 'viewport']) as ObjectExpression;
        const disabled = getFieldNode(['parameters', 'viewport', 'disabled']);
        removeProperty(viewport, 'disable');
        if (!disabled) {
          addProperty(viewport, 'disabled', t.booleanLiteral(viewportsOptions.disable));
        }
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

    let storyResults: StoryTransformResult[] = [];
    if (needsViewportMigration || needsBackgroundsMigration) {
      storyResults = await transformStoryFiles(storiesPaths, {
        needsViewportMigration,
        needsBackgroundsMigration,
        viewportsOptions,
        backgroundsOptions,
      });
      const failures = storyResults.filter((storyResult) => !storyResult.ok);

      if (failures.length > 0) {
        // eslint-disable-next-line local-rules/no-uncategorized-errors
        throw new Error(
          `Failed to process ${failures.length} files:\n${failures
            .map(({ file, failure }) => {
              const message =
                failure.kind === 'diagnostic' ? failure.diagnostic.message : failure.message;
              return `- ${file}:\n  - ${message}`;
            })
            .join('\n')}`
        );
      }
    }

    if (!dryRun) {
      await writeFile(result.previewConfigPath, formatConfig(previewConfig));
      await Promise.all(
        storyResults.map((storyResult) =>
          storyResult.ok && storyResult.transformed
            ? writeCsf(storyResult.transformed, storyResult.file)
            : undefined
        )
      );
    }
  },
};

async function transformStoryFiles(
  files: string[],
  options: StoryGlobalsMigrationOptions
): Promise<StoryTransformResult[]> {
  const { default: pLimit } = await import('p-limit');
  const limit = pLimit(10);

  return Promise.all(
    files.map((file) =>
      limit(async (): Promise<StoryTransformResult> => {
        try {
          const content = await readFile(file, 'utf-8');
          const transformed = transformStoryFileResult(content, options);

          if (!transformed.ok) {
            return { ok: false, file, failure: transformed.failure };
          }

          return { ok: true, file, transformed: transformed.transformed };
        } catch (error) {
          return {
            ok: false,
            file,
            failure: {
              kind: 'error',
              message: error instanceof Error ? error.message : String(error),
            },
          };
        }
      })
    )
  );
}

export function transformStoryFile(
  source: string,
  options: StoryGlobalsMigrationOptions
): CsfFile | null {
  const result = transformStoryFileResult(source, options);
  if (!result.ok) {
    // eslint-disable-next-line local-rules/no-uncategorized-errors
    throw new Error(result.failure.diagnostic.message);
  }
  return result.transformed;
}

function transformStoryFileResult(
  source: string,
  options: StoryGlobalsMigrationOptions
):
  | { ok: true; transformed: CsfFile | null }
  | { ok: false; failure: { kind: 'diagnostic'; diagnostic: CsfMutationDiagnostic } } {
  const storyConfig = loadCsf(source, {
    makeTitle: (title?: string) => title || 'default',
  }).parse();

  const objects = storyConfig.objects({ annotations: ['parameters'] });
  for (const object of objects) {
    migrateStoryGlobals(storyConfig, object, options);
  }

  const [diagnostic] = storyConfig.mutationDiagnostics;
  if (diagnostic) {
    return { ok: false, failure: { kind: 'diagnostic', diagnostic } };
  }

  return { ok: true, transformed: storyConfig.changed ? storyConfig : null };
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

  // The `globals` reads stay behind the fields that need them, so an unprovable value that no
  // migration would write does not make the whole object unsafe.
  const canSetGlobals = object.target.kind !== 'story-annotation';
  const migratesViewportDefault =
    canSetGlobals && (t.isStringLiteral(viewportDefault) || t.isMemberExpression(viewportDefault));
  const viewportGlobal = migratesViewportDefault
    ? object.get(['globals', 'viewport', 'value'])
    : undefined;
  const viewportRotated = migratesViewportDefault
    ? object.get(['globals', 'viewport', 'isRotated'])
    : undefined;
  const migratesBackgroundDefault = canSetGlobals && t.isStringLiteral(backgroundDefault);
  const backgroundGlobal = migratesBackgroundDefault
    ? object.get(['globals', 'backgrounds', 'value'])
    : undefined;

  if (csf.mutationDiagnostics.length > diagnosticsBefore) {
    return;
  }

  if (migratesViewportDefault) {
    if (viewportGlobal) {
      object.remove(['parameters', 'viewport', 'defaultViewport']);
    } else {
      object.move(['parameters', 'viewport', 'defaultViewport'], ['globals', 'viewport', 'value']);
      const orientationCanBeMigrated =
        !viewportOrientation ||
        (t.isStringLiteral(viewportOrientation) &&
          (viewportOrientation.value === 'portrait' || viewportOrientation.value === 'landscape'));
      if (!viewportRotated && orientationCanBeMigrated) {
        object.set(
          ['globals', 'viewport', 'isRotated'],
          t.booleanLiteral(
            t.isStringLiteral(viewportOrientation) && viewportOrientation.value === 'portrait'
          )
        );
        object.remove(['parameters', 'viewport', 'defaultOrientation']);
      }
    }
  }
  if (t.isBooleanLiteral(viewportDisable)) {
    if (viewportDisabled) {
      object.remove(['parameters', 'viewport', 'disable']);
    } else {
      object.rename(['parameters', 'viewport', 'disable'], 'disabled');
    }
  }

  if (t.isArrayExpression(backgroundValues) && !backgroundOptions) {
    object.transform(['parameters', 'backgrounds', 'values'], (values) =>
      t.isArrayExpression(values) ? transformValuesToOptions(values) : undefined
    );
    object.rename(['parameters', 'backgrounds', 'values'], 'options');
  }
  if (migratesBackgroundDefault) {
    if (!backgroundGlobal) {
      object.set(
        ['globals', 'backgrounds', 'value'],
        t.stringLiteral(getKeyFromName(options.backgroundsOptions?.values, backgroundDefault.value))
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

  if (!object.changed) {
    return;
  }

  if (options.needsViewportMigration) {
    removeEmptyObject(object, ['parameters', 'viewport']);
  }
  if (options.needsBackgroundsMigration) {
    removeEmptyObject(object, ['parameters', 'backgrounds']);
  }
  removeEmptyObject(object, ['parameters']);
};

const removeEmptyObject = (object: CsfObject, path: readonly string[]) => {
  const value = object.get(path);
  if (t.isObjectExpression(value) && value.properties.length === 0) {
    object.remove(path);
  }
};

import { readFile, writeFile } from 'node:fs/promises';

import { types as t } from 'storybook/internal/babel';
import type {
  ConfigFile,
  CsfFile,
  CsfMutationDiagnostic,
  CsfObject,
} from 'storybook/internal/csf-tools';
import { formatConfig, loadConfig, loadCsf, writeCsf } from 'storybook/internal/csf-tools';

import type { Expression, ObjectExpression } from '@babel/types';

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
  'needsViewportMigration' | 'needsBackgroundsMigration'
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
      if (viewportsOptions?.viewports) {
        // Remove the old viewports property
        previewConfig.removeField(['parameters', 'viewport', 'viewports']);
        previewConfig.setFieldNode(
          ['parameters', 'viewport', 'options'],
          viewportsOptions.viewports
        );
      }

      // If defaultViewport exists, create initialGlobals.viewport
      if (viewportsOptions?.defaultViewport) {
        previewConfig.removeField(['parameters', 'viewport', 'defaultViewport']);

        previewConfig.setFieldValue(
          ['initialGlobals', 'viewport', 'value'],
          viewportsOptions.defaultViewport
        );
        previewConfig.setFieldValue(['initialGlobals', 'viewport', 'isRotated'], false);
      }

      if (typeof viewportsOptions?.disable === 'boolean') {
        const disabled = getFieldNode(['parameters', 'viewport', 'disabled']);
        previewConfig.removeField(['parameters', 'viewport', 'disable']);
        if (!disabled) {
          previewConfig.setFieldValue(
            ['parameters', 'viewport', 'disabled'],
            viewportsOptions.disable
          );
        }
      }
    }

    if (needsBackgroundsMigration) {
      if (backgroundsOptions?.values) {
        const optionsObject = transformValuesToOptions(backgroundsOptions.values);

        // Remove the old values property
        previewConfig.removeField(['parameters', 'backgrounds', 'values']);
        previewConfig.setFieldNode(['parameters', 'backgrounds', 'options'], optionsObject);
      }

      // If default exists, create initialGlobals.backgrounds
      if (backgroundsOptions?.default) {
        previewConfig.removeField(['parameters', 'backgrounds', 'default']);

        previewConfig.setFieldValue(
          ['initialGlobals', 'backgrounds', 'value'],
          backgroundsOptions.default.toLowerCase().replace(/\s+/g, '_')
        );
      }

      if (typeof backgroundsOptions?.disable === 'boolean') {
        const disabled = getFieldNode(['parameters', 'backgrounds', 'disabled']);
        previewConfig.removeField(['parameters', 'backgrounds', 'disable']);
        if (!disabled) {
          previewConfig.setFieldValue(
            ['parameters', 'backgrounds', 'disabled'],
            backgroundsOptions.disable
          );
        }
      }
    }

    let storyResults: StoryTransformResult[] = [];
    if (needsViewportMigration || needsBackgroundsMigration) {
      storyResults = await transformStoryFiles(storiesPaths, {
        needsViewportMigration,
        needsBackgroundsMigration,
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
  const addons = [
    ['viewport', options.needsViewportMigration],
    ['backgrounds', options.needsBackgroundsMigration],
  ] as const;

  for (const [addon, needsMigration] of addons) {
    if (!needsMigration) {
      continue;
    }

    const diagnosticsBefore = csf.mutationDiagnostics.length;
    const parameterPath = ['parameters', addon];
    const defaultPath = [...parameterPath, addon === 'viewport' ? 'defaultViewport' : 'default'];
    const globalPath = ['globals', addon, 'value'];
    const defaultValue = object.get(defaultPath);
    const orientation =
      addon === 'viewport' ? object.get([...parameterPath, 'defaultOrientation']) : undefined;
    const disable = object.get([...parameterPath, 'disable']);
    const disabled = object.get([...parameterPath, 'disabled']);
    const values = addon === 'backgrounds' ? object.get([...parameterPath, 'values']) : undefined;
    const hasOptions = addon === 'backgrounds' && object.get([...parameterPath, 'options']);
    const migrateDefault =
      object.target.kind !== 'story-annotation' &&
      (t.isStringLiteral(defaultValue) ||
        (addon === 'viewport' && t.isMemberExpression(defaultValue)));

    // Reading unrelated globals can report diagnostics for values this migration never writes.
    const globalValue = migrateDefault ? object.get(globalPath) : undefined;
    const rotated =
      migrateDefault && addon === 'viewport'
        ? object.get(['globals', 'viewport', 'isRotated'])
        : undefined;

    if (csf.mutationDiagnostics.length > diagnosticsBefore) {
      return;
    }

    if (t.isArrayExpression(values) && !hasOptions) {
      object.transform([...parameterPath, 'values'], transformValuesToOptions);
      object.rename([...parameterPath, 'values'], 'options');
    }

    if (migrateDefault) {
      if (globalValue) {
        object.remove(defaultPath);
      } else if (addon === 'viewport') {
        object.move(defaultPath, globalPath);
        const canMigrateOrientation =
          !orientation ||
          (t.isStringLiteral(orientation) &&
            (orientation.value === 'portrait' || orientation.value === 'landscape'));
        if (!rotated && canMigrateOrientation) {
          object.set(
            ['globals', 'viewport', 'isRotated'],
            t.booleanLiteral(t.isStringLiteral(orientation) && orientation.value === 'portrait')
          );
          object.remove([...parameterPath, 'defaultOrientation']);
        }
      } else if (t.isStringLiteral(defaultValue)) {
        object.set(
          globalPath,
          t.stringLiteral(defaultValue.value.toLowerCase().replace(/\s+/g, '_'))
        );
        object.remove(defaultPath);
      }
    }

    if (t.isBooleanLiteral(disable)) {
      if (disabled) {
        object.remove([...parameterPath, 'disable']);
      } else {
        object.rename([...parameterPath, 'disable'], 'disabled');
      }
    }
  }
};

const transformValuesToOptions = (values: t.Expression): t.ObjectExpression => {
  const options = t.objectExpression([]);
  if (!t.isArrayExpression(values)) {
    return options;
  }

  for (const element of values.elements) {
    if (!t.isObjectExpression(element)) {
      continue;
    }
    const nameProperty = element.properties.find(
      (property) =>
        t.isObjectProperty(property) &&
        (t.isIdentifier(property.key, { name: 'name' }) ||
          t.isStringLiteral(property.key, { value: 'name' }))
    );
    if (!t.isObjectProperty(nameProperty) || !t.isStringLiteral(nameProperty.value)) {
      continue;
    }
    const name = nameProperty.value;
    const key = name.value.toLowerCase().replace(/\s+/g, '_');
    const keyNode = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(key)
      ? t.identifier(key)
      : t.stringLiteral(name.value);
    options.properties.push(t.objectProperty(keyNode, element));
  }

  return options;
};

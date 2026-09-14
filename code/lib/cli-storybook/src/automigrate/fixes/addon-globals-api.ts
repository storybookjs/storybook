import { readFile, writeFile } from 'node:fs/promises';

import { types as t } from 'storybook/internal/babel';
import type {
  ConfigFile,
  CsfFile,
  CsfMutationDiagnostic,
  CsfObject,
} from 'storybook/internal/csf-tools';
import { formatConfig, loadConfig, loadCsf, writeCsf } from 'storybook/internal/csf-tools';

import type { Fix } from '../types.ts';
import { assertConfigMutationSuccess } from '../helpers/config-object.ts';

interface AddonGlobalsApiOptions {
  previewConfig: ConfigFile;
  previewConfigPath: string;
  needsViewportMigration: boolean;
  needsBackgroundsMigration: boolean;
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

    const checkAddonMigration = (addon: 'viewport' | 'backgrounds') => {
      const path = ['parameters', addon];
      const hasOptions = previewConfig.get([...path, 'options']) !== undefined;
      const values = previewConfig.get([...path, addon === 'viewport' ? 'viewports' : 'values']);
      const defaultValue = previewConfig.get([
        ...path,
        addon === 'viewport' ? 'defaultViewport' : 'default',
      ]);
      return !hasOptions && (values !== undefined || defaultValue !== undefined);
    };

    const needsViewportMigration = checkAddonMigration('viewport');
    const needsBackgroundsMigration = checkAddonMigration('backgrounds');

    if (!needsViewportMigration && !needsBackgroundsMigration) {
      return null;
    }

    assertConfigMutationSuccess(previewConfig);

    return {
      previewConfig,
      previewConfigPath,
      needsViewportMigration,
      needsBackgroundsMigration,
    };
  },

  prompt() {
    return "You're using a deprecated config API for viewport/backgrounds. The globals API will be used instead.";
  },

  async run({ dryRun = false, result, storiesPaths }) {
    const { previewConfig, needsViewportMigration, needsBackgroundsMigration } = result;
    migrateAddonGlobals(previewConfig, previewConfig, result);
    assertConfigMutationSuccess(previewConfig);

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

  const objects = storyConfig.objects();
  for (const object of objects) {
    migrateAddonGlobals(storyConfig, object, options);
  }

  const [diagnostic] = storyConfig.mutationDiagnostics;
  if (diagnostic) {
    return { ok: false, failure: { kind: 'diagnostic', diagnostic } };
  }

  return { ok: true, transformed: storyConfig.changed ? storyConfig : null };
}

const migrateAddonGlobals = (
  csf: CsfFile | ConfigFile,
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
    const isPreview = object.target.kind === 'config';
    const globals = isPreview ? 'initialGlobals' : 'globals';
    const globalPath = [globals, addon, 'value'];
    const defaultValue = object.get(defaultPath);
    const orientation =
      addon === 'viewport' && !isPreview
        ? object.get([...parameterPath, 'defaultOrientation'])
        : undefined;
    const valuesPath = [...parameterPath, addon === 'viewport' ? 'viewports' : 'values'];
    const values = addon === 'backgrounds' || isPreview ? object.get(valuesPath) : undefined;
    const hasOptions =
      (addon === 'backgrounds' || isPreview) && object.get([...parameterPath, 'options']);
    const migrateDefault =
      (!isPreview || !hasOptions) &&
      object.target.kind !== 'story-annotation' &&
      (t.isStringLiteral(defaultValue) ||
        (addon === 'viewport' && t.isMemberExpression(defaultValue)));

    // Reading unrelated globals can report diagnostics for values this migration never writes.
    const globalValue = migrateDefault ? object.get(globalPath) : undefined;
    const rotated =
      migrateDefault && addon === 'viewport'
        ? object.get([globals, 'viewport', 'isRotated'])
        : undefined;

    if (csf.mutationDiagnostics.length > diagnosticsBefore) {
      return;
    }

    if (values && !hasOptions) {
      if (addon === 'backgrounds' && t.isArrayExpression(values)) {
        object.transform(valuesPath, transformValuesToOptions);
        object.rename(valuesPath, 'options');
      } else if (addon === 'viewport' && isPreview) {
        object.rename(valuesPath, 'options');
      }
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
            [globals, 'viewport', 'isRotated'],
            t.isStringLiteral(orientation) && orientation.value === 'portrait'
          );
          if (!isPreview) {
            object.remove([...parameterPath, 'defaultOrientation']);
          }
        }
      } else if (t.isStringLiteral(defaultValue)) {
        object.set(globalPath, defaultValue.value.toLowerCase().replace(/\s+/g, '_'));
        object.remove(defaultPath);
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

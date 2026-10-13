import {
  type ConfigFile,
  isCsfFactoryPreview,
  parseExpression,
  readConfig,
  writeConfig,
} from 'storybook/internal/csf-tools';
import { logger } from 'storybook/internal/node-logger';
import type { StorybookConfig } from 'storybook/internal/types';

import picocolors from 'picocolors';

import { getAddonAnnotations } from './get-addon-annotations.ts';
import { getAddonNames } from './get-addon-names.ts';

export async function syncStorybookAddons(
  mainConfig: StorybookConfig,
  previewConfigPath: string,
  configDir: string
) {
  const previewConfig = await readConfig(previewConfigPath);
  const modifiedConfig = await syncPreviewAddonsWithMainConfig(
    mainConfig,
    previewConfig,
    configDir
  );

  await writeConfig(modifiedConfig);
}

export async function syncPreviewAddonsWithMainConfig(
  mainConfig: StorybookConfig,
  previewConfig: ConfigFile,
  configDir: string
): Promise<ConfigFile> {
  const isCsfFactory = isCsfFactoryPreview(previewConfig);

  if (!isCsfFactory) {
    return previewConfig;
  }
  const existingAddons = previewConfig.getFieldNode(['addons']);

  if (!existingAddons) {
    previewConfig.set(['addons'], []);
  }

  const addons = getAddonNames(mainConfig);
  if (!addons) {
    return previewConfig;
  }

  const syncedAddons: string[] = [];
  /**
   * This goes through all mainConfig.addons, read their package.json and check whether they have an
   * exports map called preview, if so add to the array
   */
  for (const addon of addons) {
    const annotations = await getAddonAnnotations(addon, configDir);
    if (annotations) {
      const hasAlreadyImportedAddonAnnotations = previewConfig._program.body.find(
        (node) => node.type === 'ImportDeclaration' && node.source.value === annotations.importPath
      );

      if (hasAlreadyImportedAddonAnnotations) {
        continue;
      }

      if (
        !existingAddons ||
        (existingAddons.type === 'ArrayExpression' &&
          !existingAddons.elements.some(
            (element) => element?.type === 'Identifier' && element.name === annotations.importName
          ))
      ) {
        syncedAddons.push(addon);
        // addon-essentials is a special use case that won't have /preview entrypoint but rather /entry-preview
        if (annotations.isCoreAddon) {
          // import addonName from 'addon'; + addonName()
          previewConfig.setImport(annotations.importName, annotations.importPath);
          previewConfig.appendNodeToArray(
            ['addons'],
            parseExpression(`${annotations.importName}()`)
          );
        } else {
          // import * as addonName from 'addon/preview'; + addonName
          previewConfig.setImport({ namespace: annotations.importName }, annotations.importPath);
          previewConfig.appendNodeToArray(['addons'], parseExpression(annotations.importName));
        }
      }
    }
  }

  if (syncedAddons.length > 0) {
    logger.log(
      `Synchronizing addons from main config in ${picocolors.cyan(previewConfig.fileName)}:\n${syncedAddons.map(picocolors.magenta).join(', ')}`
    );
  }

  return previewConfig;
}

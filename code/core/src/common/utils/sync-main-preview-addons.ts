import { types as t } from 'storybook/internal/babel';
import {
  type ConfigFile,
  isCsfFactoryPreview,
  readConfig,
  writeConfig,
} from 'storybook/internal/csf-tools';
import { logger } from 'storybook/internal/node-logger';
import type { StorybookConfig } from 'storybook/internal/types';

import picocolors from 'picocolors';

import { getAddonAnnotations } from './get-addon-annotations';
import { getAddonNames } from './get-addon-names';

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
    previewConfig.setFieldNode(['addons'], t.arrayExpression([]));
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
      const hasAlreadyImportedAddonAnnotations = previewConfig._ast.program.body.find(
        (node) => t.isImportDeclaration(node) && node.source.value === annotations.importPath
      );

      if (hasAlreadyImportedAddonAnnotations) {
        continue;
      }

      if (
        !existingAddons ||
        (t.isArrayExpression(existingAddons) &&
          !existingAddons.elements.some(
            (element) => t.isIdentifier(element) && element.name === annotations.importName
          ))
      ) {
        syncedAddons.push(addon);
        // addon-essentials is a special use case that won't have /preview entrypoint but rather /entry-preview
        if (annotations.isCoreAddon) {
          // import addonName from 'addon'; + addonName()
          previewConfig.setImport(annotations.importName, annotations.importPath);
          previewConfig.appendNodeToArray(
            ['addons'],
            t.callExpression(t.identifier(annotations.importName), [])
          );
        } else {
          // import * as addonName from 'addon/preview'; + addonName
          previewConfig.setImport({ namespace: annotations.importName }, annotations.importPath);
          previewConfig.appendNodeToArray(['addons'], t.identifier(annotations.importName));
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

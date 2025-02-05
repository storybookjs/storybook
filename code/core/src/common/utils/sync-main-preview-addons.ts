/* eslint-disable no-underscore-dangle */
import { types as t } from '@storybook/core/babel';
import type { StorybookConfig } from '@storybook/types';

import {
  type ConfigFile,
  isCsfFactoryPreview,
  readConfig,
  writeConfig,
} from '@storybook/core/csf-tools';

import picocolors from 'picocolors';

import { getAddonAnnotations } from './get-addon-annotations';
import { getAddonNames } from './get-addon-names';

const logger = console;

export async function syncStorybookAddons(mainConfig: StorybookConfig, previewConfigPath: string) {
  const previewConfig = await readConfig(previewConfigPath!);
  const modifiedConfig = await getSyncedStorybookAddons(mainConfig, previewConfig);

  await writeConfig(modifiedConfig);
}

export async function getSyncedStorybookAddons(
  mainConfig: StorybookConfig,
  previewConfig: ConfigFile
): Promise<ConfigFile> {
  const isCsfFactory = isCsfFactoryPreview(previewConfig);

  if (!isCsfFactory) {
    return previewConfig;
  }

  const addons = getAddonNames(mainConfig);
  if (!addons) {
    return previewConfig;
  }

  const syncedAddons: string[] = [];
  const existingAddons = previewConfig.getFieldNode(['addons']);
  /**
   * This goes through all mainConfig.addons, read their package.json and check whether they have an
   * exports map called preview, if so add to the array
   */
  await addons.forEach(async (addon) => {
    const annotations = await getAddonAnnotations(addon);
    if (annotations) {
      const hasAlreadyImportedAddonAnnotations = previewConfig._ast.program.body.find(
        (node) => t.isImportDeclaration(node) && node.source.value === annotations.importPath
      );

      if (!!hasAlreadyImportedAddonAnnotations) {
        return;
      }

      if (
        !existingAddons ||
        (t.isArrayExpression(existingAddons) &&
          !existingAddons.elements.some(
            (element) => t.isIdentifier(element) && element.name === annotations.importName
          ))
      ) {
        syncedAddons.push(addon);
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
  });

  if (syncedAddons.length > 0) {
    logger.info(
      `Synchronizing addons from main config in ${picocolors.cyan(previewConfig.fileName)}:\n${syncedAddons.map(picocolors.magenta).join(', ')}`
    );
  }

  return previewConfig;
}

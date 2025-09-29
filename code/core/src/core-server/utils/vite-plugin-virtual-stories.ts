import { existsSync } from 'node:fs';
import { join } from 'node:path';

import {
  extractProperRendererNameFromFramework,
  getFrameworkName,
  getProjectRoot,
} from 'storybook/internal/common';
import type { Options, SupportedRenderers } from 'storybook/internal/types';

import type { PluginOption } from 'vite';

import { createIndexEntries, getComponentFileInfos } from './component-file-indexer';
import { getNewStoryFile } from './get-new-story-file';

interface VirtualStoriesPluginOptions {
  /** Storybook options for framework detection and configuration */
  storybookOptions: Options;
}

/**
 * Vite plugin that transforms virtual story imports into actual story content
 *
 * Virtual import format: `virtual:virtual-stories--${relativePath}--${componentName}`
 *
 * This plugin:
 *
 * 1. Intercepts virtual imports starting with 'virtual:virtual-stories--'
 * 2. Extracts the file path and component name from the import
 * 3. Uses getNewStoryFile logic to generate appropriate story content
 * 4. Returns the generated story content as a module
 */
export function virtualStoriesPlugin(options: VirtualStoriesPluginOptions) {
  return {
    name: 'vite-plugin-virtual-stories',

    async load(id) {
      // Only handle virtual story imports
      if (!id.startsWith('virtual:virtual-stories--')) {
        return;
      }

      console.log('load', id);

      try {
        // Parse the virtual import path
        // Format: virtual:virtual-stories--${relativePath}--${componentName}
        const parts = id.split('--');
        if (parts.length < 3) {
          console.warn(`Invalid virtual story import format: ${id}`);
          return;
        }

        // Reconstruct the relative path (everything between 'virtual:virtual-stories--' and the last '--')
        const relativePath = parts.slice(1, -1).join('--');
        const componentName = parts[parts.length - 1];

        // Convert relative path to absolute path
        const projectRoot = getProjectRoot();
        const componentFilePath = join(projectRoot, relativePath);

        // Check if the component file exists
        if (!existsSync(componentFilePath)) {
          console.warn(`Component file not found: ${componentFilePath}`);
          return;
        }

        // Generate story content using the same logic as getNewStoryFile
        const storyContent = await generateVirtualStoryContent(
          componentFilePath,
          componentName,
          options.storybookOptions
        );

        return storyContent;
      } catch (error) {
        console.error(`Error generating virtual story for ${id}:`, error);
        return;
      }
    },
  } satisfies PluginOption;
}

/** Generate story content for a virtual story using getNewStoryFile */
async function generateVirtualStoryContent(
  componentFilePath: string,
  componentName: string,
  options: Options
): Promise<string> {
  // Convert absolute path to relative path for getNewStoryFile
  const projectRoot = getProjectRoot();
  const relativePath = componentFilePath.replace(projectRoot + '/', '');

  // Determine export information using the component file indexer
  const exportInfo = await getComponentExportInfo(componentFilePath, componentName, options);
  const componentIsDefaultExport = exportInfo.isDefaultExport;
  const componentExportCount = exportInfo.exportCount;

  // Use getNewStoryFile to generate the story content
  const { storyFileContent } = await getNewStoryFile(
    {
      componentFilePath: relativePath,
      componentExportName: componentName,
      componentIsDefaultExport,
      componentExportCount,
    },
    options
  );

  return storyFileContent;
}

/** Get component export information using the existing component file indexer */
async function getComponentExportInfo(
  componentFilePath: string,
  componentName: string,
  options: Options
): Promise<{ isDefaultExport: boolean; exportCount: number }> {
  try {
    // Get the renderer name for the parser
    const frameworkName = await getFrameworkName(options);
    const rendererName = (await extractProperRendererNameFromFramework(
      frameworkName
    )) as SupportedRenderers;

    // Convert absolute path to relative path for the component file indexer
    const projectRoot = getProjectRoot();
    const relativePath = componentFilePath.replace(projectRoot + '/', '');

    // Use the existing component file indexer to get file info
    const fileInfos = await getComponentFileInfos([relativePath], rendererName);
    const indexEntries = createIndexEntries(fileInfos);

    // Find the specific component export
    const componentEntry = indexEntries.find((entry) => entry.componentName === componentName);
    if (!componentEntry) {
      // Fallback: assume it's a named export
      return { isDefaultExport: false, exportCount: indexEntries.length || 1 };
    }

    return {
      isDefaultExport: componentEntry.isDefaultExport,
      exportCount: indexEntries.length,
    };
  } catch (error) {
    // Fallback: assume it's a named export
    console.warn(`Failed to parse component file ${componentFilePath}:`, error);
    return { isDefaultExport: false, exportCount: 1 };
  }
}

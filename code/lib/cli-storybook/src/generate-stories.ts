import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';

import { JsPackageManagerFactory } from 'storybook/internal/common';
import { experimental_loadStorybook, generateStoryFile } from 'storybook/internal/core-server';
import { logger } from 'storybook/internal/node-logger';
import type { Options } from 'storybook/internal/types';

// eslint-disable-next-line depend/ban-dependencies
import { glob } from 'glob';

import { getCandidatesForStorybook } from '../../../core/src/core-server/utils/ghost-stories/get-candidates';

interface GenerateStoriesOptions {
  glob: string;
  interactive?: boolean;
  configDir?: string;
  sampleComponents?: number;
  force?: boolean;
}

interface ComponentInfo {
  filePath: string;
  exportName: string;
  isDefaultExport: boolean;
  exportCount: number;
}

export const generateStories = async ({
  glob: globPattern,

  configDir = '.storybook',
  sampleComponents,
  force = false,
}: GenerateStoriesOptions) => {
  logger.debug(`Starting story generation with glob: ${globPattern}`);
  logger.debug(`Config dir: ${configDir}`);
  try {
    // Load Storybook configuration
    logger.debug('Loading Storybook configuration...');
    const options = await experimental_loadStorybook({
      configDir,
      packageJson: JsPackageManagerFactory.getPackageManager({
        configDir,
      }).primaryPackageJson,
    });

    logger.debug('Storybook configuration loaded successfully');

    // Load Storybook configuration
    logger.debug('Loading Storybook configuration...');

    const files = await glob(globPattern, {
      cwd: process.cwd(),
      absolute: true,
      ignore: [
        '**/node_modules/**',
        '**/.git/**',
        '**/dist/**',
        '**/__mocks__/**',
        '**/build/**',
        '**/storybook-static/**',
        '**/*.stories.*',
        '**/*.test.*',
        '**/*.d.*',
        '**/*.config.*',
        '**/*.spec.*',
      ],
    });

    const { candidates } = await getCandidatesForStorybook(files, sampleComponents ?? 20);

    // Extract component information from files
    logger.debug('Extracting component information from files...');
    const components = await extractComponentsFromFiles(candidates);

    logger.debug(`Extracted ${components.length} components from files`);

    if (components.length === 0) {
      logger.warn('No components found in the matched files');
      return {
        success: true,
        generated: 0,
        skipped: 0,
        failed: 0,
      };
    }

    // Filter components interactively if requested
    const selectedComponents = components;

    // Generate stories for selected components
    logger.debug('Generating stories for selected components...');
    const results = await generateStoriesForComponents(selectedComponents, options, force);

    // Report results
    const { generated, skipped, failed } = results;
    logger.info(`Story generation completed:`);
    logger.info(`  ✅ Generated: ${generated}`);
    logger.info(`  ⏭️  Skipped: ${skipped}`);
    logger.info(`  ❌ Failed: ${failed}`);

    return {
      success: failed === 0,
      generated,
      skipped,
      failed,
    };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`Failed to generate stories: ${errorMessage}`);
    logger.debug(`Full error: ${error}`);
    return {
      success: false,
      generated: 0,
      skipped: 0,
      failed: 1,
      error: errorMessage,
    };
  }
};

async function extractComponentsFromFiles(files: string[]): Promise<ComponentInfo[]> {
  const components: ComponentInfo[] = [];

  for (const file of files) {
    logger.debug(`Analyzing file: ${file}`);
    try {
      const componentInfo = await analyzeComponentFile(file);
      if (componentInfo) {
        components.push(...componentInfo);
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.debug(`Failed to analyze ${file}: ${errorMessage}`);
    }
  }

  return components;
}

async function analyzeComponentFile(filePath: string): Promise<ComponentInfo[] | null> {
  const { readFile } = await import('node:fs/promises');
  const { basename, extname } = await import('node:path');

  try {
    const content = await readFile(filePath, 'utf-8');

    // Simple regex-based analysis for component exports
    const components: ComponentInfo[] = [];

    // Check for default export
    const defaultExportMatch = content.match(
      /export\s+default\s+(?:function\s+|const\s+|class\s+)?([A-Z][a-zA-Z0-9]*)/
    );
    if (defaultExportMatch) {
      components.push({
        filePath,
        exportName: defaultExportMatch[1],
        isDefaultExport: true,
        exportCount: 1, // We'll update this below
      });
    }

    // Check for named exports
    const namedExportMatches = content.matchAll(
      /export\s+(?:const|function|class)\s+([A-Z][a-zA-Z0-9]*)/g
    );
    for (const match of namedExportMatches) {
      const exportName = match[1];
      // Skip if we already have this as a default export
      if (!components.some((c) => c.exportName === exportName && c.isDefaultExport)) {
        components.push({
          filePath,
          exportName,
          isDefaultExport: false,
          exportCount: 1, // We'll update this below
        });
      }
    }

    // Count total exports
    const exportCount = (
      content.match(/export\s+(?:default|const|function|class|{|interface|type)/g) || []
    ).length;

    // Update export count for all components in this file
    components.forEach((comp) => {
      comp.exportCount = exportCount;
    });

    // If no components found but it's a component file (based on naming convention), assume a default export
    if (components.length === 0) {
      const fileName = basename(filePath, extname(filePath));
      // Check if it looks like a component file (starts with capital letter)
      if (/^[A-Z]/.test(fileName)) {
        components.push({
          filePath,
          exportName: fileName,
          isDefaultExport: true,
          exportCount: 1,
        });
      }
    }

    return components.length > 0 ? components : null;
  } catch (error) {
    logger.debug(`Error reading file ${filePath}: ${error}`);
    return null;
  }
}

// We don't want to generate story files for files which already have stories for
function doesAnyStoryFileExist(componentDir: string, componentName: string): boolean {
  const extensions = ['ts', 'tsx', 'js', 'jsx'];

  for (const ext of extensions) {
    if (existsSync(join(componentDir, `${componentName}.stories.${ext}`))) {
      return true;
    }
    if (existsSync(join(componentDir, `${componentName}.story.${ext}`))) {
      return true;
    }
  }

  return false;
}

async function generateStoriesForComponents(
  components: ComponentInfo[],
  options: Options,
  force?: boolean
): Promise<{ generated: number; skipped: number; failed: number }> {
  let generated = 0;
  let skipped = 0;
  let failed = 0;

  for (const component of components) {
    logger.debug(`Generating story for ${component.filePath} - ${component.exportName}`);

    const componentDir = dirname(component.filePath);

    // Check if any story file already exists for this component
    if (doesAnyStoryFileExist(componentDir, component.exportName) && !force) {
      skipped++;
      logger.info(
        `⏭️  Skipped (story already exists for ${component.exportName}): ${component.filePath}`
      );
      continue;
    }

    try {
      const result = await generateStoryFile(
        {
          componentFilePath: component.filePath,
          componentExportName: component.exportName,
          componentIsDefaultExport: component.isDefaultExport,
          componentExportCount: component.exportCount,
        },
        options,
        { checkFileExists: true, ignoreStoryId: true }
      );

      if (result.success) {
        generated++;
        logger.info(`✅ Generated story: ${result.storyFilePath}`);
      } else if (result.errorType === 'STORY_FILE_EXISTS') {
        skipped++;
        logger.info(`⏭️  Skipped (already exists): ${result.storyFilePath}`);
      } else {
        failed++;
        logger.error(`❌ Failed to generate story for ${component.filePath}: ${result.error}`);
      }
    } catch (error: unknown) {
      failed++;
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(`❌ Failed to generate story for ${component.filePath}: ${errorMessage}`);
      logger.debug(`Full error: ${error}`);
    }
  }

  return { generated, skipped, failed };
}

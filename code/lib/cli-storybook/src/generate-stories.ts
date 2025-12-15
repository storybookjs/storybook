import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

import { experimental_loadStorybook, generateStoryFile } from 'storybook/internal/core-server';
import { logger } from 'storybook/internal/node-logger';
import { prompt } from 'storybook/internal/node-logger';
import type { Options } from 'storybook/internal/types';

import { getComponentComplexity } from '@hipster/sb-utils/component-analyzer';
// eslint-disable-next-line depend/ban-dependencies
import { glob } from 'glob';

async function findEasyToStorybookComponents(files: string[], sampleComponents: number) {
  const candidates = [];

  for (const file of files) {
    try {
      const analysis = await getComponentComplexity(file);
      const { low, high } = analysis.features;

      // 2. APPLY FILTERS
      // We want components that are "Pure" and isolated.

      // CRITICAL BLOCKERS: These almost always require Storybook decorators with providers
      if (
        high.hasAuthIntegration ||
        high.hasDataFetching ||
        high.hasRouting ||
        high.hasComplexState
      ) {
        continue;
      }

      // PREFERENCE: 'Design System' components are usually just props -> UI
      // But 'Feature' components might be okay if they are simple enough
      // Pages are too big
      if (analysis.type === 'page') {
        continue;
      }

      // METRIC CHECKS:
      // If it imports 10+ internal files, it's probably complex
      if (low.imports.internal.length > 10) {
        continue;
      }

      // If it's "Ultra" complex, it probably has hidden side effects
      if (analysis.level === 'very-high') {
        continue;
      }

      logger.debug(`Found easy to Storybook component: ${file}`);
      logger.debug(`Factors: ${analysis.factors.join(', ')}`);

      // If we got here, it's a great candidate!
      candidates.push({
        file,
        score: analysis.score,
      });
    } catch (e) {
      logger.error(`Failed to analyze ${file}: ${e}`);
    }
  }

  // Get top 10 simplest components, easiest first
  return candidates
    .sort((a, b) => a.score - b.score)
    .slice(0, sampleComponents)
    .map((c) => c.file);
}

interface GenerateStoriesOptions {
  glob: string;
  interactive?: boolean;
  configDir?: string;
  sampleComponents?: number;
}

interface ComponentInfo {
  filePath: string;
  exportName: string;
  isDefaultExport: boolean;
  exportCount: number;
}

export const generateStories = async ({
  glob: globPattern,
  interactive = false,
  configDir = '.storybook',
  sampleComponents,
}: GenerateStoriesOptions) => {
  logger.debug(`Starting story generation with glob: ${globPattern}`);
  logger.debug(`Interactive mode: ${interactive}`);
  logger.debug(`Config dir: ${configDir}`);

  try {
    // Load Storybook configuration
    logger.debug('Loading Storybook configuration...');
    const options = await experimental_loadStorybook({
      configDir,
    });

    logger.debug('Storybook configuration loaded successfully');

    let files: string[] = [];

    if (interactive) {
      logger.debug('Starting interactive component selection...');
      files = (await prompt.fileSystemTreeSelect({
        message: 'Select components to generate stories for:',
        multiple: true,
        glob: globPattern,
        root: process.cwd(),
      })) as string[];
      logger.debug(`User selected ${files.length} files`);
    } else {
      // Find files matching the glob pattern
      logger.debug('Finding files matching glob pattern...');
      files = await glob(globPattern, {
        cwd: process.cwd(),
        absolute: true,
        ignore: [
          '**/node_modules/**',
          '**/.git/**',
          '**/dist/**',
          '**/build/**',
          '**/storybook-static/**',
          '**/*.stories.*',
          '**/*.test.*',
          '**/*.spec.*',
        ],
      });

      logger.debug(`Found ${files.length} files matching glob pattern`);
    }

    // Filter out barrel files that only export other files
    files = await filterOutBarrelFiles(files);

    if (files.length === 0) {
      logger.warn(`No files found matching glob pattern: ${globPattern}`);
      return {
        success: true,
        generated: 0,
        skipped: 0,
        failed: 0,
      };
    }

    if (sampleComponents) {
      logger.debug('Filtering out easy to Storybook components...');
      files = await findEasyToStorybookComponents(files, sampleComponents);
      logger.debug(`Found ${files.length} easy to Storybook components`);
    }

    // Extract component information from files
    logger.debug('Extracting component information from files...');
    const components = await extractComponentsFromFiles(files);

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
    const results = await generateStoriesForComponents(selectedComponents, options);

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

async function filterOutBarrelFiles(files: string[]) {
  const filteredFiles = [];
  for (const file of files) {
    if (file.includes('index')) {
      const content = await readFile(file, 'utf-8');
      if (!content.includes('export * from')) {
        filteredFiles.push(file);
      }
    } else {
      filteredFiles.push(file);
    }
  }
  return filteredFiles;
}

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
  options: Options
): Promise<{ generated: number; skipped: number; failed: number }> {
  let generated = 0;
  let skipped = 0;
  let failed = 0;

  for (const component of components) {
    logger.debug(`Generating story for ${component.filePath} - ${component.exportName}`);

    const componentDir = dirname(component.filePath);

    // Check if any story file already exists for this component
    if (doesAnyStoryFileExist(componentDir, component.exportName)) {
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
        { checkFileExists: true }
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

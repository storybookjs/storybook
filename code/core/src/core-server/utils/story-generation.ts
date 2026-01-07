import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

import type { types as t } from 'storybook/internal/babel';
import { babelParse, traverse } from 'storybook/internal/babel';
import { JsPackageManagerFactory } from 'storybook/internal/common';
import type { GeneratedStoryInfo } from 'storybook/internal/core-events';
import { experimental_loadStorybook, generateStoryFile } from 'storybook/internal/core-server';
import { logger } from 'storybook/internal/node-logger';
import type { Options } from 'storybook/internal/types';

// import { getComponentComplexity } from '@hipster/sb-utils/component-analyzer';
// eslint-disable-next-line depend/ban-dependencies
import { glob } from 'glob';

interface ComponentCandidate {
  file: string;
  score: number;
}

interface ComponentInfo {
  filePath: string;
  exportName: string;
  isDefaultExport: boolean;
  exportCount: number;
}

function braceDelta(line: string): number {
  // Lightweight heuristic: count braces without trying to parse strings/comments.
  // This is "good enough" for typical type/interface blocks.
  let delta = 0;
  for (const ch of line) {
    if (ch === '{') {
      delta += 1;
    } else if (ch === '}') {
      delta -= 1;
    }
  }
  return delta;
}
function countNonEmptyRuntimeLines(lines: string[]): number {
  // Excludes top-level TypeScript-only declarations that often bloat LOC:
  // - type Foo = ...
  // - interface Foo { ... }
  // - export type { Foo } from '...'
  //
  // Heuristic approach (no TS compiler API at runtime).
  const TYPE_OR_INTERFACE_DECL_RE =
    /^\s*(export\s+)?(declare\s+)?(type|interface)\s+[A-Za-z_$][\w$]*/;
  const TYPE_ONLY_EXPORT_RE = /^\s*export\s+type\s*\{/;

  let nonEmptyRuntimeLines = 0;
  let inTypeBlock = false;
  let typeBraceDepth = 0;

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed.length === 0) {
      continue;
    }

    // Exclude type-only export lines (no runtime impact).
    if (!inTypeBlock && TYPE_ONLY_EXPORT_RE.test(trimmed)) {
      continue;
    }

    if (!inTypeBlock && TYPE_OR_INTERFACE_DECL_RE.test(trimmed)) {
      inTypeBlock = true;
      typeBraceDepth += braceDelta(trimmed);

      // End immediately for one-liners like:
      // - interface X {}
      // - type X = { ... }
      // - type X = Foo | Bar;
      const endsWithSemicolon = /;\s*$/.test(trimmed);
      const endsWithClosingBrace = /}\s*;?\s*$/.test(trimmed);
      const oneLineBraceBlock = trimmed.includes('{') && trimmed.includes('}');
      if (typeBraceDepth <= 0 && (endsWithSemicolon || endsWithClosingBrace || oneLineBraceBlock)) {
        inTypeBlock = false;
        typeBraceDepth = 0;
      }
      continue;
    }

    if (inTypeBlock) {
      typeBraceDepth += braceDelta(trimmed);
      const endsWithSemicolon = /;\s*$/.test(trimmed);
      const endsWithClosingBrace = /}\s*;?\s*$/.test(trimmed);
      if (typeBraceDepth <= 0 && (endsWithSemicolon || endsWithClosingBrace)) {
        inTypeBlock = false;
        typeBraceDepth = 0;
      }
      continue;
    }

    nonEmptyRuntimeLines += 1;
  }

  return nonEmptyRuntimeLines;
}

const getComponentComplexity = async (file: string): Promise<number> => {
  const fileContent = await readFile(file, 'utf-8');
  const lines = fileContent.split('\n');
  const nonEmptyRuntimeLines = countNonEmptyRuntimeLines(lines);

  // Simple check for imports, good enough for our purposes
  const importCount = lines.filter((line: string) => line.trim().startsWith('import')).length;

  // Simple scoring: prioritize file with fewer nonEmptyRuntimeLines and fewer imports.
  // loc = nonEmptyLines, importCount = number of imports, score is inverse of complexity
  // (lower loc/imports = higher score)
  // formula: score = 1 / (1 + nonEmptyRuntimeLines + importCount)
  const score = 1 / (1 + nonEmptyRuntimeLines + importCount);

  return score;
};

async function findEasyToStorybookComponents(
  files: string[],
  sampleComponents: number
): Promise<ComponentCandidate[]> {
  const candidates: ComponentCandidate[] = [];

  for (const file of files) {
    try {
      logger.debug(`Analyzing component complexity: ${file}`);
      const score = await getComponentComplexity(file);
      candidates.push({
        file,
        score,
      });
    } catch (e) {
      logger.error(`Failed to analyze ${file}: ${e}`);
    }
  }

  // Get top N simplest components, easiest first
  return candidates.sort((a, b) => a.score - b.score).slice(0, sampleComponents);
}

// Check whether the file contains React code and at least something is exported
function isValidCandidate(ast: t.File): boolean {
  let hasJSX = false;
  let hasExport = false;

  traverse(ast, {
    JSXElement(path) {
      hasJSX = true;

      if (hasExport) {
        path.stop();
      }
    },
    JSXFragment(path) {
      hasJSX = true;

      if (hasExport) {
        path.stop();
      }
    },
    ExportNamedDeclaration(path) {
      hasExport = true;

      if (hasJSX) {
        path.stop();
      }
    },
    ExportDefaultDeclaration(path) {
      hasExport = true;

      if (hasJSX) {
        path.stop();
      }
    },
    ExportAllDeclaration(path) {
      hasExport = true;

      if (hasJSX) {
        path.stop();
      }
    },
  });

  return hasJSX && hasExport;
}

export async function filterOutNonReactFiles(files: string[]): Promise<string[]> {
  const result: string[] = [];

  for (const file of files) {
    let source: string;

    try {
      source = await readFile(file, 'utf-8');
    } catch {
      continue;
    }

    let ast: t.File;
    try {
      ast = babelParse(source);
    } catch {
      // Invalid JS/TS/Flow — treat as non-React
      continue;
    }

    if (isValidCandidate(ast)) {
      result.push(file);
    }
  }

  return result;
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
  options: Options,
  force?: boolean
): Promise<{
  generated: number;
  skipped: number;
  failed: number;
  stories: GeneratedStoryInfo[];
}> {
  let generated = 0;
  let skipped = 0;
  let failed = 0;
  const stories: Array<{
    storyId: string;
    storyFilePath: string;
    componentName: string;
    componentFilePath: string;
  }> = [];

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
          tags: ['auto-generated', '!dev'],
        },
        options,
        { checkFileExists: true }
      );

      if (result.success) {
        generated++;
        logger.info(`✅ Generated story: ${result.storyFilePath}`);
        stories.push({
          storyId: result.storyId!,
          storyFilePath: result.storyFilePath!,
          componentName: component.exportName,
          componentFilePath: component.filePath,
        });
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

  return { generated, skipped, failed, stories };
}

export async function getComponentCandidates({
  sampleSize = 20,
  globPattern = '**/*.{ts,tsx,js,jsx}',
}: {
  sampleSize?: number;
  globPattern?: string;
}): Promise<{
  candidates: ComponentCandidate[];
  error?: string;
  matchCount: number;
}> {
  logger.debug(`Starting story sampling with glob: ${globPattern}`);
  logger.debug(`Sample size: ${sampleSize}`);
  let matchCount = 0;

  try {
    let files: string[] = [];

    // Find files matching the glob pattern
    logger.debug('Finding files matching glob pattern...');
    files = await glob(globPattern, {
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

    logger.debug(`Found ${files.length} files matching glob pattern`);

    matchCount = files.length;

    // Filter out non-react files
    files = await filterOutNonReactFiles(files);
    console.log('actual react files:', files.length);

    if (files.length === 0) {
      logger.warn(`No files found matching glob pattern: ${globPattern}`);
      return {
        candidates: [],
        matchCount,
      };
    }

    let candidates: ComponentCandidate[] = [];
    if (sampleSize > 0) {
      logger.debug('Filtering out easy to Storybook components...');
      candidates = await findEasyToStorybookComponents(files, sampleSize);
      files = candidates.map((c) => c.file);
      logger.debug(`Found ${files.length} easy to Storybook components`);
      logger.debug(`Files: ${files.join('\n')}`);
    }

    return {
      candidates,
      matchCount,
    };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`Failed to find candidates: ${errorMessage}`);
    logger.debug(`Full error: ${error}`);
    return {
      candidates: [],
      error: errorMessage,
      matchCount,
    };
  }
}

export async function generateSampledStories({
  sampleSize = 20,
  globPattern = '**/*.{ts,tsx,js,jsx}',
  options,
}: {
  sampleSize?: number;
  globPattern?: string;
  options: Options;
}): Promise<{
  success: boolean;
  generatedStories: GeneratedStoryInfo[];
  error?: string;
  matchCount: number;
}> {
  logger.debug(`Starting story generation with glob: ${globPattern}`);
  logger.debug(`Sample size: ${sampleSize}`);
  let matchCount = 0;

  try {
    // Load Storybook configuration
    logger.debug('Loading Storybook configuration...');
    const storybookOptions = await experimental_loadStorybook({
      configDir: options.configDir,
      packageJson: JsPackageManagerFactory.getPackageManager({
        configDir: options.configDir,
      }).primaryPackageJson,
    });

    logger.debug('Storybook configuration loaded successfully');

    let files: string[] = [];

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
        '**/*.d.*',
        '**/*.config.*',
        '**/*.spec.*',
      ],
    });

    logger.debug(`Found ${files.length} files matching glob pattern`);

    matchCount = files.length;

    // Filter out barrel files
    files = await filterOutNonReactFiles(files);

    if (files.length === 0) {
      logger.warn(`No files found matching glob pattern: ${globPattern}`);
      return {
        success: true,
        generatedStories: [],
        matchCount,
      };
    }

    if (sampleSize > 0) {
      logger.debug('Filtering out easy to Storybook components...');
      const candidates = await findEasyToStorybookComponents(files, sampleSize);
      files = candidates.map((c) => c.file);
      logger.debug(`Found ${files.length} easy to Storybook components`);
    }

    // Extract component information from files
    logger.debug('Extracting component information from files...');
    const components = await extractComponentsFromFiles(files);

    if (components.length === 0) {
      logger.debug('No components found in the matched files');
      return {
        success: true,
        generatedStories: [],
        matchCount,
      };
    }

    logger.debug(`Extracted ${components.length} components from files`);

    // Generate stories for selected components
    logger.debug('Generating stories for selected components...');
    const results = await generateStoriesForComponents(components, storybookOptions, false);

    // Report results
    const { generated, skipped, failed, stories } = results;
    logger.info(`Story generation completed:`);
    logger.info(`  ✅ Generated: ${generated}`);
    logger.info(`  ⏭️  Skipped: ${skipped}`);
    logger.info(`  ❌ Failed: ${failed}`);

    return {
      success: failed === 0,
      generatedStories: stories,
      matchCount,
    };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`Failed to generate stories: ${errorMessage}`);
    logger.debug(`Full error: ${error}`);
    return {
      success: false,
      generatedStories: [],
      error: errorMessage,
      matchCount,
    };
  }
}

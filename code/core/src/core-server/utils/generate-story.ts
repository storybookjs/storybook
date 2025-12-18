import { existsSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { relative } from 'node:path';

import { formatFileContent, getStoryId } from 'storybook/internal/common';
import type { CreateNewStoryRequestPayload } from 'storybook/internal/core-events';
import type { Options } from 'storybook/internal/types';

import { getNewStoryFile } from './get-new-story-file';

export interface GenerateStoryResult {
  success: boolean;
  storyId?: string;
  kind?: string;
  storyFilePath?: string;
  exportedStoryName?: string;
  error?: string;
  errorType?: 'STORY_FILE_EXISTS' | 'UNKNOWN';
}

export interface GenerateStoryOptions {
  /**
   * If true, checks if the file exists and returns an error without writing. If false, writes the
   * file even if it exists (overwrites).
   *
   * @default true
   */
  checkFileExists?: boolean;
}

/**
 * Generates and writes a new story file for a component.
 *
 * This function orchestrates the entire story file creation process:
 *
 * 1. Generates the story file path and content based on the component
 * 2. Optionally checks if the file already exists
 * 3. Writes the story file to disk
 * 4. Returns metadata about the created story
 *
 * @example
 *
 * ```ts
 * const result = await generateStoryFile(
 *   {
 *     componentFilePath: 'src/components/Button.tsx',
 *     componentExportName: 'Button',
 *     componentIsDefaultExport: true,
 *     componentExportCount: 1,
 *   },
 *   options
 * );
 *
 * if (result.success) {
 *   console.log(`Story created at ${result.storyFilePath}`);
 * }
 * ```
 *
 * @param payload - The component information for which to create a story
 * @param options - Storybook options for configuration
 * @param generateOptions - Additional options for story generation behavior
 * @returns A promise that resolves to the result of the story generation
 */
export async function generateStoryFile(
  payload: CreateNewStoryRequestPayload,
  options: Options,
  generateOptions: GenerateStoryOptions = {}
): Promise<GenerateStoryResult> {
  const { checkFileExists = true } = generateOptions;

  try {
    const { storyFilePath, exportedStoryName, storyFileContent } = await getNewStoryFile(
      payload,
      options
    );

    const relativeStoryFilePath = relative(process.cwd(), storyFilePath);

    const { storyId, kind } = await getStoryId({ storyFilePath, exportedStoryName }, options);

    if (checkFileExists && existsSync(storyFilePath)) {
      return {
        success: false,
        kind,
        storyFilePath: relativeStoryFilePath,
        error: `A story file already exists at ${relativeStoryFilePath}`,
        errorType: 'STORY_FILE_EXISTS',
      };
    }

    const formattedContent = await formatFileContent(storyFilePath, storyFileContent);
    await writeFile(storyFilePath, formattedContent, 'utf-8');

    return {
      success: true,
      storyId,
      kind,
      storyFilePath: relativeStoryFilePath,
      exportedStoryName,
    };
  } catch (e: any) {
    return {
      success: false,
      error: e?.message || 'Unknown error occurred',
      errorType: 'UNKNOWN',
    };
  }
}

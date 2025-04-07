/* eslint-disable no-underscore-dangle */
import { writeFile } from 'node:fs/promises';
import { basename, join } from 'node:path';

import type { Channel } from 'storybook/internal/channels';
import { formatFileContent } from 'storybook/internal/common';
import type {
  RequestData,
  ResponseData,
  SaveStoryRequestPayload,
  SaveStoryResponsePayload,
} from 'storybook/internal/core-events';
import {
  SAVE_STORY_REQUEST,
  SAVE_STORY_RESPONSE,
  STORY_RENDERED,
} from 'storybook/internal/core-events';
import { storyNameFromExport, toId } from 'storybook/internal/csf';
import { printCsf, readCsf } from 'storybook/internal/csf-tools';
import { logger } from 'storybook/internal/node-logger';
import { isExampleStoryId, telemetry } from 'storybook/internal/telemetry';
import type { CoreConfig, Indexer, Options } from 'storybook/internal/types';

import { duplicateStoryWithNewName } from './duplicate-story-with-new-name';
import { updateArgsInCsfFile } from './update-args-in-csf-file';
import { SaveStoryError } from './utils';

const parseArgs = (args: string): Record<string, any> =>
  JSON.parse(args, (_, value) => {
    if (value === '__sb_empty_function_arg__') {
      return () => {};
    }
    return value;
  });

// Removes extra newlines between story properties. See https://github.com/benjamn/recast/issues/242
// Only updates the part of the code for the story with the given name.
const removeExtraNewlines = (code: string, name: string) => {
  const anything = '([\\s\\S])'; // Multiline match for any character.
  const newline = '(\\r\\n|\\r|\\n)'; // Either newlines or carriage returns may be used in the file.
  const closing = newline + '};' + newline; // Marks the end of the story definition.
  const regex = new RegExp(
    // Looks for an export by the given name, considers the first closing brace on its own line
    // to be the end of the story definition.
    `^(?<before>${anything}*)(?<story>export const ${name} =${anything}+?${closing})(?<after>${anything}*)$`
  );
  const { before, story, after } = code.match(regex)?.groups || {};
  return story
    ? before + story.replaceAll(/(\r\n|\r|\n)(\r\n|\r|\n)([ \t]*[a-z0-9_]+): /gi, '$2$3:') + after
    : code;
};

export async function initializeSaveStory(
  channel: Channel,
  options: Options,
  coreConfig: CoreConfig,
  indexers: Indexer[]
) {
  channel.on(SAVE_STORY_REQUEST, async ({ id, payload }: RequestData<SaveStoryRequestPayload>) => {
    const { csfId, importPath, args, name } = payload;

    const sourceFileName = basename(importPath);
    const sourceFilePath = join(process.cwd(), importPath);

    try {
      const indexer = indexers.find((ind) => ind.test.exec(sourceFilePath));

      if (!indexer) {
        throw new SaveStoryError(`No indexer found for ${sourceFilePath}`);
      }
      if (!indexer.saveStory) {
        throw new SaveStoryError(
          `The indexer for the story format of ${sourceFilePath} does not support saving a story`
        );
      }

      const { code, sourceStoryName, newStoryId, newStoryName } = await indexer.saveStory({
        sourceFilePath,
        sourceStoryId: csfId,
        name,
        args: args ? parseArgs(args) : {},
      });

      // Writing the CSF file should trigger HMR, which causes the story to rerender. Delay the
      // response until that happens, but don't wait too long.
      await Promise.all([
        new Promise<void>((resolve) => {
          channel.on(STORY_RENDERED, resolve);
          setTimeout(() => resolve(channel.off(STORY_RENDERED, resolve)), 3000);
        }),
        writeFile(sourceFilePath, code),
      ]);

      channel.emit(SAVE_STORY_RESPONSE, {
        id,
        success: true,
        payload: {
          csfId,
          newStoryId,
          newStoryName,
          newStoryExportName: name,
          sourceFileContent: code,
          sourceFileName,
          sourceStoryName,
          sourceStoryExportName: sourceStoryName,
        },
        error: null,
      } satisfies ResponseData<SaveStoryResponsePayload>);

      // don't take credit for save-from-controls actions against CLI example stories
      const isCLIExample = isExampleStoryId(newStoryId ?? csfId);
      if (!coreConfig.disableTelemetry && !isCLIExample) {
        await telemetry('save-story', {
          action: name ? 'createStory' : 'updateStory',
          success: true,
        });
      }
    } catch (error: any) {
      channel.emit(SAVE_STORY_RESPONSE, {
        id,
        success: false,
        error: error instanceof SaveStoryError ? error.message : 'Unknown error',
      } satisfies ResponseData<SaveStoryResponsePayload>);

      logger.error(
        `Error writing to ${sourceFilePath}:\n${error.stack || error.message || error.toString()}`
      );

      if (!coreConfig.disableTelemetry && !(error instanceof SaveStoryError)) {
        await telemetry('save-story', {
          action: name ? 'createStory' : 'updateStory',
          success: false,
          error,
        });
      }
    }
  });
}

export const csfSaveStory: Indexer['saveStory'] = async ({
  sourceFilePath,
  sourceStoryId,
  name,
  args,
}) => {
  const csf = await readCsf(sourceFilePath, {
    makeTitle: (userTitle: string) => userTitle || 'myTitle',
  });

  const parsed = csf.parse();
  const stories = Object.entries(parsed._stories);

  const [componentId] = sourceStoryId.split('--');
  const newStoryName = name && storyNameFromExport(name);
  const newStoryId = newStoryName && toId(componentId, newStoryName);

  const storyExportName = stories.find(([exportName, story]) => story.id === sourceStoryId)?.[0];
  if (!storyExportName) {
    throw new SaveStoryError(`Source story not found.`);
  }
  if (name && csf.getStoryExport(name)) {
    throw new SaveStoryError(`Story already exists.`);
  }

  await updateArgsInCsfFile(
    name
      ? duplicateStoryWithNewName(parsed, storyExportName, name)
      : csf.getStoryExport(storyExportName),
    args
  );

  const code = await formatFileContent(
    sourceFilePath,
    removeExtraNewlines(printCsf(csf).code, name || storyExportName)
  );

  return {
    sourceStoryName: storyNameFromExport(storyExportName),
    newStoryName,
    newStoryId,
    code,
  };
};

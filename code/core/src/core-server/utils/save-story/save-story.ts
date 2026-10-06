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
import { storyNameFromExport, toId } from 'storybook/internal/csf/csf-utils';
import { printCsf, readCsf } from 'storybook/internal/csf-tools';
import { logger } from 'storybook/internal/node-logger';
import { isExampleStoryId, telemetry } from 'storybook/internal/telemetry';
import type { Options } from 'storybook/internal/types';

import { duplicateStoryWithNewName } from './duplicate-story-with-new-name.ts';
import { updateArgsInCsfFile } from './update-args-in-csf-file.ts';
import { SaveStoryError } from './utils.ts';

const parseArgs = (args: string): Record<string, any> =>
  JSON.parse(args, (_, value) => {
    if (value === '__sb_empty_function_arg__') {
      return () => {};
    }
    return value;
  });

export function initializeSaveStory(channel: Channel, options: Options) {
  channel.on(SAVE_STORY_REQUEST, async ({ id, payload }: RequestData<SaveStoryRequestPayload>) => {
    const { csfId, importPath, args, name } = payload;

    let newStoryId: string | undefined;
    let newStoryName: string | undefined;
    let sourceFileName: string | undefined;
    let sourceFilePath: string | undefined;
    let sourceStoryName: string | undefined;

    try {
      sourceFileName = basename(importPath);
      sourceFilePath = join(process.cwd(), importPath);

      const csf = await readCsf(sourceFilePath, {
        makeTitle: (userTitle: string) => userTitle || 'myTitle',
      });

      const parsed = csf.parse();
      const stories = Object.entries(parsed._stories);

      const [componentId, storyId] = csfId.split('--');
      newStoryName = name && storyNameFromExport(name);
      newStoryId = newStoryName && toId(componentId, newStoryName);

      const [storyName] = stories.find(([key, value]) => value.id.endsWith(`--${storyId}`)) || [];
      if (!storyName) {
        throw new SaveStoryError(`Source story not found.`);
      }
      if (name && csf.getStoryExport(name)) {
        throw new SaveStoryError(`Story already exists.`);
      }

      sourceStoryName = storyNameFromExport(storyName);

      await updateArgsInCsfFile(
        parsed,
        name ? duplicateStoryWithNewName(parsed, storyName, name) : csf.getStoryExport(storyName),
        args ? parseArgs(args) : {}
      );

      const code = await formatFileContent(sourceFilePath, printCsf(csf).code);

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
          sourceStoryExportName: storyName,
        },
        error: null,
      } satisfies ResponseData<SaveStoryResponsePayload>);

      // don't take credit for save-from-controls actions against CLI example stories
      const isCLIExample = isExampleStoryId(newStoryId ?? csfId);
      if (!isCLIExample) {
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

      if (!(error instanceof SaveStoryError)) {
        await telemetry('save-story', {
          action: name ? 'createStory' : 'updateStory',
          success: false,
          error,
        });
      }
    }
  });
}

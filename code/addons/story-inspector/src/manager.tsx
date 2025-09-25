import React from 'react';

import { addons, types } from 'storybook/manager-api';

import { StoryInspectorTool } from './components/StoryInspectorTool';
import { ADDON_ID, EVENTS, PARAM_KEY, TOOL_ID } from './constants';

// Register the addon
addons.register(ADDON_ID, (api) => {
  // Add the toolbar tool
  addons.add(TOOL_ID, {
    title: 'Story Inspector',
    type: types.TOOL,
    match: ({ viewMode, tabId }) => !!(viewMode && viewMode.match(/^(story|docs)$/)) && !tabId,
    render: () => <StoryInspectorTool />,
    paramKey: PARAM_KEY,
  });

  // Handle navigation to stories
  api.on('storybook/navigate-to-story', (storyId: string) => {
    console.log(storyId);
    api.selectStory(storyId);
  });

  api.on('storybook/open-editor', (file: string) => {
    api.openInEditor({ file });
  });

  // Handle create story requests
  api.on(EVENTS.CREATE_STORY_FOR_COMPONENT, async (componentPath: string) => {
    // Extract component information for the create story modal
    const componentName =
      componentPath
        .split('/')
        .pop()
        ?.replace(/\.(tsx?|jsx?)$/, '') || 'Component';
    const isDefaultExport = true; // Assume default export for now

    try {
      // Use the same logic as CreateNewStoryFileModal
      const { experimental_requestResponse, addons: storybookAddons } = await import(
        'storybook/manager-api'
      );
      const {
        CREATE_NEW_STORYFILE_REQUEST,
        CREATE_NEW_STORYFILE_RESPONSE,
        ARGTYPES_INFO_REQUEST,
        ARGTYPES_INFO_RESPONSE,
        SAVE_STORY_REQUEST,
        SAVE_STORY_RESPONSE,
      } = await import('storybook/internal/core-events');

      const channel = storybookAddons.getChannel();

      // Create new story file
      const createNewStoryResult = (await experimental_requestResponse(
        channel,
        CREATE_NEW_STORYFILE_REQUEST,
        CREATE_NEW_STORYFILE_RESPONSE,
        {
          componentExportName: componentName,
          componentFilePath: componentPath,
          componentIsDefaultExport: isDefaultExport,
          componentExportCount: 1,
        }
      )) as any;

      if (!createNewStoryResult || !createNewStoryResult.storyId) {
        throw new Error('Failed to create new story - no story ID returned');
      }

      const storyId = createNewStoryResult.storyId;

      // Try to select the new story
      await new Promise((resolve) => {
        const attemptSelect = (attempts = 0) => {
          if (attempts > 10) {
            resolve(undefined);
            return;
          }

          try {
            api.selectStory(storyId);
            resolve(undefined);
          } catch {
            setTimeout(() => attemptSelect(attempts + 1), 100);
          }
        };
        attemptSelect();
      });

      // Get argTypes and save with defaults
      try {
        const argTypesInfoResult = (await experimental_requestResponse(
          channel,
          ARGTYPES_INFO_REQUEST,
          ARGTYPES_INFO_RESPONSE,
          { storyId }
        )) as any;

        if (!argTypesInfoResult || !argTypesInfoResult.argTypes) {
          throw new Error('Failed to get component argTypes');
        }

        const argTypes = argTypesInfoResult.argTypes;

        // Extract required args with default values
        const requiredArgs: Record<string, any> = {};
        Object.entries(argTypes || {}).forEach(([key, argType]: [string, any]) => {
          if (argType.type?.required || argType.control?.required) {
            // Provide sensible defaults based on type
            if (argType.type?.name === 'string') {
              requiredArgs[key] = 'Sample text';
            } else if (argType.type?.name === 'number') {
              requiredArgs[key] = 42;
            } else if (argType.type?.name === 'boolean') {
              requiredArgs[key] = true;
            } else {
              requiredArgs[key] = null;
            }
          }
        });

        const saveStoryResult = (await experimental_requestResponse(
          channel,
          SAVE_STORY_REQUEST,
          SAVE_STORY_RESPONSE,
          {
            args: JSON.stringify(requiredArgs, (_, value) => {
              if (typeof value === 'function') {
                return '__sb_empty_function_arg__';
              }
              return value;
            }),
            importPath: createNewStoryResult.storyFilePath,
            csfId: storyId,
          }
        )) as any;

        if (!saveStoryResult || !saveStoryResult.storyFilePath) {
          throw new Error('Failed to save story - no file path returned');
        }

        const storyFilePath = saveStoryResult.storyFilePath;
      } catch (e) {
        // Ignore argTypes errors
      }

      // Show success notification
      api.addNotification({
        id: 'story-inspector-create-success',
        content: {
          headline: 'Story created successfully',
          subHeadline: `Created story for ${componentName}`,
        },
        duration: 5000,
        icon: <span>✅</span>,
      });
    } catch (error: any) {
      // Handle errors
      let errorMessage = 'Failed to create story';

      if (error?.payload?.type === 'STORY_FILE_EXISTS') {
        errorMessage = 'Story already exists';
        // Try to navigate to existing story
        try {
          await api.selectStory(error.payload.kind);
        } catch {}
      }

      api.addNotification({
        id: 'story-inspector-create-error',
        content: {
          headline: errorMessage,
          subHeadline: error.message || `Error creating story for ${componentName}`,
        },
        duration: 8000,
        icon: <span>❌</span>,
      });
    }
  });
});

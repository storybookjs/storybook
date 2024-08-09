import React, { useCallback, useDeferredValue, useEffect, useRef, useState } from 'react';

import { CheckIcon } from '@storybook/icons';

import type {
  ArgTypesRequestPayload,
  ArgTypesResponsePayload,
  CreateNewStoryErrorPayload,
  CreateNewStoryRequestPayload,
  CreateNewStoryResponsePayload,
  FileComponentSearchRequestPayload,
  FileComponentSearchResponsePayload,
  RequestData,
  ResponseData,
  SaveStoryRequestPayload,
  SaveStoryResponsePayload,
} from '@storybook/core/core-events';
import {
  ARGTYPES_INFO_REQUEST,
  ARGTYPES_INFO_RESPONSE,
  CREATE_NEW_STORYFILE_REQUEST,
  CREATE_NEW_STORYFILE_RESPONSE,
  FILE_COMPONENT_SEARCH_REQUEST,
  FILE_COMPONENT_SEARCH_RESPONSE,
  SAVE_STORY_REQUEST,
  SAVE_STORY_RESPONSE,
} from '@storybook/core/core-events';
import type { RequestResponseError } from '@storybook/core/manager-api';
import { addons, experimental_requestResponse, useStorybookApi } from '@storybook/core/manager-api';

import { useDebounce } from '../../hooks/useDebounce';
import type { NewStoryPayload, SearchResult } from './FileSearchList';
import { FileSearchModal } from './FileSearchModal';
import { extractSeededRequiredArgs, trySelectNewStory } from './FileSearchModal.utils';

interface CreateNewStoryFileModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const stringifyArgs = (args: Record<string, any>) =>
  JSON.stringify(args, (_, value) => {
    if (typeof value === 'function') return '__sb_empty_function_arg__';
    return value;
  });

export const CreateNewStoryFileModal = ({ open, onOpenChange }: CreateNewStoryFileModalProps) => {
  const [isLoading, setLoading] = useState(false);
  const [fileSearchQuery, setFileSearchQuery] = useState('');
  const fileSearchQueryDebounced = useDebounce(fileSearchQuery, 600);
  const fileSearchQueryDeferred = useDeferredValue(fileSearchQueryDebounced);
  const emittedValue = useRef<string | null>(null);
  const [error, setError] = useState<{ selectedItemId?: number | string; error: string } | null>(
    null
  );
  const api = useStorybookApi();

  const [searchResults, setSearchResults] = useState<SearchResult[] | null>(null);

  const handleSuccessfullyCreatedStory = useCallback(
    (componentExportName: string) => {
      api.addNotification({
        id: 'create-new-story-file-success',
        content: {
          headline: 'Story file created',
          subHeadline: `${componentExportName} was created`,
        },
        duration: 8_000,
        icon: <CheckIcon />,
      });

      onOpenChange(false);
    },
    [api, onOpenChange]
  );

  const handleStoryAlreadyExists = useCallback(() => {
    api.addNotification({
      id: 'create-new-story-file-error',
      content: {
        headline: 'Story already exists',
        subHeadline: `Successfully navigated to existing story`,
      },
      duration: 8_000,
      icon: <CheckIcon />,
    });

    onOpenChange(false);
  }, [api, onOpenChange]);

  const handleFileSearch = useCallback(() => {
    setLoading(true);
    const channel = addons.getChannel();

    const set = (data: ResponseData<FileComponentSearchResponsePayload>) => {
      const isLatestRequest = data.id === fileSearchQueryDeferred;

      if (isLatestRequest) {
        if (data.success) {
          setSearchResults(data.payload.files);
        } else {
          setError({ error: data.error });
        }

        channel.off(FILE_COMPONENT_SEARCH_RESPONSE, set);
        setLoading(false);
        emittedValue.current = null;
      }
    };

    channel.on(FILE_COMPONENT_SEARCH_RESPONSE, set);

    if (fileSearchQueryDeferred !== '' && emittedValue.current !== fileSearchQueryDeferred) {
      emittedValue.current = fileSearchQueryDeferred;
      channel.emit(FILE_COMPONENT_SEARCH_REQUEST, {
        id: fileSearchQueryDeferred,
        payload: {},
      } satisfies RequestData<FileComponentSearchRequestPayload>);
    } else {
      setSearchResults(null);
      setLoading(false);
    }

    return () => {
      channel.off(FILE_COMPONENT_SEARCH_RESPONSE, set);
    };
  }, [fileSearchQueryDeferred]);

  const handleCreateNewStory = useCallback(
    async ({
      componentExportName,
      componentFilePath,
      componentIsDefaultExport,
      componentExportCount,
      selectedItemId,
    }: NewStoryPayload) => {
      try {
        const channel = addons.getChannel();

        const createNewStoryResult = await experimental_requestResponse<
          CreateNewStoryRequestPayload,
          CreateNewStoryResponsePayload,
          CreateNewStoryErrorPayload
        >(channel, CREATE_NEW_STORYFILE_REQUEST, CREATE_NEW_STORYFILE_RESPONSE, {
          componentExportName,
          componentFilePath,
          componentIsDefaultExport,
          componentExportCount,
        });

        setError(null);

        const storyId = createNewStoryResult.storyId;

        await trySelectNewStory(api.selectStory, storyId);

        try {
          const argTypesInfoResult = await experimental_requestResponse<
            ArgTypesRequestPayload,
            ArgTypesResponsePayload
          >(channel, ARGTYPES_INFO_REQUEST, ARGTYPES_INFO_RESPONSE, {
            storyId,
          });

          const argTypes = argTypesInfoResult.argTypes;

          const requiredArgs = extractSeededRequiredArgs(argTypes);

          await experimental_requestResponse<SaveStoryRequestPayload, SaveStoryResponsePayload>(
            channel,
            SAVE_STORY_REQUEST,
            SAVE_STORY_RESPONSE,
            {
              args: stringifyArgs(requiredArgs),
              importPath: createNewStoryResult.storyFilePath,
              csfId: storyId,
            }
          );
        } catch (e) {}

        handleSuccessfullyCreatedStory(componentExportName);
        handleFileSearch();
      } catch (e: any) {
        switch (e?.payload?.type as CreateNewStoryErrorPayload['type']) {
          case 'STORY_FILE_EXISTS':
            const err = e as RequestResponseError<CreateNewStoryErrorPayload>;
            // @ts-expect-error (non strict)
            await trySelectNewStory(api.selectStory, err.payload.kind);
            handleStoryAlreadyExists();
            break;
          default:
            setError({ selectedItemId: selectedItemId, error: (e as any)?.message });
            break;
        }
      }
    },
    [api?.selectStory, handleSuccessfullyCreatedStory, handleFileSearch, handleStoryAlreadyExists]
  );

  useEffect(() => {
    setError(null);
  }, [fileSearchQueryDeferred]);

  useEffect(() => {
    return handleFileSearch();
  }, [handleFileSearch]);

  return (
    <FileSearchModal
      error={error}
      fileSearchQuery={fileSearchQuery}
      fileSearchQueryDeferred={fileSearchQueryDeferred}
      onCreateNewStory={handleCreateNewStory}
      isLoading={isLoading}
      onOpenChange={onOpenChange}
      open={open}
      searchResults={searchResults}
      setError={setError}
      setFileSearchQuery={setFileSearchQuery}
    />
  );
};

import React, { type FC, Fragment, useCallback, useRef, useState } from 'react';

import { Button } from 'storybook/internal/components';
import {
  TESTING_MODULE_CONFIG_CHANGE,
  type TestProviderConfig,
  type TestProviderState,
  type TestingModuleConfigChangePayload,
} from 'storybook/internal/core-events';
import type { API } from 'storybook/internal/manager-api';
import { styled } from 'storybook/internal/theming';

import { EditIcon, EyeIcon, PlayHollowIcon, StopAltHollowIcon } from '@storybook/icons';

import { type Config, type Details, TEST_PROVIDER_ID } from '../constants';
import { Description } from './Description';
import { GlobalErrorModal } from './GlobalErrorModal';

const Info = styled.div({
  display: 'flex',
  flexDirection: 'column',
  marginLeft: 6,
});

const Title = styled.div<{ crashed?: boolean }>(({ crashed, theme }) => ({
  fontSize: theme.typography.size.s1,
  fontWeight: crashed ? 'bold' : 'normal',
  color: crashed ? theme.color.negativeText : theme.color.defaultText,
}));

const Actions = styled.div({
  display: 'flex',
  gap: 6,
});

const Head = styled.div({
  display: 'flex',
  justifyContent: 'space-between',
  gap: 6,
});

export const TestProviderRender: FC<{
  api: API;
  state: TestProviderConfig & TestProviderState<Details, Config>;
}> = ({ state, api }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);

  const title = state.crashed || state.failed ? 'Component tests failed' : 'Component tests';
  const errorMessage = state.error?.message;

  const [config, changeConfig] = useConfig(
    state.id,
    state.config || { a11y: false, coverage: false },
    api
  );

  const [isEditing, setIsEditing] = useState(false);

  return (
    <Fragment>
      <Head>
        <Info>
          <Title crashed={state.crashed} id="testing-module-title">
            {title}
          </Title>
          <Description errorMessage={errorMessage} setIsModalOpen={setIsModalOpen} state={state} />
        </Info>

        <Actions>
          <Button
            aria-label={`Edit`}
            variant="ghost"
            padding="small"
            active={isEditing}
            onClick={() => setIsEditing((v) => !v)}
          >
            <EditIcon />
          </Button>
          {state.watchable && (
            <Button
              aria-label={`${state.watching ? 'Disable' : 'Enable'} watch mode for ${state.name}`}
              variant="ghost"
              padding="small"
              active={state.watching}
              onClick={() => api.setTestProviderWatchMode(state.id, !state.watching)}
              disabled={state.crashed || state.running}
            >
              <EyeIcon />
            </Button>
          )}
          {state.runnable && (
            <>
              {state.running && state.cancellable ? (
                <Button
                  aria-label={`Stop ${state.name}`}
                  variant="ghost"
                  padding="small"
                  onClick={() => api.cancelTestProvider(state.id)}
                  disabled={state.cancelling}
                >
                  <StopAltHollowIcon />
                </Button>
              ) : (
                <Button
                  aria-label={`Start ${state.name}`}
                  variant="ghost"
                  padding="small"
                  onClick={() => api.runTestProvider(state.id, {})}
                  disabled={state.crashed || state.running}
                >
                  <PlayHollowIcon />
                </Button>
              )}
            </>
          )}
        </Actions>
      </Head>

      {!isEditing ? (
        <Fragment>
          {Object.entries(config).map(([key, value]) => (
            <div key={key}>
              {key}: {value ? 'ON' : 'OFF'}
            </div>
          ))}
        </Fragment>
      ) : (
        <Fragment>
          {Object.entries(config).map(([key, value]) => (
            <div
              key={key}
              onClick={() => {
                changeConfig({ [key]: !value });
              }}
            >
              {key}: {value ? 'ON' : 'OFF'}
            </div>
          ))}
        </Fragment>
      )}

      <GlobalErrorModal
        error={errorMessage}
        open={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
        }}
        onRerun={() => {
          setIsModalOpen(false);
          api.runTestProvider(TEST_PROVIDER_ID);
        }}
      />
    </Fragment>
  );
};

function useConfig(id: string, config: Config, api: API) {
  const data = useRef<Config>(config);
  data.current = config || {
    a11y: false,
    coverage: false,
  };

  const changeConfig = useCallback(
    (update: Partial<Config>) => {
      const newConfig = {
        ...data.current,
        ...update,
      };
      api.updateTestProviderState(id, {
        config: newConfig,
      });
      api.emit(TESTING_MODULE_CONFIG_CHANGE, {
        providerId: id,
        config: newConfig,
      } as TestingModuleConfigChangePayload);
    },
    [api, id]
  );

  return [data.current, changeConfig] as const;
}

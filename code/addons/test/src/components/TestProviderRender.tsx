import React, { type FC, useCallback, useRef, useState } from 'react';

import { Button, ListItem } from 'storybook/internal/components';
import {
  TESTING_MODULE_CONFIG_CHANGE,
  type TestProviderConfig,
  type TestProviderState,
} from 'storybook/internal/core-events';
import type { API } from 'storybook/internal/manager-api';
import { styled, useTheme } from 'storybook/internal/theming';

import {
  AccessibilityIcon,
  EditIcon,
  EyeIcon,
  PlayHollowIcon,
  PointerHandIcon,
  ShieldIcon,
  StopAltHollowIcon,
} from '@storybook/icons';

import { isEqual } from 'es-toolkit';
import { debounce } from 'es-toolkit/compat';

import { type Config, type Details, TEST_PROVIDER_ID } from '../constants';
import { Description } from './Description';
import { GlobalErrorModal } from './GlobalErrorModal';
import { TestStatusIcon } from './TestStatusIcon';

const Container = styled.div({
  display: 'flex',
  flexDirection: 'column',
});

const Heading = styled.div({
  display: 'flex',
  justifyContent: 'space-between',
  padding: '8px 2px',
  gap: 6,
});

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

const Extras = styled.div({
  marginBottom: 2,
});

const Checkbox = styled.input({
  margin: 0,
  '&:enabled': {
    cursor: 'pointer',
  },
});

export const TestProviderRender: FC<{
  api: API;
  state: TestProviderConfig & TestProviderState<Details, Config>;
}> = ({ state, api }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const theme = useTheme();

  const title = state.crashed || state.failed ? 'Local tests failed' : 'Run local tests';
  const errorMessage = state.error?.message;
  const coverageSummary = state.details?.coverageSummary;

  const [config, updateConfig] = useConfig(
    api,
    state.id,
    state.config || { a11y: false, coverage: false }
  );

  return (
    <Container>
      <Heading>
        <Info>
          <Title crashed={state.crashed} id="testing-module-title">
            {title}
          </Title>
          <Description errorMessage={errorMessage} setIsModalOpen={setIsModalOpen} state={state} />
        </Info>

        <Actions>
          <Button
            aria-label={`${isEditing ? 'Close' : 'Open'} settings for ${state.name}`}
            variant="ghost"
            padding="small"
            active={isEditing}
            onClick={() => setIsEditing(!isEditing)}
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
                  onClick={() => api.runTestProvider(state.id)}
                  disabled={state.crashed || state.running}
                >
                  <PlayHollowIcon />
                </Button>
              )}
            </>
          )}
        </Actions>
      </Heading>

      {isEditing ? (
        <Extras>
          <ListItem
            as="label"
            title="Component tests"
            icon={<PointerHandIcon color={theme.textMutedColor} />}
            right={<Checkbox type="checkbox" checked disabled />}
          />
          <ListItem
            as="label"
            title="Coverage"
            icon={<ShieldIcon color={theme.textMutedColor} />}
            right={
              <Checkbox
                type="checkbox"
                checked={state.watching ? false : config.coverage}
                disabled={state.watching}
                onChange={() => updateConfig({ coverage: !config.coverage })}
              />
            }
          />
          <ListItem
            as="label"
            title="Accessibility"
            icon={<AccessibilityIcon color={theme.textMutedColor} />}
            right={
              <Checkbox
                type="checkbox"
                disabled // TODO: Implement a11y
                checked={config.a11y}
                onChange={() => updateConfig({ a11y: !config.a11y })}
              />
            }
          />
        </Extras>
      ) : (
        <Extras>
          <ListItem
            title="Component tests"
            icon={<TestStatusIcon status="positive" aria-label="status: passed" />}
          />
          {coverageSummary ? (
            <ListItem
              title="Coverage"
              href={'/coverage/index.html'}
              // @ts-expect-error ListItem doesn't include all anchor attributes in types, but it is an achor element
              target="_blank"
              icon={
                <TestStatusIcon
                  percentage={coverageSummary.percentage}
                  status={coverageSummary.status}
                  aria-label={`status: ${coverageSummary.status}`}
                />
              }
              right={`${coverageSummary.percentage}%`}
            />
          ) : (
            <ListItem
              title="Coverage"
              icon={<TestStatusIcon status="unknown" aria-label={`status: unknown`} />}
            />
          )}
          <ListItem
            title="Accessibility"
            icon={<TestStatusIcon status="negative" aria-label="status: failed" />}
            right={73}
          />
        </Extras>
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
    </Container>
  );
};

function useConfig(api: API, providerId: string, initialConfig: Config) {
  const [currentConfig, setConfig] = useState<Config>(initialConfig);
  const lastConfig = useRef(initialConfig);

  const saveConfig = useCallback(
    debounce((config: Config) => {
      if (!isEqual(config, lastConfig.current)) {
        api.updateTestProviderState(providerId, { config });
        api.emit(TESTING_MODULE_CONFIG_CHANGE, { providerId, config });
        lastConfig.current = config;
      }
    }, 500),
    [api, providerId]
  );

  const updateConfig = useCallback(
    (update: Partial<Config>) => {
      setConfig((value) => {
        const updated = { ...value, ...update };
        saveConfig(updated);
        return updated;
      });
    },
    [saveConfig]
  );

  return [currentConfig, updateConfig] as const;
}

import React, { useCallback, useEffect, useMemo, useState } from 'react';

import { styled } from '@storybook/core/theming';
import {
  type API_FilterFunction,
  type API_StatusUpdate,
  type API_StatusValue,
  Addon_TypesEnum,
} from '@storybook/core/types';

import {
  TESTING_MODULE_RUN_ALL_REQUEST,
  TESTING_MODULE_RUN_PROGRESS_RESPONSE,
  TESTING_MODULE_WATCH_MODE_REQUEST,
  type TestingModuleRunResponsePayload,
} from '@storybook/core/core-events';
import {
  type API,
  type State,
  useStorybookApi,
  useStorybookState,
} from '@storybook/core/manager-api';

import { throttle } from 'es-toolkit';

import { NotificationList } from '../notifications/NotificationList';
import { TestingModule } from './TestingModule';

const filterNone: API_FilterFunction = () => true;
const filterWarn: API_FilterFunction = ({ status = {} }) =>
  Object.values(status).some((value) => value?.status === 'warn');
const filterError: API_FilterFunction = ({ status = {} }) =>
  Object.values(status).some((value) => value?.status === 'error');
const filterBoth: API_FilterFunction = ({ status = {} }) =>
  Object.values(status).some((value) => value?.status === 'warn' || value?.status === 'error');

const getFilter = (warningsActive = false, errorsActive = false) => {
  if (warningsActive && errorsActive) {
    return filterBoth;
  }

  if (warningsActive) {
    return filterWarn;
  }

  if (errorsActive) {
    return filterError;
  }
  return filterNone;
};

const Wrapper = styled.div({
  transition: 'height 250ms',
});

const Content = styled.div(({ theme }) => ({
  position: 'absolute',
  bottom: 0,
  left: 0,
  right: 0,
  padding: 12,
  display: 'flex',
  flexDirection: 'column',
  gap: 12,
  color: theme.color.defaultText,
  fontSize: theme.typography.size.s1,

  '&:empty': {
    display: 'none',
  },

  // Integrators can use these to style their custom additions
  '--sb-sidebar-bottom-card-background': theme.background.content,
  '--sb-sidebar-bottom-card-border': `1px solid ${theme.appBorderColor}`,
  '--sb-sidebar-bottom-card-border-radius': `${theme.appBorderRadius + 1}px`,
  '--sb-sidebar-bottom-card-box-shadow': `0 1px 2px 0 rgba(0, 0, 0, 0.05), 0px -5px 20px 10px ${theme.background.app}`,
}));

const statusMap: Record<any['status'], API_StatusValue> = {
  failed: 'error',
  passed: 'success',
  pending: 'pending',
};

function processTestReport(payload: TestingModuleRunResponsePayload) {
  const result: API_StatusUpdate = {};

  payload.testResults.forEach((testResult: any) => {
    testResult.results.forEach(({ storyId, status, failureMessages, data = {} }: any) => {
      if (storyId) {
        result[storyId] = {
          title: 'Vitest',
          status: statusMap[status],
          description: failureMessages?.length ? failureMessages.join('\n') : '',
          data,
        };
      }
    });
  });

  return result;
}

interface SidebarBottomProps {
  api: API;
  notifications: State['notifications'];
  status: State['status'];
}

export const SidebarBottomBase = ({ api, notifications = [], status = {} }: SidebarBottomProps) => {
  const [warningsActive, setWarningsActive] = useState(false);
  const [errorsActive, setErrorsActive] = useState(false);
  const [contentHeight, setContentHeight] = useState(0);

  const resizeObserverCallback = useMemo(
    () => throttle((element) => setContentHeight(element.clientHeight || 0), 250),
    []
  );

  useEffect(() => {
    const wrapper = document.getElementById('sidebar-bottom');
    if (wrapper) {
      const resizeObserver = new ResizeObserver(() => resizeObserverCallback(wrapper));
      resizeObserver.observe(wrapper);
      return () => resizeObserver.disconnect();
    }
  }, [resizeObserverCallback]);

  const warnings = Object.values(status).filter((statusByAddonId) =>
    Object.values(statusByAddonId).some((value) => value?.status === 'warn')
  );
  const errors = Object.values(status).filter((statusByAddonId) =>
    Object.values(statusByAddonId).some((value) => value?.status === 'error')
  );
  const hasWarnings = warnings.length > 0;
  const hasErrors = errors.length > 0;

  const onRunTests = useCallback(
    (providerId?: string) => {
      api.emit(TESTING_MODULE_RUN_ALL_REQUEST, { providerId });
    },
    [api]
  );
  const onSetWatchMode = useCallback(
    (providerId: string, watchMode: boolean) => {
      api.emit(TESTING_MODULE_WATCH_MODE_REQUEST, { providerId, watchMode });
    },
    [api]
  );

  useEffect(() => {
    const filter = getFilter(hasWarnings && warningsActive, hasErrors && errorsActive);
    api.experimental_setFilter('sidebar-bottom-filter', filter);
  }, [api, hasWarnings, hasErrors, warningsActive, errorsActive]);

  const testProviders = Object.values(api.getElements(Addon_TypesEnum.experimental_TEST_PROVIDER));

  if (!hasWarnings && !hasErrors && !testProviders.length) {
    return null;
  }

  return (
    <Wrapper id="sidebar-bottom-wrapper" style={{ height: contentHeight }}>
      <Content id="sidebar-bottom">
        <NotificationList notifications={notifications} clearNotification={api.clearNotification} />
        <TestingModule
          {...{
            testProviders,
            errorCount: errors.length,
            errorsActive,
            setErrorsActive,
            warningCount: warnings.length,
            warningsActive,
            setWarningsActive,
            onRunTests,
            onSetWatchMode,
          }}
        />
      </Content>
    </Wrapper>
  );
};

const TESTING_MODULE_ID = 'storybook-testing-module';

export const SidebarBottom = () => {
  const api = useStorybookApi();
  const { notifications, status } = useStorybookState();

  useEffect(() => {
    api.getChannel()?.on(TESTING_MODULE_RUN_PROGRESS_RESPONSE, (data) => {
      if ('payload' in data) {
        console.log('progress', data);
        // TODO clear statuses
        api.experimental_updateStatus(TESTING_MODULE_ID, processTestReport(data.payload));
      } else {
        // console.log('error', data);
      }
    });
  }, [api]);

  return <SidebarBottomBase api={api} notifications={notifications} status={status} />;
};

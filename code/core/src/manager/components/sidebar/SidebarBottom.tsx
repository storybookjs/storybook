import React, { useCallback, useEffect, useMemo, useState } from 'react';

import { styled } from '@storybook/core/theming';
import { type API_FilterFunction, Addon_TypesEnum } from '@storybook/core/types';

import {
  TESTING_MODULE_CANCEL_TEST_RUN_REQUEST,
  TESTING_MODULE_CRASH_REPORT,
  TESTING_MODULE_PROGRESS_REPORT,
  TESTING_MODULE_RUN_ALL_REQUEST,
  TESTING_MODULE_WATCH_MODE_REQUEST,
  type TestProviderId,
  type TestProviderState,
  type TestProviders,
  type TestingModuleProgressReportPayload,
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

const initialTestProviderState: TestProviderState = {
  details: {} as { [key: string]: any },
  cancellable: false,
  cancelling: false,
  running: false,
  watching: false,
  failed: false,
  crashed: false,
};

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

interface SidebarBottomProps {
  api: API;
  notifications: State['notifications'];
  status: State['status'];
}

export const SidebarBottomBase = ({ api, notifications = [], status = {} }: SidebarBottomProps) => {
  const [warningsActive, setWarningsActive] = useState(false);
  const [errorsActive, setErrorsActive] = useState(false);
  const [contentHeight, setContentHeight] = useState(0);
  const [testProviders, setTestProviders] = useState<TestProviders>(() =>
    Object.fromEntries(
      Object.entries(api.getElements(Addon_TypesEnum.experimental_TEST_PROVIDER)).map(
        ([id, config]) => [id, { ...config, ...initialTestProviderState }]
      )
    )
  );

  const resizeObserverCallback = useMemo(
    () => throttle((element) => setContentHeight(element.clientHeight || 0), 250),
    []
  );

  const warnings = Object.values(status).filter((statusByAddonId) =>
    Object.values(statusByAddonId).some((value) => value?.status === 'warn')
  );
  const errors = Object.values(status).filter((statusByAddonId) =>
    Object.values(statusByAddonId).some((value) => value?.status === 'error')
  );
  const hasWarnings = warnings.length > 0;
  const hasErrors = errors.length > 0;

  const updateTestProvider = useCallback(
    (id: TestProviderId, update: Partial<TestProviderState>) =>
      setTestProviders((state) => ({ ...state, [id]: { ...state[id], ...update } })),
    []
  );

  const clearState = useCallback(
    ({ providerId: id }: { providerId: TestProviderId }) => {
      const startingState: Partial<TestProviderState> = {
        cancelling: false,
        running: true,
        failed: false,
        crashed: false,
      };
      setTestProviders((state) => ({ ...state, [id]: { ...state[id], ...startingState } }));
      api.experimental_updateStatus(id, (state = {}) =>
        Object.fromEntries(Object.keys(state).map((key) => [key, null]))
      );
    },
    [api]
  );

  const onRunTests = useCallback(
    (id: TestProviderId) => {
      api.emit(TESTING_MODULE_RUN_ALL_REQUEST, { providerId: id });
    },
    [api]
  );

  const onCancelTests = useCallback(
    (id: TestProviderId) => {
      updateTestProvider(id, { cancelling: true });
      api.emit(TESTING_MODULE_CANCEL_TEST_RUN_REQUEST, { providerId: id });
    },
    [api, updateTestProvider]
  );

  const onSetWatchMode = useCallback(
    (providerId: string, watchMode: boolean) => {
      updateTestProvider(providerId, { watching: watchMode });
      api.emit(TESTING_MODULE_WATCH_MODE_REQUEST, { providerId, watchMode });
    },
    [api, updateTestProvider]
  );

  useEffect(() => {
    const wrapper = document.getElementById('sidebar-bottom');
    if (wrapper) {
      const resizeObserver = new ResizeObserver(() => resizeObserverCallback(wrapper));
      resizeObserver.observe(wrapper);
      return () => resizeObserver.disconnect();
    }
  }, [resizeObserverCallback]);

  useEffect(() => {
    const filter = getFilter(hasWarnings && warningsActive, hasErrors && errorsActive);
    api.experimental_setFilter('sidebar-bottom-filter', filter);
  }, [api, hasWarnings, hasErrors, warningsActive, errorsActive]);

  useEffect(() => {
    const onCrashReport = ({ providerId, ...details }: { providerId: string }) => {
      updateTestProvider(providerId, { details, running: false, crashed: true });
    };

    const onProgressReport = ({ providerId, ...payload }: TestingModuleProgressReportPayload) => {
      if (payload.status === 'failed') {
        updateTestProvider(providerId, { running: false, failed: true });
      } else {
        const update = { ...payload, running: payload.status === 'pending' };
        updateTestProvider(providerId, update);

        const { mapStatusUpdate, ...state } = testProviders[providerId];
        const statusUpdate = mapStatusUpdate?.({ ...state, ...update });
        if (statusUpdate) {
          api.experimental_updateStatus(providerId, statusUpdate);
        }
      }
    };

    api.getChannel()?.on(TESTING_MODULE_CRASH_REPORT, onCrashReport);
    api.getChannel()?.on(TESTING_MODULE_RUN_ALL_REQUEST, clearState);
    api.getChannel()?.on(TESTING_MODULE_PROGRESS_REPORT, onProgressReport);

    return () => {
      api.getChannel()?.off(TESTING_MODULE_CRASH_REPORT, onCrashReport);
      api.getChannel()?.off(TESTING_MODULE_PROGRESS_REPORT, onProgressReport);
      api.getChannel()?.off(TESTING_MODULE_RUN_ALL_REQUEST, clearState);
    };
  }, [api, testProviders, updateTestProvider, clearState]);

  const testProvidersArray = Object.values(testProviders);
  if (!hasWarnings && !hasErrors && !testProvidersArray.length) {
    return null;
  }

  return (
    <Wrapper id="sidebar-bottom-wrapper" style={{ height: contentHeight }}>
      <Content id="sidebar-bottom">
        <NotificationList notifications={notifications} clearNotification={api.clearNotification} />
        <TestingModule
          {...{
            testProviders: testProvidersArray,
            errorCount: errors.length,
            errorsActive,
            setErrorsActive,
            warningCount: warnings.length,
            warningsActive,
            setWarningsActive,
            onRunTests,
            onCancelTests,
            onSetWatchMode,
          }}
        />
      </Content>
    </Wrapper>
  );
};

export const SidebarBottom = () => {
  const api = useStorybookApi();
  const { notifications, status } = useStorybookState();
  return <SidebarBottomBase api={api} notifications={notifications} status={status} />;
};

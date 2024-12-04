import React, { Fragment, useEffect, useRef, useState } from 'react';

import { styled } from '@storybook/core/theming';
import { type API_FilterFunction } from '@storybook/core/types';

import {
  TESTING_MODULE_CRASH_REPORT,
  TESTING_MODULE_PROGRESS_REPORT,
  type TestingModuleCrashReportPayload,
  type TestingModuleProgressReportPayload,
} from '@storybook/core/core-events';
import {
  type API,
  type State,
  useStorybookApi,
  useStorybookState,
} from '@storybook/core/manager-api';

import { NotificationList } from '../notifications/NotificationList';
import { TestingModule } from './TestingModule';

// This ID is used dynamically add/remove space at the bottom to prevent overlapping the main sidebar content.
const SIDEBAR_BOTTOM_SPACER_ID = 'sidebar-bottom-spacer';
// This ID is used by some integrators to target the (fixed position) sidebar bottom element so it should remain stable.
const SIDEBAR_BOTTOM_WRAPPER_ID = 'sidebar-bottom-wrapper';

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

const Spacer = styled.div({
  pointerEvents: 'none',
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
  isDevelopment?: boolean;
}

export const SidebarBottomBase = ({
  api,
  notifications = [],
  status = {},
  isDevelopment,
}: SidebarBottomProps) => {
  const spacerRef = useRef<HTMLDivElement | null>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const [warningsActive, setWarningsActive] = useState(false);
  const [errorsActive, setErrorsActive] = useState(false);
  const { testProviders } = useStorybookState();

  const warnings = Object.values(status).filter((statusByAddonId) =>
    Object.values(statusByAddonId).some((value) => value?.status === 'warn')
  );
  const errors = Object.values(status).filter((statusByAddonId) =>
    Object.values(statusByAddonId).some((value) => value?.status === 'error')
  );
  const hasWarnings = warnings.length > 0;
  const hasErrors = errors.length > 0;

  useEffect(() => {
    if (spacerRef.current && wrapperRef.current) {
      const resizeObserver = new ResizeObserver(() => {
        if (spacerRef.current && wrapperRef.current) {
          spacerRef.current.style.height = `${wrapperRef.current.scrollHeight}px`;
        }
      });
      resizeObserver.observe(wrapperRef.current);
      return () => resizeObserver.disconnect();
    }
  }, []);

  useEffect(() => {
    const filter = getFilter(hasWarnings && warningsActive, hasErrors && errorsActive);
    api.experimental_setFilter('sidebar-bottom-filter', filter);
  }, [api, hasWarnings, hasErrors, warningsActive, errorsActive]);

  useEffect(() => {
    const onCrashReport = ({ providerId, ...details }: TestingModuleCrashReportPayload) => {
      api.updateTestProviderState(providerId, {
        error: { name: 'Crashed!', message: details.error.message },
        running: false,
        crashed: true,
        watching: false,
      });
    };

    const onProgressReport = ({ providerId, ...result }: TestingModuleProgressReportPayload) => {
      const statusResult = 'status' in result ? result.status : undefined;
      api.updateTestProviderState(
        providerId,
        statusResult === 'failed'
          ? { ...result, running: false, failed: true }
          : { ...result, running: statusResult === 'pending' }
      );
    };

    api.on(TESTING_MODULE_CRASH_REPORT, onCrashReport);
    api.on(TESTING_MODULE_PROGRESS_REPORT, onProgressReport);

    return () => {
      api.off(TESTING_MODULE_CRASH_REPORT, onCrashReport);
      api.off(TESTING_MODULE_PROGRESS_REPORT, onProgressReport);
    };
  }, [api, testProviders]);

  const testProvidersArray = Object.values(testProviders || {});
  if (!hasWarnings && !hasErrors && !testProvidersArray.length && !notifications.length) {
    return null;
  }

  return (
    <Fragment>
      <Spacer id={SIDEBAR_BOTTOM_SPACER_ID} ref={spacerRef}></Spacer>
      <Content id={SIDEBAR_BOTTOM_WRAPPER_ID} ref={wrapperRef}>
        <NotificationList notifications={notifications} clearNotification={api.clearNotification} />
        {isDevelopment && (
          <TestingModule
            {...{
              testProviders: testProvidersArray,
              errorCount: errors.length,
              errorsActive,
              setErrorsActive,
              warningCount: warnings.length,
              warningsActive,
              setWarningsActive,
            }}
          />
        )}
      </Content>
    </Fragment>
  );
};

export const SidebarBottom = ({ isDevelopment }: { isDevelopment?: boolean }) => {
  const api = useStorybookApi();
  const { notifications, status } = useStorybookState();

  return (
    <SidebarBottomBase
      api={api}
      notifications={notifications}
      status={status}
      isDevelopment={isDevelopment}
    />
  );
};

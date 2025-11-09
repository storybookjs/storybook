import React, { Fragment, useEffect, useRef, useState } from 'react';

import {
  type API_FilterFunction,
  type Addon_Collection,
  type Addon_TestProviderType,
  Addon_TypesEnum,
} from 'storybook/internal/types';

import {
  experimental_useStatusStore,
  experimental_useTestProviderStore,
  internal_fullStatusStore,
  internal_fullTestProviderStore,
} from '#manager-stores';
import { type API, type State, useStorybookApi, useStorybookState } from 'storybook/manager-api';
import { styled } from 'storybook/theming';

import type { TestProviderStateByProviderId } from '../../../shared/test-provider-store';
import { NotificationList } from '../notifications/NotificationList';
import { TestingModule } from './TestingModule';

// This ID is used dynamically add/remove space at the bottom to prevent overlapping the main sidebar content.
const SIDEBAR_BOTTOM_SPACER_ID = 'sidebar-bottom-spacer';
// This ID is used by some integrators to target the (fixed position) sidebar bottom element so it should remain stable.
const SIDEBAR_BOTTOM_WRAPPER_ID = 'sidebar-bottom-wrapper';

const filterNone: API_FilterFunction = () => true;
const filterWarn: API_FilterFunction = ({ statuses = {} }) =>
  Object.values(statuses).some(({ value }) => value === 'status-value:warning');
const filterError: API_FilterFunction = ({ statuses = {} }) =>
  Object.values(statuses).some(({ value }) => value === 'status-value:error');
const filterBoth: API_FilterFunction = ({ statuses = {} }) =>
  Object.values(statuses).some(({ value }) =>
    ['status-value:warning', 'status-value:error'].includes(value as any)
  );

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
  padding: '12px 0',
  margin: '0 12px',
  display: 'flex',
  flexDirection: 'column',
  gap: 12,
  color: theme.color.defaultText,
  fontSize: theme.typography.size.s1,
  overflow: 'hidden',

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
  errorCount: number;
  warningCount: number;
  successCount: number;
  hasStatuses: boolean;
  isDevelopment?: boolean;
  testProviderStates: TestProviderStateByProviderId;
  registeredTestProviders: Addon_Collection<Addon_TestProviderType>;
  onRunAll: () => void;
}

export const SidebarBottomBase = ({
  api,
  notifications = [],
  errorCount,
  warningCount,
  successCount,
  hasStatuses,
  isDevelopment,
  testProviderStates,
  registeredTestProviders,
  onRunAll,
}: SidebarBottomProps) => {
  const spacerRef = useRef<HTMLDivElement | null>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const [warningsActive, setWarningsActive] = useState(false);
  const [errorsActive, setErrorsActive] = useState(false);

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
    const filter = getFilter(warningCount > 0 && warningsActive, errorCount > 0 && errorsActive);
    api.experimental_setFilter('sidebar-bottom-filter', filter);
  }, [api, warningCount, errorCount, warningsActive, errorsActive]);

  if (
    !warningCount &&
    !errorCount &&
    Object.values(registeredTestProviders).length === 0 &&
    notifications.length === 0
  ) {
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
              registeredTestProviders,
              testProviderStates,
              onRunAll: () => {
                onRunAll();
                setErrorsActive(false);
                setWarningsActive(false);
              },
              hasStatuses,
              clearStatuses: () => {
                internal_fullStatusStore.unset();
                internal_fullTestProviderStore.clearAll();
                setErrorsActive(false);
                setWarningsActive(false);
              },
              errorCount,
              errorsActive,
              setErrorsActive,
              warningCount,
              warningsActive,
              setWarningsActive,
              successCount,
            }}
          />
        )}
      </Content>
    </Fragment>
  );
};

export const SidebarBottom = ({ isDevelopment }: { isDevelopment?: boolean }) => {
  const api = useStorybookApi();
  const registeredTestProviders = api.getElements(Addon_TypesEnum.experimental_TEST_PROVIDER);
  const { notifications } = useStorybookState();
  const { hasStatuses, errorCount, warningCount, successCount } = experimental_useStatusStore(
    (statuses) => {
      return Object.values(statuses).reduce(
        (result, storyStatuses) => {
          Object.values(storyStatuses).forEach((status) => {
            result.hasStatuses = true;
            if (status.value === 'status-value:error') {
              result.errorCount += 1;
            }
            if (status.value === 'status-value:warning') {
              result.warningCount += 1;
            }
            if (status.value === 'status-value:success') {
              result.successCount += 1;
            }
          });
          return result;
        },
        { errorCount: 0, warningCount: 0, successCount: 0, hasStatuses: false }
      );
    }
  );

  const testProviderStates = experimental_useTestProviderStore();

  return (
    <SidebarBottomBase
      api={api}
      notifications={notifications}
      hasStatuses={hasStatuses}
      errorCount={errorCount}
      warningCount={warningCount}
      successCount={successCount}
      isDevelopment={isDevelopment}
      testProviderStates={testProviderStates}
      registeredTestProviders={registeredTestProviders}
      onRunAll={internal_fullTestProviderStore.runAll}
    />
  );
};

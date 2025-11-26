import React, {
  type ComponentProps,
  type ReactNode,
  type SyntheticEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';

import { once } from 'storybook/internal/client-logger';
import { ActionList, Card } from 'storybook/internal/components';
import type {
  Addon_Collection,
  Addon_TestProviderType,
  TestProviderStateByProviderId,
} from 'storybook/internal/types';

import { ChevronSmallUpIcon, PlayAllHollowIcon, SweepIcon } from '@storybook/icons';

import { internal_fullTestProviderStore } from '#manager-stores';
import { styled } from 'storybook/theming';

import { Optional } from '../Optional/Optional';
import { useDynamicFavicon } from './useDynamicFavicon';

const DEFAULT_HEIGHT = 500;

const HoverCard = styled(Card)({
  display: 'flex',
  flexDirection: 'column-reverse',

  '&:hover #testing-module-collapse-toggle': {
    opacity: 1,
  },
});

const Collapsible = styled.div(({ theme }) => ({
  overflow: 'hidden',
  boxShadow: `inset 0 -1px 0 ${theme.appBorderColor}`,
}));

const Content = styled.div({
  display: 'flex',
  flexDirection: 'column',
});

const Bar = styled.div<{ onClick?: (e: SyntheticEvent) => void }>(({ onClick }) => ({
  display: 'flex',
  width: '100%',
  cursor: onClick ? 'pointer' : 'default',
  userSelect: 'none',
  alignItems: 'center',
  justifyContent: 'space-between',
  overflow: 'hidden',
  padding: 4,
  gap: 4,
}));

const Action = styled.div({
  display: 'flex',
  flexBasis: '100%',
  containerType: 'inline-size',
});

const Filters = styled.div({
  display: 'flex',
  justifyContent: 'flex-end',
  gap: 4,
});

const CollapseToggle = styled(ActionList.Button)({
  opacity: 0,
  transition: 'opacity 250ms',
  '&:focus, &:hover': {
    opacity: 1,
  },
});

const RunButton = ({
  children,
  isRunning,
  onRunAll,
  ...props
}: { children?: ReactNode; isRunning: boolean; onRunAll: () => void } & ComponentProps<
  typeof ActionList.Button
>) => (
  <ActionList.Button
    ariaLabel={isRunning ? 'Running...' : 'Run tests'}
    tooltip={isRunning ? 'Running tests...' : 'Start all tests'}
    disabled={isRunning}
    onClick={(e: SyntheticEvent) => {
      e.stopPropagation();
      onRunAll();
    }}
    {...props}
  >
    <ActionList.Icon>
      <PlayAllHollowIcon />
    </ActionList.Icon>
    {children}
  </ActionList.Button>
);

const StatusButton = styled(ActionList.Toggle)<{
  pressed: boolean;
  status: 'negative' | 'warning';
}>(
  { minWidth: 28, outlineOffset: -2 },
  ({ pressed, status, theme }) =>
    !pressed &&
    (theme.base === 'light'
      ? {
          background: {
            negative: theme.background.negative,
            warning: theme.background.warning,
          }[status],
          color: {
            negative: theme.color.negativeText,
            warning: theme.color.warningText,
          }[status],
        }
      : {
          background: {
            negative: `${theme.color.negative}22`,
            warning: `${theme.color.warning}22`,
          }[status],
          color: {
            negative: theme.color.negative,
            warning: theme.color.warning,
          }[status],
        })
);

const TestProvider = styled.div(({ theme }) => ({
  padding: 4,

  '&:not(:last-child)': {
    boxShadow: `inset 0 -1px 0 ${theme.appBorderColor}`,
  },
}));

interface TestingModuleProps {
  registeredTestProviders: Addon_Collection<Addon_TestProviderType>;
  testProviderStates: TestProviderStateByProviderId;
  hasStatuses: boolean;
  clearStatuses: () => void;
  onRunAll: () => void;
  errorCount: number;
  errorsActive: boolean;
  setErrorsActive: (active: boolean) => void;
  warningCount: number;
  warningsActive: boolean;
  setWarningsActive: (active: boolean) => void;
  successCount: number;
}

export const TestingWidget = ({
  registeredTestProviders,
  testProviderStates,
  hasStatuses,
  clearStatuses,
  onRunAll,
  errorCount,
  errorsActive,
  setErrorsActive,
  warningCount,
  warningsActive,
  setWarningsActive,
  successCount,
}: TestingModuleProps) => {
  const timeoutRef = useRef<null | ReturnType<typeof setTimeout>>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [maxHeight, setMaxHeight] = useState(DEFAULT_HEIGHT);
  const [isCollapsed, setCollapsed] = useState(true);
  const [isChangingCollapse, setChangingCollapse] = useState(false);
  const [isUpdated, setIsUpdated] = useState(false);
  const settingsUpdatedTimeoutRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    const unsubscribe = internal_fullTestProviderStore.onSettingsChanged(() => {
      setIsUpdated(true);
      clearTimeout(settingsUpdatedTimeoutRef.current);
      settingsUpdatedTimeoutRef.current = setTimeout(() => {
        setIsUpdated(false);
      }, 1000);
    });
    return () => {
      unsubscribe();
      clearTimeout(settingsUpdatedTimeoutRef.current);
    };
  }, []);

  useEffect(() => {
    if (contentRef.current) {
      setMaxHeight(contentRef.current?.getBoundingClientRect().height || DEFAULT_HEIGHT);

      const resizeObserver = new ResizeObserver(() => {
        requestAnimationFrame(() => {
          if (contentRef.current && !isCollapsed) {
            const height = contentRef.current?.getBoundingClientRect().height || DEFAULT_HEIGHT;

            setMaxHeight(height);
          }
        });
      });
      resizeObserver.observe(contentRef.current);
      return () => resizeObserver.disconnect();
    }
  }, [isCollapsed]);

  const toggleCollapsed = useCallback((event?: SyntheticEvent, value?: boolean) => {
    event?.stopPropagation();
    setChangingCollapse(true);
    setCollapsed((s) => value ?? !s);
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = setTimeout(() => {
      setChangingCollapse(false);
    }, 250);
  }, []);

  const isRunning = Object.values(testProviderStates).some(
    (testProviderState) => testProviderState === 'test-provider-state:running'
  );
  const isCrashed = Object.values(testProviderStates).some(
    (testProviderState) => testProviderState === 'test-provider-state:crashed'
  );
  const hasTestProviders = Object.values(registeredTestProviders).length > 0;

  useEffect(() => {
    if (isCrashed && isCollapsed) {
      toggleCollapsed(undefined, false);
    }
  }, [isCrashed, isCollapsed, toggleCollapsed]);

  useDynamicFavicon(
    isCrashed
      ? 'critical'
      : errorCount > 0
        ? 'negative'
        : warningCount > 0
          ? 'warning'
          : isRunning
            ? 'active'
            : successCount > 0
              ? 'positive'
              : undefined
  );

  if (!hasTestProviders && !errorCount && !warningCount) {
    return null;
  }

  return (
    <HoverCard
      id="storybook-testing-module"
      data-updated={isUpdated}
      outlineAnimation={isRunning ? 'spin' : 'none'}
      outlineColor={
        isCrashed || (isRunning && errorCount > 0) ? 'negative' : isUpdated ? 'positive' : undefined
      }
    >
      <Bar {...(hasTestProviders ? { onClick: (e) => toggleCollapsed(e) } : {})}>
        <Action>
          {hasTestProviders && (
            <Optional
              content={
                <RunButton isRunning={isRunning} onRunAll={onRunAll}>
                  {isRunning ? 'Running...' : 'Run tests'}
                </RunButton>
              }
              fallback={<RunButton isRunning={isRunning} onRunAll={onRunAll} />}
            />
          )}
        </Action>
        <Filters>
          {hasTestProviders && (
            <CollapseToggle
              onClick={(e) => toggleCollapsed(e)}
              id="testing-module-collapse-toggle"
              ariaLabel={isCollapsed ? 'Expand testing module' : 'Collapse testing module'}
            >
              <ChevronSmallUpIcon
                style={{
                  transform: isCollapsed ? 'none' : 'rotate(180deg)',
                  transition: 'transform 250ms',
                }}
              />
            </CollapseToggle>
          )}

          {errorCount > 0 && (
            <StatusButton
              id="errors-found-filter"
              size="medium"
              variant="ghost"
              padding={errorCount < 10 ? 'medium' : 'small'}
              status="negative"
              pressed={errorsActive}
              onClick={(e: SyntheticEvent) => {
                e.stopPropagation();
                setErrorsActive(!errorsActive);
              }}
              ariaLabel={`Filter main navigation to show ${errorCount} tests with errors`}
              tooltip={
                errorsActive
                  ? 'Clear test error filter'
                  : `Filter sidebar to show ${errorCount} tests with errors`
              }
            >
              {errorCount < 1000 ? errorCount : '999+'}
            </StatusButton>
          )}
          {warningCount > 0 && (
            <StatusButton
              id="warnings-found-filter"
              size="medium"
              variant="ghost"
              padding={warningCount < 10 ? 'medium' : 'small'}
              status="warning"
              pressed={warningsActive}
              onClick={(e: SyntheticEvent) => {
                e.stopPropagation();
                setWarningsActive(!warningsActive);
              }}
              ariaLabel={`Filter main navigation to show ${warningCount} tests with warnings`}
              tooltip={
                warningsActive
                  ? 'Clear test warning filter'
                  : `Filter sidebar to show ${warningCount} tests with warnings`
              }
            >
              {warningCount < 1000 ? warningCount : '999+'}
            </StatusButton>
          )}
          {hasStatuses && (
            <ActionList.Button
              id="clear-statuses"
              onClick={(e: SyntheticEvent) => {
                e.stopPropagation();
                clearStatuses();
              }}
              disabled={isRunning}
              ariaLabel={
                isRunning ? "Can't clear statuses while tests are running" : 'Clear all statuses'
              }
            >
              <SweepIcon />
            </ActionList.Button>
          )}
        </Filters>
      </Bar>

      {hasTestProviders && (
        <Collapsible
          data-testid="collapse"
          {...(isCollapsed && { inert: '' })}
          style={{
            transition: isChangingCollapse ? 'max-height 250ms' : 'max-height 0ms',
            display: hasTestProviders ? 'block' : 'none',
            maxHeight: isCollapsed ? 0 : maxHeight,
          }}
        >
          <Content ref={contentRef}>
            {Object.values(registeredTestProviders).map((registeredTestProvider) => {
              const { render: Render, id } = registeredTestProvider;
              if (!Render) {
                once.warn(
                  `No render function found for test provider with id '${id}', skipping...`
                );
                return null;
              }
              return (
                <TestProvider key={id} data-module-id={id}>
                  <Render />
                </TestProvider>
              );
            })}
          </Content>
        </Collapsible>
      )}
    </HoverCard>
  );
};

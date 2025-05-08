import React, { type SyntheticEvent, useCallback, useEffect, useRef, useState } from 'react';

import { once } from 'storybook/internal/client-logger';
import { Button, IconButton, TooltipNote } from 'storybook/internal/components';
import { WithTooltip } from 'storybook/internal/components';
import type {
  Addon_Collection,
  Addon_TestProviderType,
  TestProviderStateByProviderId,
} from 'storybook/internal/types';

import { ChevronSmallUpIcon, PlayAllHollowIcon, SweepIcon } from '@storybook/icons';

import { internal_fullTestProviderStore } from '#manager-stores';
import { keyframes, styled } from 'storybook/theming';

const DEFAULT_HEIGHT = 500;

const spin = keyframes({
  '0%': { transform: 'rotate(0deg)' },
  '10%': { transform: 'rotate(10deg)' },
  '40%': { transform: 'rotate(170deg)' },
  '50%': { transform: 'rotate(180deg)' },
  '60%': { transform: 'rotate(190deg)' },
  '90%': { transform: 'rotate(350deg)' },
  '100%': { transform: 'rotate(360deg)' },
});

const Outline = styled.div<{
  crashed: boolean;
  failed: boolean;
  running: boolean;
  updated: boolean;
}>(({ crashed, failed, running, updated, theme }) => ({
  position: 'relative',
  lineHeight: '16px',
  width: '100%',
  padding: 1,
  overflow: 'hidden',
  backgroundColor: `var(--sb-sidebar-bottom-card-background, ${theme.background.content})`,
  borderRadius:
    `var(--sb-sidebar-bottom-card-border-radius, ${theme.appBorderRadius + 1}px)` as any,
  boxShadow: `inset 0 0 0 1px ${crashed && !running ? theme.color.negative : updated ? theme.color.positive : theme.appBorderColor}, var(--sb-sidebar-bottom-card-box-shadow, 0 1px 2px 0 rgba(0, 0, 0, 0.05), 0px -5px 20px 10px ${theme.background.app})`,
  transition: 'box-shadow 1s',

  '&:after': {
    content: '""',
    display: running ? 'block' : 'none',
    position: 'absolute',
    left: '50%',
    top: '50%',
    marginLeft: 'calc(max(100vw, 100vh) * -0.5)',
    marginTop: 'calc(max(100vw, 100vh) * -0.5)',
    height: 'max(100vw, 100vh)',
    width: 'max(100vw, 100vh)',
    animation: `${spin} 3s linear infinite`,
    background: failed
      ? // Hardcoded colors to prevent themes from messing with them (orange+gold, secondary+seafoam)
        `conic-gradient(transparent 90deg, #FC521F 150deg, #FFAE00 210deg, transparent 270deg)`
      : `conic-gradient(transparent 90deg, #029CFD 150deg, #37D5D3 210deg, transparent 270deg)`,
    opacity: 1,
    willChange: 'auto',
  },
}));

const Card = styled.div(({ theme }) => ({
  position: 'relative',
  zIndex: 1,
  borderRadius: theme.appBorderRadius,
  backgroundColor: theme.background.content,

  '&:hover #testing-module-collapse-toggle': {
    opacity: 1,
  },
}));

const Collapsible = styled.div(({ theme }) => ({
  overflow: 'hidden',

  willChange: 'auto',
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

const CollapseToggle = styled(Button)({
  opacity: 0,
  transition: 'opacity 250ms',
  willChange: 'auto',
  '&:focus, &:hover': {
    opacity: 1,
  },
});

const RunButton = styled(Button)({
  // 90px is the width of the button when the label is visible
  '@container (max-width: 90px)': {
    span: {
      display: 'none',
    },
  },
});

const StatusButton = styled(Button)<{ status: 'negative' | 'warning' }>(
  { minWidth: 28 },
  ({ active, status, theme }) =>
    !active &&
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
}

export const TestingModule = ({
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

  if (!hasTestProviders && (!errorCount || !warningCount)) {
    return null;
  }

  return (
    <Outline
      id="storybook-testing-module"
      running={isRunning}
      crashed={isCrashed}
      failed={errorCount > 0}
      updated={isUpdated}
    >
      <Card>
        {hasTestProviders && (
          <Collapsible
            data-testid="collapse"
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

        <Bar {...(hasTestProviders ? { onClick: (e) => toggleCollapsed(e) } : {})}>
          <Action>
            {hasTestProviders && (
              <WithTooltip
                hasChrome={false}
                tooltip={<TooltipNote note={isRunning ? 'Running tests...' : 'Start all tests'} />}
                trigger="hover"
              >
                <RunButton
                  size="medium"
                  variant="ghost"
                  padding="small"
                  onClick={(e: SyntheticEvent) => {
                    e.stopPropagation();
                    onRunAll();
                  }}
                  disabled={isRunning}
                >
                  <PlayAllHollowIcon />
                  <span>{isRunning ? 'Running...' : 'Run tests'}</span>
                </RunButton>
              </WithTooltip>
            )}
          </Action>
          <Filters>
            {hasTestProviders && (
              <WithTooltip
                hasChrome={false}
                tooltip={
                  <TooltipNote
                    note={isCollapsed ? 'Expand testing module' : 'Collapse testing module'}
                  />
                }
                trigger="hover"
              >
                <CollapseToggle
                  size="medium"
                  variant="ghost"
                  padding="small"
                  onClick={(e) => toggleCollapsed(e)}
                  id="testing-module-collapse-toggle"
                  aria-label={isCollapsed ? 'Expand testing module' : 'Collapse testing module'}
                >
                  <ChevronSmallUpIcon
                    style={{
                      transform: isCollapsed ? 'none' : 'rotate(180deg)',
                      transition: 'transform 250ms',
                      willChange: 'auto',
                    }}
                  />
                </CollapseToggle>
              </WithTooltip>
            )}

            {errorCount > 0 && (
              <WithTooltip
                hasChrome={false}
                tooltip={<TooltipNote note="Toggle errors" />}
                trigger="hover"
              >
                <StatusButton
                  id="errors-found-filter"
                  size="medium"
                  variant="ghost"
                  padding={errorCount < 10 ? 'medium' : 'small'}
                  status="negative"
                  active={errorsActive}
                  onClick={(e: SyntheticEvent) => {
                    e.stopPropagation();
                    setErrorsActive(!errorsActive);
                  }}
                  aria-label="Toggle errors"
                >
                  {errorCount < 1000 ? errorCount : '999+'}
                </StatusButton>
              </WithTooltip>
            )}
            {warningCount > 0 && (
              <WithTooltip
                hasChrome={false}
                tooltip={<TooltipNote note="Toggle warnings" />}
                trigger="hover"
              >
                <StatusButton
                  id="warnings-found-filter"
                  size="medium"
                  variant="ghost"
                  padding={warningCount < 10 ? 'medium' : 'small'}
                  status="warning"
                  active={warningsActive}
                  onClick={(e: SyntheticEvent) => {
                    e.stopPropagation();
                    setWarningsActive(!warningsActive);
                  }}
                  aria-label="Toggle warnings"
                >
                  {warningCount < 1000 ? warningCount : '999+'}
                </StatusButton>
              </WithTooltip>
            )}
            {hasStatuses && (
              <WithTooltip
                hasChrome={false}
                tooltip={
                  <TooltipNote
                    note={
                      isRunning
                        ? "Can't clear statuses while tests are running"
                        : 'Clear all statuses'
                    }
                  />
                }
                trigger="hover"
              >
                <IconButton
                  id="clear-statuses"
                  size="medium"
                  onClick={(e: SyntheticEvent) => {
                    e.stopPropagation();
                    clearStatuses();
                  }}
                  disabled={isRunning}
                  aria-label={
                    isRunning
                      ? "Can't clear statuses while tests are running"
                      : 'Clear all statuses'
                  }
                >
                  <SweepIcon />
                </IconButton>
              </WithTooltip>
            )}
          </Filters>
        </Bar>
      </Card>
    </Outline>
  );
};

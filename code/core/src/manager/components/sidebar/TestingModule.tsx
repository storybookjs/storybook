import React, { type SyntheticEvent, useEffect, useRef, useState } from 'react';

import { Button, TooltipNote } from '@storybook/core/components';
import { WithTooltip } from '@storybook/core/components';
import { keyframes, styled } from '@storybook/core/theming';
import { ChevronSmallUpIcon, PlayAllHollowIcon } from '@storybook/icons';

import type { TestProviders } from '@storybook/core/core-events';
import { useStorybookApi } from '@storybook/core/manager-api';

import { LegacyRender } from './LegacyRender';

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

const Outline = styled.div<{ crashed: boolean; failed: boolean; running: boolean }>(
  ({ crashed, running, theme, failed }) => ({
    position: 'relative',
    lineHeight: '20px',
    width: '100%',
    padding: 1,
    overflow: 'hidden',
    background: `var(--sb-sidebar-bottom-card-background, ${theme.background.content})`,
    borderRadius:
      `var(--sb-sidebar-bottom-card-border-radius, ${theme.appBorderRadius + 1}px)` as any,
    boxShadow: `inset 0 0 0 1px ${crashed && !running ? theme.color.negative : theme.appBorderColor}, var(--sb-sidebar-bottom-card-box-shadow, 0 1px 2px 0 rgba(0, 0, 0, 0.05), 0px -5px 20px 10px ${theme.background.app})`,
    transitionProperty:
      'color, background-color, border-color, text-decoration-color, fill, stroke',
    transitionTimingFunction: 'cubic-bezier(0.4, 0, 0.2, 1)',
    transitionDuration: '0.15s',

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
  })
);

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
  transition: 'max-height 250ms',
  willChange: 'auto',
  boxShadow: `inset 0 -1px 0 ${theme.appBorderColor}`,
}));

const Content = styled.div({
  padding: '12px 6px',
  display: 'flex',
  flexDirection: 'column',
  gap: '12px',
});

const Bar = styled.div<{ onClick?: (e: SyntheticEvent) => void }>(({ onClick }) => ({
  display: 'flex',
  width: '100%',
  cursor: onClick ? 'pointer' : 'default',
  userSelect: 'none',
  alignItems: 'center',
  justifyContent: 'space-between',
  overflow: 'hidden',
  padding: '6px',
}));

const Filters = styled.div({
  display: 'flex',
  flexBasis: '100%',
  justifyContent: 'flex-end',
  gap: 6,
});

const CollapseToggle = styled(Button)({
  opacity: 0,
  transition: 'opacity 250ms',
  willChange: 'auto',
  '&:focus, &:hover': {
    opacity: 1,
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

const TestProvider = styled.div({
  display: 'flex',
  justifyContent: 'space-between',
  gap: 6,
});

interface TestingModuleProps {
  testProviders: TestProviders[keyof TestProviders][];
  errorCount: number;
  errorsActive: boolean;
  setErrorsActive: (active: boolean) => void;
  warningCount: number;
  warningsActive: boolean;
  setWarningsActive: (active: boolean) => void;
}

export const TestingModule = ({
  testProviders,
  errorCount,
  errorsActive,
  setErrorsActive,
  warningCount,
  warningsActive,
  setWarningsActive,
}: TestingModuleProps) => {
  const api = useStorybookApi();
  const contentRef = useRef<HTMLDivElement>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [maxHeight, setMaxHeight] = useState(DEFAULT_HEIGHT);

  useEffect(() => {
    setMaxHeight(contentRef.current?.offsetHeight || DEFAULT_HEIGHT);
  }, []);

  const toggleCollapsed = () => {
    setMaxHeight(contentRef.current?.offsetHeight || DEFAULT_HEIGHT);
    setCollapsed(!collapsed);
  };

  const running = testProviders.some((tp) => tp.running);
  const crashed = testProviders.some((tp) => tp.crashed);
  const failed = testProviders.some((tp) => tp.failed);
  const testing = testProviders.length > 0;

  return (
    <Outline
      id="storybook-testing-module"
      running={running}
      crashed={crashed}
      failed={failed || errorCount > 0}
    >
      <Card>
        <Collapsible
          style={{
            display: testing ? 'block' : 'none',
            maxHeight: collapsed ? 0 : maxHeight,
          }}
        >
          <Content ref={contentRef}>
            {testProviders.map((state) => {
              const { render: Render } = state;
              return (
                <TestProvider key={state.id} data-module-id={state.id}>
                  {Render ? <Render {...state} /> : <LegacyRender {...state} />}
                </TestProvider>
              );
            })}
          </Content>
        </Collapsible>

        <Bar onClick={testing ? toggleCollapsed : undefined}>
          {testing && (
            <Button
              variant="ghost"
              padding="small"
              onClick={(e: SyntheticEvent) => {
                e.stopPropagation();
                testProviders
                  .filter((state) => !state.crashed && !state.running && state.runnable)
                  .forEach(({ id }) => api.runTestProvider(id));
              }}
              disabled={running}
            >
              <PlayAllHollowIcon />
              {running ? 'Running...' : 'Run tests'}
            </Button>
          )}
          <Filters>
            {testing && (
              <CollapseToggle
                variant="ghost"
                padding="small"
                onClick={toggleCollapsed}
                id="testing-module-collapse-toggle"
                aria-label={collapsed ? 'Expand testing module' : 'Collapse testing module'}
              >
                <ChevronSmallUpIcon
                  style={{
                    transform: collapsed ? 'none' : 'rotate(180deg)',
                    transition: 'transform 250ms',
                    willChange: 'auto',
                  }}
                />
              </CollapseToggle>
            )}

            {errorCount > 0 && (
              <WithTooltip
                hasChrome={false}
                tooltip={<TooltipNote note="Toggle errors" />}
                trigger="hover"
              >
                <StatusButton
                  id="errors-found-filter"
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
                  {errorCount < 100 ? errorCount : '99+'}
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
                  {warningCount < 100 ? warningCount : '99+'}
                </StatusButton>
              </WithTooltip>
            )}
          </Filters>
        </Bar>
      </Card>
    </Outline>
  );
};

import React, { useCallback, useEffect, useState } from 'react';

import {
  AddonPanel,
  Badge,
  IconButton,
  Link as LinkComponent,
  Spaced,
  WithTooltip,
} from 'storybook/internal/components';
import { TESTING_MODULE_RUN_ALL_REQUEST } from 'storybook/internal/core-events';
import type { Combo } from 'storybook/internal/manager-api';
import { Consumer, addons, types, useAddonState } from 'storybook/internal/manager-api';
import {
  type API_StatusObject,
  type API_StatusValue,
  type Addon_TestProviderType,
  Addon_TypesEnum,
} from 'storybook/internal/types';

import { WandIcon } from '@storybook/icons';

import { Panel } from './Panel';
import { GlobalErrorModal } from './components/GlobalErrorModal';
import { ADDON_ID, PANEL_ID, TEST_PROVIDER_ID, getUniversalState } from './constants';
import type { TestResult } from './node/reporter';
import { useUniversalState } from './use-universal-state-manager';

function Title() {
  const [addonState = {}] = useAddonState(ADDON_ID);
  const { hasException, interactionsCount } = addonState as any;

  return (
    <div>
      <Spaced col={1}>
        <span style={{ display: 'inline-block', verticalAlign: 'middle' }}>Component tests</span>
        {interactionsCount && !hasException ? (
          <Badge status="neutral">{interactionsCount}</Badge>
        ) : null}
        {hasException ? <Badge status="negative">{interactionsCount}</Badge> : null}
      </Spaced>
    </div>
  );
}

const statusMap: Record<any['status'], API_StatusValue> = {
  failed: 'error',
  passed: 'success',
  pending: 'pending',
};

export function getRelativeTimeString(date: Date): string {
  const delta = Math.round((date.getTime() - Date.now()) / 1000);
  const cutoffs = [60, 3600, 86400, 86400 * 7, 86400 * 30, 86400 * 365, Infinity];
  const units: Intl.RelativeTimeFormatUnit[] = [
    'second',
    'minute',
    'hour',
    'day',
    'week',
    'month',
    'year',
  ];

  const unitIndex = cutoffs.findIndex((cutoff) => cutoff > Math.abs(delta));
  const divisor = unitIndex ? cutoffs[unitIndex - 1] : 1;
  const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
  return rtf.format(Math.floor(delta / divisor), units[unitIndex]);
}

const RelativeTime = ({ timestamp, testCount }: { timestamp: Date; testCount: number }) => {
  const [relativeTimeString, setRelativeTimeString] = useState(null);

  useEffect(() => {
    if (timestamp) {
      setRelativeTimeString(getRelativeTimeString(timestamp).replace(/^now$/, 'just now'));

      const interval = setInterval(() => {
        setRelativeTimeString(getRelativeTimeString(timestamp).replace(/^now$/, 'just now'));
      }, 10000);

      return () => clearInterval(interval);
    }
  }, [timestamp]);

  return (
    relativeTimeString &&
    `Ran ${testCount} ${testCount === 1 ? 'test' : 'tests'} ${relativeTimeString}`
  );
};

addons.register(ADDON_ID, (api) => {
  const myUniversalState = getUniversalState(api.getChannel());

  myUniversalState.subscribe((state) => {
    console.log('MANAGER: State updated: \n', JSON.stringify(state, null, 2));
  });

  setInterval(() => {
    myUniversalState.state = {
      message: 'MANAGER TIMER: updated state',
      randomNumber: Math.random(),
    };
  }, 8_000);

  const storybookBuilder = (globalThis as any).STORYBOOK_BUILDER || '';
  if (storybookBuilder.includes('vite')) {
    const openAddonPanel = () => {
      api.setSelectedPanel(PANEL_ID);
      api.togglePanel(true);
    };

    addons.add(TEST_PROVIDER_ID, {
      type: Addon_TypesEnum.experimental_TEST_PROVIDER,
      runnable: true,
      watchable: true,

      name: 'Component tests',
      title: ({ crashed, failed }) =>
        crashed || failed ? 'Component tests failed' : 'Component tests',
      description: ({ failed, running, watching, progress, crashed, error }) => {
        const [isModalOpen, setIsModalOpen] = useState(false);
        const [universalState, setUniversalState] = useUniversalState(myUniversalState);

        const errorMessage = error?.message;

        let message: string | React.ReactNode = 'Not run';

        if (running) {
          message = progress
            ? `Testing... ${progress.numPassedTests}/${progress.numTotalTests}`
            : 'Starting...';
        } else if (failed && !errorMessage) {
          message = '';
        } else if (crashed || (failed && errorMessage)) {
          message = (
            <>
              <LinkComponent
                isButton
                onClick={() => {
                  setIsModalOpen(true);
                }}
              >
                {error?.name || 'View full error'}
              </LinkComponent>
            </>
          );
        } else if (progress?.finishedAt) {
          message = (
            <RelativeTime
              timestamp={new Date(progress.finishedAt)}
              testCount={progress.numTotalTests}
            />
          );
        } else if (watching) {
          message = 'Watching for file changes';
        }

        return (
          <>
            {message}
            <div
              style={{
                position: 'fixed',
                left: 0,
                bottom: 0,
                width: '400px',
                height: '150px',
                background: 'white',
                color: 'black',
                border: '2px solid red',
              }}
              onClick={() => {
                setUniversalState({
                  message: 'USER TEST PROVIDER: updated state',
                  randomNumber: Math.random(),
                });
              }}
            >
              <pre>
                <code>{JSON.stringify(universalState, null, 2)}</code>
              </pre>
            </div>
            <GlobalErrorModal
              error={errorMessage}
              open={isModalOpen}
              onClose={() => {
                setIsModalOpen(false);
              }}
              onRerun={() => {
                setIsModalOpen(false);
                api
                  .getChannel()
                  .emit(TESTING_MODULE_RUN_ALL_REQUEST, { providerId: TEST_PROVIDER_ID });
              }}
            />
          </>
        );
      },

      mapStatusUpdate: (state) =>
        Object.fromEntries(
          (state.details.testResults || []).flatMap((testResult) =>
            testResult.results
              .map(({ storyId, status, testRunId, ...rest }) => {
                if (storyId) {
                  const statusObject: API_StatusObject = {
                    title: 'Component tests',
                    status: statusMap[status],
                    description:
                      'failureMessages' in rest && rest.failureMessages?.length
                        ? rest.failureMessages.join('\n')
                        : '',
                    data: {
                      testRunId,
                    },
                    onClick: openAddonPanel,
                  };
                  return [storyId, statusObject];
                }
              })
              .filter(Boolean)
          )
        ),
    } as Addon_TestProviderType<{
      testResults: TestResult[];
    }>);
  }

  addons.add(PANEL_ID, {
    type: types.PANEL,
    title: Title,
    match: ({ viewMode }) => viewMode === 'story',
    render: ({ active }) => {
      const newLocal = useCallback(({ state }: Combo) => {
        return {
          storyId: state.storyId,
        };
      }, []);

      const [universalState, setUniversalState] = useUniversalState(myUniversalState);

      return (
        <AddonPanel active={active}>
          <div
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              width: '400px',
              height: '150px',
              background: 'white',
              color: 'black',
              border: '2px solid red',
            }}
            onClick={() => {
              setUniversalState({
                message: 'USER PANEL: updated state',
                randomNumber: Math.random(),
              });
            }}
          >
            <pre>
              <code>{JSON.stringify(universalState, null, 2)}</code>
            </pre>
          </div>
          <Consumer filter={newLocal}>{({ storyId }) => <Panel storyId={storyId} />}</Consumer>
        </AddonPanel>
      );
    },
  });

  addons.add(PANEL_ID, {
    title: '',
    type: types.TOOL,
    match: ({ viewMode, tabId }) => viewMode === 'story' && !tabId,
    render: () => {
      const [universalState, setUniversalState] = useUniversalState(myUniversalState);

      return (
        <WithTooltip
          placement="top"
          tooltip={() => {
            return (
              <div
                style={{
                  position: 'absolute',
                  left: 0,
                  top: 0,
                  width: '400px',
                  height: '150px',
                  background: 'white',
                  color: 'black',
                  border: '2px solid red',
                }}
                onClick={() => {
                  setUniversalState({
                    message: 'USER TOOLBAR: updated state',
                    randomNumber: Math.random(),
                  });
                }}
              >
                <pre>
                  <code>{JSON.stringify(universalState, null, 2)}</code>
                </pre>
              </div>
            );
          }}
          closeOnOutsideClick
        >
          <IconButton key="filter" title="Debug universal state">
            <WandIcon />
          </IconButton>
        </WithTooltip>
      );
    },
  });
});

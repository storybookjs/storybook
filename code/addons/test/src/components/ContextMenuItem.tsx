import React, {
  type FC,
  type SyntheticEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';

import { Button, ListItem } from 'storybook/internal/components';
import { useStorybookApi } from 'storybook/internal/manager-api';
import { useTheme } from 'storybook/internal/theming';
import { type API_HashEntry, type Addon_TestProviderState } from 'storybook/internal/types';

import { PlayHollowIcon, StopAltHollowIcon } from '@storybook/icons';

import { TEST_PROVIDER_ID } from '../constants';
import type { TestResult } from '../node/reporter';
import { RelativeTime } from './RelativeTime';

export const ContextMenuItem: FC<{
  context: API_HashEntry;
  state: Addon_TestProviderState<{
    testResults: TestResult[];
  }>;
}> = ({ context, state }) => {
  const api = useStorybookApi();
  const [isDisabled, setDisabled] = useState(false);

  const id = useRef(context.id);
  id.current = context.id;

  const Icon = state.running ? StopAltHollowIcon : PlayHollowIcon;

  useEffect(() => {
    setDisabled(false);
  }, [state.running]);

  const onClick = useCallback(
    (event: SyntheticEvent) => {
      setDisabled(true);
      event.stopPropagation();
      if (state.running) {
        api.cancelTestProvider(TEST_PROVIDER_ID);
      } else {
        api.runTestProvider(TEST_PROVIDER_ID, { entryId: id.current });
      }
    },
    [api, state.running]
  );

  const theme = useTheme();

  const title = state.crashed || state.failed ? 'Component tests failed' : 'Component tests';
  const errorMessage = state.error?.message;
  let description: string | React.ReactNode = 'Not run';

  if (state.running) {
    description = state.progress
      ? `Testing... ${state.progress.numPassedTests}/${state.progress.numTotalTests}`
      : 'Starting...';
  } else if (state.failed && !errorMessage) {
    description = '';
  } else if (state.crashed || (state.failed && errorMessage)) {
    description = 'An error occured';
  } else if (state.progress?.finishedAt) {
    description = (
      <RelativeTime
        timestamp={new Date(state.progress.finishedAt)}
        testCount={state.progress.numTotalTests}
      />
    );
  } else if (state.watching) {
    description = 'Watching for file changes';
  }

  return (
    <div
      onClick={(event) => {
        // stopPropagation to prevent the parent from closing the context menu, which is the default behavior onClick
        event.stopPropagation();
      }}
    >
      <ListItem
        title={title}
        center={description}
        right={
          <Button
            onClick={onClick}
            variant="ghost"
            padding="small"
            disabled={state.crashed || isDisabled}
          >
            <Icon fill={theme.barTextColor} />
          </Button>
        }
      />
    </div>
  );
};

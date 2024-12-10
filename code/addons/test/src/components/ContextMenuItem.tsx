import React, {
  type FC,
  type SyntheticEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';

import { Button, ListItem } from 'storybook/internal/components';
import type { TestProviderConfig } from 'storybook/internal/core-events';
import { useStorybookApi } from 'storybook/internal/manager-api';
import { useTheme } from 'storybook/internal/theming';
import { type API_HashEntry, type Addon_TestProviderState } from 'storybook/internal/types';

import { PlayHollowIcon, StopAltHollowIcon } from '@storybook/icons';

import { type Config, type Details, TEST_PROVIDER_ID } from '../constants';
import { Description } from './Description';
import { Title } from './Title';

export const ContextMenuItem: FC<{
  context: API_HashEntry;
  state: TestProviderConfig & Addon_TestProviderState<Details, Config>;
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

  return (
    <div
      onClick={(event) => {
        // stopPropagation to prevent the parent from closing the context menu, which is the default behavior onClick
        event.stopPropagation();
      }}
    >
      <ListItem
        title={<Title state={state} />}
        center={<Description state={state} />}
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

import React, { useCallback } from 'react';

import { IconButton, TooltipLinkList, WithTooltip } from 'storybook/internal/components';
import { useGlobals } from 'storybook/internal/manager-api';
import { color, styled } from 'storybook/internal/theming';

import { ButtonIcon, CheckIcon } from '@storybook/icons';

import { PARAM_KEY, PSEUDO_STATES } from '../constants';

const LinkTitle = styled.span<{ active?: boolean }>(({ active }) => ({
  color: active ? color.secondary : 'inherit',
}));

const LinkIcon = styled(CheckIcon)<{ active?: boolean }>(({ active }) => ({
  opacity: active ? 1 : 0,
  path: { fill: active ? color.secondary : 'inherit' },
}));

const options = Object.keys(PSEUDO_STATES).sort() as (keyof typeof PSEUDO_STATES)[];

export const PseudoStateTool = () => {
  const [globals, updateGlobals] = useGlobals();
  const pseudo = globals[PARAM_KEY];

  const isActive = useCallback(
    (option: keyof typeof PSEUDO_STATES) => {
      if (!pseudo) {
        return false;
      }
      return pseudo[option] === true;
    },
    [pseudo]
  );

  const toggleOption = useCallback(
    (option: keyof typeof PSEUDO_STATES) => () => {
      updateGlobals({
        [PARAM_KEY]: {
          ...pseudo,
          [option]: !isActive(option),
        },
      });
    },
    [pseudo, isActive, updateGlobals]
  );

  return (
    <WithTooltip
      placement="top"
      trigger="click"
      tooltip={() => (
        <TooltipLinkList
          links={options.map((option) => ({
            id: option,
            title: <LinkTitle active={isActive(option)}>:{PSEUDO_STATES[option]}</LinkTitle>,
            right: <LinkIcon width={12} height={12} active={isActive(option)} />,
            onClick: toggleOption(option),
            active: isActive(option),
          }))}
        />
      )}
    >
      <IconButton
        key="pseudo-state"
        title="Select CSS pseudo states"
        active={options.some(isActive)}
      >
        <ButtonIcon />
      </IconButton>
    </WithTooltip>
  );
};

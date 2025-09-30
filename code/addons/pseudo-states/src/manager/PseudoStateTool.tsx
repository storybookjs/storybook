import React, { type ComponentProps, useCallback } from 'react';

import { Form, IconButton, TooltipLinkList, WithTooltip } from 'storybook/internal/components';

import { ButtonIcon, RefreshIcon } from '@storybook/icons';

import { useGlobals } from 'storybook/manager-api';
import { color, styled } from 'storybook/theming';

import { PARAM_KEY, PSEUDO_STATES } from '../constants';

const LinkTitle = styled.span<{ active?: boolean }>(({ active }) => ({
  color: active ? color.secondary : 'inherit',
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

  const hasActive = options.some(isActive);
  const reset = {
    id: 'reset',
    title: 'Reset pseudo states',
    icon: <RefreshIcon style={{ opacity: hasActive ? 1 : 0.7 }} />,
    disabled: !hasActive,
    onClick: () => updateGlobals({ [PARAM_KEY]: {} }),
  };

  const toggleOption = useCallback(
    (option: keyof typeof PSEUDO_STATES) => () => {
      const { [option]: value, ...rest } = pseudo;
      updateGlobals({ [PARAM_KEY]: value === true ? rest : { ...rest, [option]: true } });
    },
    [pseudo, updateGlobals]
  );
  const links: ComponentProps<typeof TooltipLinkList>['links'] = options.map((option) => {
    const active = isActive(option);
    return {
      id: option,
      title: <LinkTitle active={active}>:{PSEUDO_STATES[option]}</LinkTitle>,
      input: <Form.Checkbox checked={active} onChange={toggleOption(option)} />,
      active,
    };
  });

  return (
    <WithTooltip
      placement="top"
      trigger="click"
      closeOnOutsideClick
      tooltip={<TooltipLinkList links={[[reset], links]} />}
    >
      <IconButton key="pseudo-states" title="Select CSS pseudo states" active={hasActive}>
        <ButtonIcon />
      </IconButton>
    </WithTooltip>
  );
};

import type { FC } from 'react';
import React from 'react';

import { Button } from 'storybook/internal/components';

import { getControlSetterButtonId } from './helpers';

interface SetValueButtonProps {
  name: string;
  storyId?: string;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}

export const SetValueButton: FC<SetValueButtonProps> = ({
  name,
  storyId,
  label,
  onClick,
  disabled,
}) => (
  <Button
    ariaLabel={false}
    variant="outline"
    size="medium"
    id={getControlSetterButtonId(name, storyId)}
    onClick={onClick}
    disabled={disabled}
  >
    {label}
  </Button>
);

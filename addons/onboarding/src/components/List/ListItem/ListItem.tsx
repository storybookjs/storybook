import React from 'react';

import { CheckIcon } from '@storybook/icons';

import { ListItemContentWrapper, ListItemIndexWrapper, ListItemWrapper } from './ListItem.styled';

interface ListItemProps {
  children: React.ReactNode;
  index: number;
  isCompleted?: boolean;
}

export const ListItem = ({ children, index, isCompleted }: ListItemProps) => {
  return (
    <ListItemWrapper>
      <ListItemIndexWrapper
        aria-label={isCompleted ? 'complete' : 'not complete'}
        isCompleted={isCompleted!}
      >
        {isCompleted ? <CheckIcon width={10} height={10} color="white" /> : index}
      </ListItemIndexWrapper>
      <ListItemContentWrapper>{children}</ListItemContentWrapper>
    </ListItemWrapper>
  );
};

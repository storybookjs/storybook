import React from 'react';

import { ListWrapper } from './List.styled';

interface ListProps {
  children: React.ReactNode;
}

export const List = ({ children }: ListProps) => {
  return <ListWrapper>{children}</ListWrapper>;
};

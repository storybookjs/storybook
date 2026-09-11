import React from 'react';

import { ListWrapper } from './List.styled.tsx';

interface ListProps {
  children: React.ReactNode;
}

export const List = ({ children }: ListProps) => {
  return <ListWrapper>{children}</ListWrapper>;
};

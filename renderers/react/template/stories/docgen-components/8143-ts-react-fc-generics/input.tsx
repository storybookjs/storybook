import React from 'react';

interface Props {
  padding: string;
  margin: number;
}

export const Text: React.FC<Props> = ({ padding = '0', margin }) => <>Text</>;

export const component = Text;

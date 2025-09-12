import React from 'react';

interface Props {
  padding: string;
  margin: number;
}

// eslint-disable-next-line @typescript-eslint/ban-ts-comment -- we can't expect error as it isn't an error in development but it is in sandbox
// @ts-ignore unused props
export const Text: React.FC<Props> = ({ padding = '0', margin }) => <>Text</>;

export const component = Text;

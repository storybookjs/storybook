import type { FC } from 'react';
import React from 'react';

interface ItemInterface {
  text: string;
  value: string;
}
interface Props {
  onClick?: () => void;
  voidFunc: () => void;
  funcWithArgsAndReturns: (a: string, b: string) => string;
  funcWithUnionArg: (a: string | number) => string;
  funcWithMultipleUnionReturns: () => string | ItemInterface;
}
export const Component: FC<Props> = (props: Props) => <>JSON.stringify(props)</>;

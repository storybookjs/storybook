import type { FC } from 'react';
import React from 'react';

interface Props {
  any: any;
  string: string;
  bool: boolean;
  number: number;
  symbol: symbol;
  readonly readonlyPrimitive: string;
}
export const Component: FC<Props> = (props: Props) => <>JSON.stringify(props)</>;

import type { FC } from 'react';
import React from 'react';

interface Props {
  any?: any;
  string?: string;
  bool?: boolean;
  number?: number;
  symbol?: symbol;
  readonly readonlyPrimitive?: string;
}
export const Component: FC<Props> = ({
  any = 'foo',
  string = 'bar',
  bool = true,
  number = 4,
  ...rest
}: Props) => {
  const props = { any, string, bool, number, ...rest };
  return <>{JSON.stringify(props)}</>;
};

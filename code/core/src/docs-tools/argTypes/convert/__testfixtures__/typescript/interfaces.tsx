import type { FC } from 'react';
import React from 'react';

interface ItemInterface {
  text: string;
  value: string;
}
interface GenericInterface<T> {
  value: T;
}
interface Props {
  interface: ItemInterface;
  genericInterface: GenericInterface<string>;
}
export const Component: FC<Props> = (props: Props) => <>JSON.stringify(props)</>;

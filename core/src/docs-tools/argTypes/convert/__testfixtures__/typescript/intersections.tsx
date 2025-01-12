import type { FC } from 'react';
import React from 'react';

interface ItemInterface {
  text: string;
  value: string;
}
interface PersonInterface {
  name: string;
}
type InterfaceIntersection = ItemInterface & PersonInterface;
interface Props {
  intersectionType: InterfaceIntersection;
  intersectionWithInlineType: ItemInterface & { inlineValue: string };
}
export const Component: FC<Props> = (props: Props) => <>JSON.stringify(props)</>;

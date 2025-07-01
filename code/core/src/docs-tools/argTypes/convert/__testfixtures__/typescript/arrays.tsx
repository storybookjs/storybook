import type { FC } from 'react';
import React from 'react';

interface ItemInterface {
  text: string;
  value: string;
}
interface Point {
  x: number;
  y: number;
}
interface Props {
  arrayOfPoints: Point[];
  arrayOfInlineObjects: { w: number; h: number }[];
  arrayOfPrimitive: string[];
  arrayOfComplexObject: ItemInterface[];
}
export const Component: FC<Props> = (props: Props) => <>JSON.stringify(props)</>;

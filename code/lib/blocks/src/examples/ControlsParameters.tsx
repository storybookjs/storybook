import React from 'react';

type PropTypes = { a?: string; b: string };

export const ControlsParameters = ({ a = 'a', b }: PropTypes) => <div>Example story</div>;

type SubcomponentAPropTypes = { e: boolean; c: boolean; d?: boolean };

export const SubcomponentA = ({ d = false }: SubcomponentAPropTypes) => (
  <div>Example subcomponent A</div>
);

type SubcomponentBPropTypes = { g: number; h: number; f?: number };

export const SubcomponentB = ({ f = 42 }: SubcomponentBPropTypes) => (
  <div>Example subcomponent B</div>
);

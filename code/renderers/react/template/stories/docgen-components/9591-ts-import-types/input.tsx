import React from 'react';

import type { BarProps } from './Bar';

type OtherProps = BarProps & {
  other?: number;
};

const Other = (props: OtherProps) => <span {...props}>Other</span>;

export const component = Other;

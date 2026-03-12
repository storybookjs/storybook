import type { FC } from 'react';
import React from 'react';

import { withMdxComponentOverride } from './withMdxComponentOverride';

const WrapperImpl: FC<
  React.DetailedHTMLProps<React.HTMLAttributes<HTMLDivElement>, HTMLDivElement>
> = ({ children }) => <div style={{ fontFamily: 'sans-serif' }}>{children}</div>;

export const Wrapper = withMdxComponentOverride('Wrapper', WrapperImpl);

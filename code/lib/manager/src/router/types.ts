import type { ReactNode } from 'react';

import type * as R from 'react-router-dom';

import type { Other } from '@storybook/core/internal/deep/types/modules/router';

export type { Other, RenderData } from '@storybook/core/internal/deep/types/modules/router';

export type NavigateOptions = R.NavigateOptions & { plain?: boolean };

export type NavigateFunction = (to: R.To | number, options?: NavigateOptions) => void;

export type RouterData = {
  location: Partial<R.Location>;
  navigate: NavigateFunction;
} & Other;

export interface LinkProps {
  to: string;
  children: ReactNode;
}

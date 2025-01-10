import type { ReactNode } from 'react';

import type * as R from 'react-router-dom';

import type { StoryData } from './utils';

export interface Other extends StoryData {
  path: string;
  singleStory?: boolean;
}

export type NavigateOptions = R.NavigateOptions & { plain?: boolean };

export type NavigateFunction = (to: R.To | number, options?: NavigateOptions) => void;

export type RouterData = {
  location: Partial<R.Location>;
  navigate: NavigateFunction;
} & Other;

export type RenderData = Pick<RouterData, 'location'> & Other;

export interface LinkProps {
  to: string;
  children: ReactNode;
}

import type { ViewportMap } from '../types';

// TODO: remove at 9.0
export interface ViewportAddonParameter {
  disable?: boolean;
  defaultOrientation?: 'portrait' | 'landscape';
  defaultViewport?: string;
  viewports?: ViewportMap;
}

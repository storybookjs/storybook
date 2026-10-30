export const ADDON_ID = 'grid-overlay';
export const GLOBAL_KEY = 'grid';
export const SETTINGS_ROUTE = '/grid-overlay/settings';

/** Settings the Node side serves to the preview. */
export interface GridSettings {
  /** Cell size in pixels. */
  size: number;
  /** Line color, any CSS color. */
  color: string;
}

export const DEFAULT_SETTINGS: GridSettings = { size: 8, color: 'rgba(255, 71, 133, 0.35)' };

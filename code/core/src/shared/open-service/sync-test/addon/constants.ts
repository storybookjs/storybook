export const OPEN_SERVICE_DEMO_ADDON_ID = 'storybook/internal/open-service-sync-demo' as const;
export const OPEN_SERVICE_DEMO_PANEL_ID = `${OPEN_SERVICE_DEMO_ADDON_ID}/panel` as const;
export const OPEN_SERVICE_DEMO_PARAM_KEY = 'openServiceDemo' as const;

export type OpenServiceDemoParameters = {
  enabled: boolean;
};

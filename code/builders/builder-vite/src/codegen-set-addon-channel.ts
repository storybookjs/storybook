export async function generateAddonSetupCode() {
  return `
    import { createBrowserChannel } from 'storybook/internal/channels';
    import { addons } from 'storybook/preview-api';

    const channel = createBrowserChannel({ page: 'preview' });
    addons.setChannel(channel);
    
    if (window.CONFIG_TYPE === 'DEVELOPMENT'){
      window.__STORYBOOK_SERVER_CHANNEL__ = channel;
    }
  `.trim();
}

export const SB_VIRTUAL_FILES = {
  VIRTUAL_APP_FILE: 'virtual:/@storybook/builder-vite/vite-app.js',
  VIRTUAL_STORIES_FILE: 'virtual:/@storybook/builder-vite/storybook-stories.js',
  VIRTUAL_ADDON_SETUP_FILE: 'virtual:/@storybook/builder-vite/setup-addons.js',
};

export const SB_VIRTUAL_FILE_IDS = Object.values(SB_VIRTUAL_FILES);

export function getResolvedVirtualModuleId(virtualModuleId: string) {
  return `\0${virtualModuleId}`;
}

export function getOriginalVirtualModuleId(resolvedVirtualModuleId: string) {
  return resolvedVirtualModuleId.slice(1);
}

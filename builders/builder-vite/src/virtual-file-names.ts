export const SB_VIRTUAL_FILES = {
  VIRTUAL_APP_FILE: '/virtual:/@storybook/builder-vite/vite-app.js',
  VIRTUAL_STORIES_FILE: '/virtual:/@storybook/builder-vite/storybook-stories.js',
  VIRTUAL_PREVIEW_FILE: '/virtual:/@storybook/builder-vite/preview-entry.js',
  VIRTUAL_ADDON_SETUP_FILE: '/virtual:/@storybook/builder-vite/setup-addons.js',
};

export function getResolvedVirtualModuleId(virtualModuleId: string) {
  return `\0${virtualModuleId}`;
}

export function getOriginalVirtualModuleId(resolvedVirtualModuleId: string) {
  return resolvedVirtualModuleId.slice(1);
}

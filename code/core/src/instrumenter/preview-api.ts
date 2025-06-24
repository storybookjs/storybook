/**
 * We do this for mocking purposes, it's a lot easier to mock the a module than the addons channel
 * than it is to mock a globalThis property.
 */

export const addons = globalThis.__STORYBOOK_ADDONS_PREVIEW;

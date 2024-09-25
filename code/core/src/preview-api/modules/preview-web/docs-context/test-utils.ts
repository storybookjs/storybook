import type { CSFFile, PreparedStory } from '@storybook/core/types';

export function csfFileParts(storyId = 'meta--story', metaId = 'meta') {
  // These compose the raw exports of the CSF file
  const component = {};
  const metaExport = { component };
  const storyExport = {};
  const moduleExports = { default: metaExport, story: storyExport };

  // This is the prepared story + CSF file after SB has processed them
  const storyAnnotations = {
    id: storyId,
    moduleExport: storyExport,
  } as CSFFile['stories'][string];
  const story = { id: storyId, moduleExport: storyExport } as PreparedStory;
  const meta = { id: metaId, title: 'Meta', component, moduleExports } as CSFFile['meta'];
  const csfFile = {
    stories: { [storyId]: storyAnnotations },
    meta,
    moduleExports,
  } as CSFFile;

  return {
    component,
    metaExport,
    storyExport,
    moduleExports,
    storyAnnotations,
    story,
    meta,
    csfFile,
  };
}

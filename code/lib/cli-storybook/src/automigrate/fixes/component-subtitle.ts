import picocolors from 'picocolors';

import type { FixFiles } from '../fix-files.ts';
import type { Fix } from '../types.ts';
import {
  LEGACY_SUBTITLE,
  noInheritance,
  transformAnnotations,
  transformStorySource,
} from './component-subtitle-transform.ts';
import { isAtOrPastVersion } from '../helpers/versionBoundary.ts';

export { transformPreviewSource, transformStorySource } from './component-subtitle-transform.ts';

type Project = { files: FixFiles; previewConfigPath?: string; storiesPaths: string[] };

const mentionsLegacySubtitle = async (files: FixFiles, paths: string[]) => {
  for (const path of paths) {
    if ((await files.read(path)).includes(LEGACY_SUBTITLE)) {
      return true;
    }
  }
  return false;
};

const migrateComponentSubtitle = async ({ files, previewConfigPath, storiesPaths }: Project) => {
  let inherited = noInheritance;
  const changed: string[] = [];
  if (
    previewConfigPath &&
    (await mentionsLegacySubtitle(files, [previewConfigPath, ...storiesPaths]))
  ) {
    changed.push(
      ...(await files.edit(previewConfigPath, (source) => {
        const preview = transformAnnotations(source, 'preview', noInheritance);
        inherited = preview.inheritance;
        return preview.code;
      }))
    );
  }
  changed.push(
    ...(await files.edit(storiesPaths, (source) => transformStorySource(source, inherited)))
  );
  return changed;
};

export const componentSubtitle: Fix<{ filesToChange: string[] }> = {
  id: 'component-subtitle',
  link: 'https://github.com/storybookjs/storybook/blob/next/MIGRATION.md#parameterscomponentsubtitle-removed',

  async check(options) {
    if (
      options.isUpgrade &&
      (!options.beforeVersion || isAtOrPastVersion(options.beforeVersion, '11.0.0'))
    ) {
      return null;
    }
    const filesToChange = await migrateComponentSubtitle(options);
    return filesToChange.length > 0 ? { filesToChange } : null;
  },

  prompt() {
    return `Move deprecated ${picocolors.cyan('parameters.componentSubtitle')} values to ${picocolors.cyan('parameters.docs.subtitle')}`;
  },

  async run(options) {
    await migrateComponentSubtitle(options);
  },
};

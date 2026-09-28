import picocolors from 'picocolors';

import type { Fix } from '../types.ts';
import {
  ComponentSubtitleMigrationError,
  type Inheritance,
  LEGACY_SUBTITLE,
  noInheritance,
  transformAnnotations,
} from './component-subtitle-transform.ts';
import { isAtOrPastVersion } from '../helpers/versionBoundary.ts';

export { transformPreviewSource, transformStorySource } from './component-subtitle-transform.ts';

export const componentSubtitle: Fix = {
  id: 'component-subtitle',
  link: 'https://github.com/storybookjs/storybook/blob/next/MIGRATION.md#parameterscomponentsubtitle-removed',

  async check({ isUpgrade, beforeVersion }) {
    if (isUpgrade && (!beforeVersion || isAtOrPastVersion(beforeVersion, '11.0.0'))) {
      return null;
    }
    return {};
  },

  prompt() {
    return `Move deprecated ${picocolors.cyan('parameters.componentSubtitle')} values to ${picocolors.cyan('parameters.docs.subtitle')}`;
  },

  transform: () => {
    let previewSource: string | undefined;
    let preview: { inheritance: Inheritance } | { error: unknown } | undefined;

    // A story that migrates needs to know whether the preview's subtitle can win over its own, so a
    // preview without the legacy key is only parsed once a story needs it.
    const previewInheritance = () => {
      if (previewSource === undefined) {
        return noInheritance;
      }
      if (!preview) {
        try {
          preview = {
            inheritance: transformAnnotations(previewSource, 'preview', noInheritance).inheritance,
          };
        } catch (error) {
          preview = { error };
        }
      }
      if ('error' in preview) {
        const reason = preview.error instanceof Error ? preview.error.message : preview.error;
        throw new ComponentSubtitleMigrationError(
          `The preview could not be migrated first: ${reason}`
        );
      }
      return preview.inheritance;
    };

    return [
      {
        filter: { kind: ['preview'] },
        handler: (code) => {
          previewSource = code;
          if (!code.includes(LEGACY_SUBTITLE)) {
            return null;
          }
          try {
            const migrated = transformAnnotations(code, 'preview', noInheritance);
            preview = { inheritance: migrated.inheritance };
            return migrated.code;
          } catch (error) {
            preview = { error };
            throw error;
          }
        },
      },
      {
        filter: { kind: ['story'] },
        handler: (code) => {
          const inheritsLegacy =
            preview && 'inheritance' in preview && preview.inheritance.legacyCanBeInherited;
          if (!code.includes(LEGACY_SUBTITLE) && !inheritsLegacy) {
            return null;
          }
          return transformAnnotations(code, 'stories', previewInheritance()).code;
        },
      },
    ];
  },
};

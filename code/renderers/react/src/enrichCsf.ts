import { getPrettier } from 'storybook/internal/common';
import { type CsfFile } from 'storybook/internal/csf-tools';
import type { PresetPropertyFn } from 'storybook/internal/types';

import { join } from 'pathe';

import { getCodeSnippet } from './componentManifest/generateCodeSnippet.ts';

export const enrichCsf: PresetPropertyFn<'experimental_enrichCsf'> = async (input, options) => {
  const features = await options.presets.apply('features');
  if (!features.experimentalCodeExamples || features.experimentalDocgenServer) {
    return;
  }
  return async (csf: CsfFile, csfSource: CsfFile) => {
    const promises = Object.keys(csf._stories).map(async (key) => {
      if (!csfSource._meta?.component) {
        return;
      }
      const { format } = await getPrettier();
      let code;
      let snippet;
      try {
        code = getCodeSnippet(csfSource, key, csfSource._meta?.component).code;
      } catch (e) {
        if (!(e instanceof Error)) {
          return;
        }
        snippet = e.message;
      }

      try {
        // TODO read the user config
        if (!snippet && code) {
          snippet = await format(code, {
            filepath: join(process.cwd(), 'component.tsx'),
          });
        }
      } catch (e) {
        if (!(e instanceof Error)) {
          return;
        }
        snippet = e.message;
      }

      if (!snippet) {
        return;
      }

      // For example:
      // Story.input.parameters = {
      //   ...Story.input.parameters,
      //   docs: {
      //     ...Story.input.parameters?.docs,
      //     source: {
      //       code: "snippet",
      //       ...Story.input.parameters?.docs?.source
      //     }
      //   }
      // };
      const parameters = `${key}${csf._metaIsFactory ? '.input' : ''}.parameters`;
      csf._appendStatement(
        `${parameters} = { ...${parameters}, docs: { ...${parameters}?.docs, source: { code: ${JSON.stringify(snippet)}, ...${parameters}?.docs?.source } } };`
      );
    });
    await Promise.all(promises);
  };
};

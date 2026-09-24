import { writeFile } from 'node:fs/promises';

import { formatFileContent } from 'storybook/internal/common';
import { logger } from 'storybook/internal/node-logger';

import {
  analyzeReactDomShimWorkspace,
  type ReactDomShimWorkspaceAnalysis,
} from '../helpers/react-dom-shim-workspace.ts';
import type { Fix } from '../types.ts';

type ApplicableAnalysis = Exclude<ReactDomShimWorkspaceAnalysis, { kind: 'none' }>;

export const removeReactDomShim: Fix<ApplicableAnalysis> = {
  id: 'remove-react-dom-shim',
  link: 'https://github.com/storybookjs/storybook/blob/next/MIGRATION.md#storybookreact-dom-shim-removed',

  async check({ configDir }) {
    if (!configDir) return null;
    const analysis = await analyzeReactDomShimWorkspace(configDir);
    if (analysis.kind === 'none') return null;
    if (analysis.kind === 'manual') {
      logger.warn(
        `Cannot remove @storybook/react-dom-shim safely. Migrate these consumers manually before upgrading:\n${analysis.diagnostics.map((diagnostic) => `- ${diagnostic}`).join('\n')}`
      );
    }
    return analysis;
  },

  promptType: (result) => (result.kind === 'manual' ? 'manual' : 'auto'),

  prompt: () => 'Remove @storybook/react-dom-shim only after every workspace consumer is migrated',

  async run({ dryRun, result }) {
    if (dryRun || result.kind === 'manual') return;
    const edits = await Promise.all(
      result.edits.map(async (edit) => ({
        filePath: edit.filePath,
        replacement: await formatFileContent(edit.filePath, edit.replacement),
      }))
    );
    for (const edit of edits) await writeFile(edit.filePath, edit.replacement);
  },
};

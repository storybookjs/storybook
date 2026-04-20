import { dedent } from 'ts-dedent';

import type { ProjectInfo } from './types.ts';
import { getPrompts } from './prompts/index.ts';

function getProjectOverview(projectInfo: ProjectInfo): string {
  return dedent`
    ## Project Info

    | Property | Value |
    |----------|-------|
    | Version | ${projectInfo.storybookVersion || 'unknown'} |
    | Renderer | ${projectInfo.rendererPackage || 'unknown'} |
    | Framework | ${projectInfo.framework || 'unknown'} |
    | Builder | ${projectInfo.builderPackage || 'unknown'} |
    | Config Dir | \`${projectInfo.configDir}\` |
    | CSF Format | ${projectInfo.hasCsfFactoryPreview ? 'CSF Factory' : 'CSF3'} |
    | Addons | ${projectInfo.addons.length > 0 ? projectInfo.addons.join(', ') : 'none'} |
  `;
}

export function generateMarkdownOutput(projectInfo: ProjectInfo): {
  markdown: string;
} {
  const { prompts: aiPrompts } = getPrompts(projectInfo);

  const sections: string[] = [];

  sections.push(dedent`
    # Storybook Setup
  `);

  sections.push(getProjectOverview(projectInfo));

  for (const aiPrompt of aiPrompts) {
    sections.push(aiPrompt.instructions);
  }

  return { markdown: sections.join('\n\n') };
}

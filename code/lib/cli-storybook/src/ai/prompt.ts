import { dedent } from 'ts-dedent';

import { getPrompts } from './setup-prompts/index.ts';
import type { ProjectInfo } from './types.ts';

function getProjectOverview(projectInfo: ProjectInfo): string {
  const rows: Array<[string, string]> = [
    ['Version', projectInfo.storybookVersion || 'unknown'],
    ['Renderer', projectInfo.rendererPackage || 'unknown'],
    ['Framework', projectInfo.framework || 'unknown'],
    ['Builder', projectInfo.builderPackage || 'unknown'],
    ['Config Dir', `\`${projectInfo.configDir}\``],
    ['Language', projectInfo.language === 'ts' ? 'TypeScript' : 'JavaScript'],
  ];

  if (projectInfo.packageManager) {
    rows.push(['Package Manager', projectInfo.packageManagerName || 'unknown']);
  }

  rows.push(['Addons', projectInfo.addons.length > 0 ? projectInfo.addons.join(', ') : 'none']);

  const tableRows = rows.map(([key, value]) => `| ${key} | ${value} |`).join('\n');

  return ['## Project Info', '', '| Property | Value |', '|----------|-------|', tableRows].join(
    '\n'
  );
}

export async function generateMarkdownOutput(projectInfo: ProjectInfo): Promise<{
  markdown: string;
}> {
  const { prompts: aiPrompts } = await getPrompts(projectInfo);

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

import type { ProjectInfo } from '../types.ts';

export function getProjectOverview(projectInfo: ProjectInfo): string {
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

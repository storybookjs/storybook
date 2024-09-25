import { render } from 'ejs';
import { readFile } from 'fs-extra';
import prettier from 'prettier';

import { allTemplates as sandboxTemplates } from '../../../code/lib/cli-storybook/src/sandbox-templates';
import type { GeneratorConfig } from './types';

export async function renderTemplate(templatePath: string, templateData: Record<string, any>) {
  const template = await readFile(templatePath, 'utf8');

  const output = (
    await prettier.format(render(template, templateData), {
      parser: 'html',
    })
  )
    // overly complicated regex replacements to fix prettier's bad formatting
    .replace(new RegExp('</li>\\n\\n', 'g'), '</li>\n')
    .replace(new RegExp('<a\\n', 'g'), '<a')
    .replace(new RegExp('node"\\n>', 'g'), 'node=">')
    .replace(new RegExp('/\\n</a>/', 'g'), '</a>');
  return output;
}

export const getStackblitzUrl = (path: string, branch = 'next') => {
  return `https://stackblitz.com/github/storybookjs/sandboxes/tree/${branch}/${path}/after-storybook?preset=node`;
};

export async function getTemplatesData(branch: string) {
  type TemplatesData = Record<
    string,
    Record<
      string,
      GeneratorConfig & {
        stackblitzUrl: string;
      }
    >
  >;

  const templatesData = Object.keys(sandboxTemplates).reduce<TemplatesData>((acc, curr) => {
    const [dirName, templateName] = curr.split('/');
    const groupName =
      dirName === 'cra' ? 'CRA' : dirName.slice(0, 1).toUpperCase() + dirName.slice(1);
    const generatorData = sandboxTemplates[curr as keyof typeof sandboxTemplates];
    acc[groupName] = acc[groupName] || {};
    acc[groupName][templateName] = {
      ...generatorData,
      stackblitzUrl: getStackblitzUrl(curr, branch),
    };
    return acc;
  }, {});
  return templatesData;
}

import { readFile } from 'node:fs/promises';

import { render } from 'ejs';
import { format } from 'oxfmt';

import { allTemplates as sandboxTemplates } from '../../../code/lib/cli-storybook/src/sandbox-templates';
import type { GeneratorConfig } from './types';

export async function renderTemplate(templatePath: string, templateData: Record<string, any>) {
  const template = await readFile(templatePath, 'utf8');

  const output = (await format('template.html', render(template, templateData))).code;
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

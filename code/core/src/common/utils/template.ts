import { existsSync, readFileSync } from 'node:fs';

import { join, resolve } from 'pathe';

import { resolvePackageDir } from '../../shared/utils/module.ts';

const interpolate = (string: string, data: Record<string, string> = {}) =>
  Object.entries(data).reduce((acc, [k, v]) => acc.replace(new RegExp(`%${k}%`, 'g'), v), string);

export function getPreviewBodyTemplate(
  configDirPath: string,
  interpolations?: Record<string, string>
) {
  const bodyHtmlPath = resolve(configDirPath, 'preview-body.html');
  const result = existsSync(bodyHtmlPath) ? readFileSync(bodyHtmlPath, 'utf8') : '';

  return interpolate(result, interpolations);
}

export function getPreviewHeadTemplate(
  configDirPath: string,
  interpolations?: Record<string, string>
) {
  const base = readFileSync(
    join(resolvePackageDir('storybook'), 'assets/server/base-preview-head.html'),
    'utf8'
  );
  const headHtmlPath = resolve(configDirPath, 'preview-head.html');

  let result = base;

  if (existsSync(headHtmlPath)) {
    result += readFileSync(headHtmlPath, 'utf8');
  }

  return interpolate(result, interpolations);
}

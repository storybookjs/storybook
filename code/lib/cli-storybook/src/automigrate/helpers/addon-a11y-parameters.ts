import { type ConfigFile, type CsfFile, loadConfig, loadCsf } from 'storybook/internal/csf-tools';

export function transformStoryA11yParameters(code: string): CsfFile | null {
  const parsed = loadCsf(code, { makeTitle: (title?: string) => title || 'default' }).parse();

  for (const object of parsed.objects({ annotations: ['parameters'] })) {
    object.rename(['parameters', 'a11y', 'element'], 'context');
  }

  return parsed.changed ? parsed : null;
}

export function transformPreviewA11yParameters(code: string): ConfigFile | null {
  const parsed = loadConfig(code).parse();
  for (const object of parsed.objects()) {
    object.rename(['parameters', 'a11y', 'element'], 'context');
  }

  return parsed.changed ? parsed : null;
}

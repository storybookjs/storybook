import { InvalidBasePathError } from 'storybook/internal/server-errors';

export function normalizeBasePath(basePath?: string): string {
  const trimmed = basePath?.trim();

  if (!trimmed) {
    return '/';
  }

  if (trimmed.includes('://') || /[?#]/.test(trimmed)) {
    throw new InvalidBasePathError({ basePath: trimmed });
  }

  const segments = trimmed.split('/').filter(Boolean);

  return segments.length > 0 ? `/${segments.join('/')}/` : '/';
}

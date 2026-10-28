import { fileURLToPath } from 'node:url';

/** List the Angular renderer's preview annotations, adding the docs config when docs are on. */
export function getPreviewAnnotations(docs: object | undefined): string[] {
  return [
    fileURLToPath(import.meta.resolve('@storybook/angular-vite/client/config')),
    ...(Object.keys(docs ?? {}).length > 0
      ? [fileURLToPath(import.meta.resolve('@storybook/angular-vite/client/docs/config'))]
      : []),
  ];
}

/** Prepend the production-mode annotation, so it runs before every other annotation. */
export function withProdMode<T>(entries: T[], enableProdMode: unknown): (T | string)[] {
  return enableProdMode
    ? [
        fileURLToPath(import.meta.resolve('@storybook/angular-vite/client/preview-prod')),
        ...entries,
      ]
    : entries;
}

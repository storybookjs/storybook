import type { ResolvedConfig } from 'vite';

// Vite replaces this placeholder in `resolve.conditions` but does not export the constant.
const DEV_PROD_CONDITION = 'development|production';

// Vite adds `import` itself when it resolves an ESM import, so `resolve.conditions` never lists it.
// `default` needs no entry: package `exports` resolution always matches it.
export function getImportConditions({ resolve, isProduction }: ResolvedConfig): string[] {
  const modeCondition = isProduction ? 'production' : 'development';
  return [
    ...resolve.conditions.map((condition) =>
      condition === DEV_PROD_CONDITION ? modeCondition : condition
    ),
    'import',
  ];
}

# Code Style & Conventions

## TypeScript
- **Strict mode** enabled (`strict: true` in tsconfig)
- Target: ES2020, Module: Preserve, ModuleResolution: bundler
- `noImplicitAny: true`
- JSX: preserve
- No emit (handled by build tools, not tsc)

## Prettier Configuration
- Print width: 100
- Tab width: 2
- Single quotes: yes
- Trailing commas: es5
- Arrow parens: always
- Brace style: 1tbs (one true brace style)
- Import order (via @trivago/prettier-plugin-sort-imports):
  1. `node:` builtins
  2. `vitest`, `@testing-library`
  3. `react`, `react-dom`
  4. `storybook/internal`
  5. `@storybook/[non-addon]`
  6. `@storybook/addon-*`
  7. Third-party modules
  8. Relative imports (`./`, `../`)
- Import order separation: yes (blank lines between groups)
- Import specifiers sorted: yes

## ESLint Rules (Notable)
- `react-aria` and `react-stately`: must import from specific submodules (e.g., `@react-aria/overlays`), NOT root
- `react-aria-components`: must use `react-aria-components/patched-dist/ComponentX` entrypoints for tree-shaking
- `es-toolkit`: must use sub-exports (e.g., `es-toolkit/array`), NOT root import
- `import-x/no-extraneous-dependencies`: off
- `react/react-in-jsx-scope`: off
- TypeScript `dot-notation` with `allowIndexSignaturePropertyAccess`
- Custom local rules: `no-uncategorized-errors`, `storybook-monorepo-imports`, `no-duplicated-error-codes`

## Naming Conventions
- Files: kebab-case for most files (e.g., `my-component.ts`)
- Components: PascalCase for React components
- Types/Interfaces: PascalCase
- Variables/functions: camelCase
- Constants: UPPER_SNAKE_CASE for true constants, camelCase otherwise

## Test Files
- Pattern: `*.test.ts`, `*.test.tsx`, `*.spec.ts`, `*.spec.tsx`
- Stories: `*.stories.ts`, `*.stories.tsx`
- Test fixtures in `__testfixtures__/` directories
- Tests in `__tests__/` directories or alongside source files

## Monorepo Import Rules
- Internal packages use `workspace:*` for dependencies
- Custom ESLint rule `storybook-monorepo-imports` enforces correct import patterns within the monorepo

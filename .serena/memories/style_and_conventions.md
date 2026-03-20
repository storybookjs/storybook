# Code Style & Conventions

## TypeScript

- **Strict mode** enabled (`strict: true` in tsconfig)
- Target: ES2020, Module: Preserve, ModuleResolution: bundler
- `noImplicitAny: true`
- JSX: preserve
- No emit (handled by build tools, not tsc)

## Oxfmt Configuration

- Print width: 100
- Tab width: 2
- Single quotes: yes
- Trailing commas: es5
- Arrow parens: always
- Bracket spacing: yes
- `sortPackageJson`: false
- `embeddedLanguageFormatting`: off
- Root formatter excludes: `docs`, `test-storybooks`, `*.yml`, `*.yaml`, generated/build output, and selected fixture/template paths
- Markdown/MDX override: `importOrderSeparation: false`, `importOrderSortSpecifiers: false`
- Angular `*.component.html` files use the `angular` parser
- Angular framework/template TypeScript files use the `babel-ts` parser
- Import ordering is not managed by a Prettier plugin here

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

# Task Completion Checklist

After completing a coding task, run through these steps:

## 1. TypeScript Compilation

Ensure the modified package(s) compile without errors:

```bash
yarn nx compile <package-name> --no-cloud
```

## 2. Linting

Run lint on the changed files or the whole codebase:

```bash
cd code && yarn lint:js
```

## 3. Formatting

Ensure code is properly formatted:

```bash
yarn fmt:check
```

## 4. Unit Tests

Run relevant tests:

```bash
cd code && yarn test <test-pattern>
```

## 5. Pre-commit Checks

The project uses husky + lint-staged for pre-commit hooks:

- JS/TS and code HTML/JSON files: oxfmt plus ESLint
- EJS files: ejslint
- package.json files: sort-package-json via `lint:package`
- `*.yml` and `*.yaml` are excluded from oxfmt

## Notes

- The main branch is `next` (not `main` or `master`)
- Always use `--no-cloud` with NX commands
- Before starting the dev server, ensure core is compiled: `yarn nx compile core --no-cloud`

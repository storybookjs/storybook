# GitHub Copilot Instructions for Storybook

## Repository Structure

```
storybook/                        # Yarn monorepo root
├── .github/                      # GitHub configurations and workflows
├── .nx/                          # NX workflows and configuration
├── code/                         # Main codebase
│   ├── .storybook/               # Configuration for internal UI Storybook
│   ├── core/                     # Core Storybook package
│   ├── lib/                      # Core supporting libraries
│   ├── addons/                   # Core Storybook addons
│   ├── builders/                 # Builder integrations
│   ├── renderers/                # Renderer integrations
│   ├── frameworks/               # Framework integrations
│   ├── presets/                  # Preset packages for Webpack-based integrations
│   └── sandbox/                  # Internal build artifacts (ignore)
├── scripts/                      # Build and development scripts
├── docs/                         # Documentation
├── test-storybooks/              # Test repos
└── ../storybook-sandboxes/       # Generated sandbox environments (outside repo)
```

## Essential Commands

### Compilation

```bash
yarn nx run-many -t compile -c production
yarn nx compile <package-name> -c production
```

### Linting

```bash
yarn lint                         # Run all linting checks
yarn --cwd code lint:js:cmd <file> --fix  # Fix linting on specific file
```

### Type Checking

```bash
yarn nx run-many -t check -c production
```

### Development Server

```bash
cd code && yarn storybook:ui        # http://localhost:6006/
cd code && yarn storybook:ui:build  # Build for production
```

### Testing

```bash
cd code && yarn test
cd code && yarn test:watch
cd code && yarn storybook:vitest
```

## Commands to Avoid

- **DO NOT RUN**: `yarn task dev` or `yarn start` (runs indefinitely)

## Sandbox Location

Generated at `../storybook-sandboxes/` outside repo

## Sandbox Environments

```bash
yarn nx sandbox <template> -c production  # Creates ../storybook-sandboxes/<template>/
```

## Troubleshooting

- Storybook logs available in generated sandbox directories
- Use `--debug` flag with CLI commands for verbose output

## Code Quality & Testing

Format and lint before committing:

```bash
yarn prettier --write <file>
yarn --cwd code lint:js:cmd <file> --fix
cd code && yarn test
```

**Testing:** Export tested functions, mock external dependencies, aim for 75%+ coverage, run `yarn vitest run --coverage <test-file>`

**Logging:** Use `logger` from `storybook/internal/node-logger` (Node.js) or `storybook/internal/client-logger` (browser). Never use `console.log` directly.

## Bug Verification Workflows

When fixing bugs in Storybook, comprehensive workflows are available as Claude Skills in `.claude/skills/`:

- **`/fix-bug`**: Complete end-to-end workflow — Fetch issue, understand bug, create plan, fix code, run verification, and open PR
- **`/verification-checklist`**: Universal checks for all bug types (Flow 0) — Run before opening any PR
- **`/renderer-bug-workflow`**: Renderer bug verification in `code/renderers/**` (Flow 1)
- **`/builder-bug-workflow`**: Builder bug verification in `code/builders/**` for frontend output (Flow 2) and terminal output (Flow 3)
- **`/manager-bug-workflow`**: Manager UI bug verification in `code/core/src/manager/**` or `code/core/src/builder-manager/**` (Flow 4)

Use `/fix-bug` to orchestrate the entire bug fix process from issue to PR. The other skills provide detailed guidance for specific verification flows. Invoke via slash-command or reference by name in instructions.

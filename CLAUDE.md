# GitHub Copilot Instructions for Storybook

## Repository Structure

```text
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
yarn nx run-many -t compile
yarn nx compile <package-name>
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

Format and lint before committing. Do not lint in-between, but only at the end:

```bash
yarn prettier --write <file>
yarn --cwd code lint:js:cmd <file> --fix
cd code && yarn test
```

**Testing:** Export tested functions, mock external dependencies, aim for 75%+ coverage, run `yarn vitest run --coverage <test-file>`

**Logging:** Use `logger` from `storybook/internal/node-logger` (Node.js) or `storybook/internal/client-logger` (browser). Never use `console.log` directly.

## Bug Verification Workflows

When fixing bugs in Storybook, use the comprehensive `/fix-bug` workflow:

- **`/fix-bug [issue-number]`**: Complete end-to-end workflow — Understand the issue, plan the fix, implement code changes, run tests, verify the fix, handle documentation improvements, and prepare PR content. This is a single linear workflow that handles all steps from issue to PR.

The workflow includes built-in verification for all bug types:

- **Flow 0**: Pure logic bugs (tests only)
- **Flow 1** (Renderer bugs): Renderer verification in `code/renderers/**`
- **Flow 2** (Builder Frontend): Frontend output verification in `code/builders/**`
- **Flow 3** (Builder Terminal): Terminal output verification in `code/builders/**`
- **Flow 4** (Manager UI): Manager UI verification in `code/core/src/manager/**` or `code/core/src/builder-manager/**`

Additional supporting skills for specific verification flows (if needed for detailed guidance):

- **`/renderer-bug-workflow`**: Detailed renderer bug verification
- **`/builder-bug-workflow`**: Detailed builder bug verification (Flow 2 & 3)
- **`/manager-bug-workflow`**: Detailed manager UI verification (Flow 4)

**When to use**:

- Fixing bugs from GitHub issues
- Need automated end-to-end bug fix workflow
- For IDE/VS Code or GitHub.com Copilot

**When NOT to use**:

- Feature requests or enhancements (not bugs)
- Documentation-only changes
- Exploratory investigation (use `/plan-bug-fix` only if you just want the plan)

## Custom GitHub Copilot Agent

For GitHub.com Copilot coding agent, a specialized custom agent is available at `.github/copilot/agents/storybook-bug-fixer.agent.md`:

**`@storybook-bug-fixer`**: Specialized agent that leverages the `/fix-bug` skill for end-to-end bug fixing workflows on GitHub.com. Simply provide an issue number (e.g., "Fix issue 12345") and the agent orchestrates the complete workflow from understanding to PR creation.

**When to use**:

- Fixing bugs from GitHub issues on GitHub.com
- Need automated end-to-end bug fix workflow
- Working within GitHub Copilot coding agent interface

**When NOT to use**:

- IDE/VS Code development (use `/fix-bug` skill directly instead)
- Feature requests or enhancements (not bugs)
- Documentation-only changes
- Exploratory investigation before fixing

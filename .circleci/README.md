# CircleCI configuration

This directory contains the CircleCI configuration for the Storybook project. The CircleCI configuration is split across multiple files and packed into a single `config.yml` using the `circleci config pack` command. This approach follows the [FYAML specification](https://github.com/CircleCI-Public/fyaml) for decomposing large YAML documents into multiple files.

### Packing process

To regenerate (pack) the CircleCI config file and validate it:

```bash
circleci config pack .circleci/src > .circleci/config.yml
circleci config validate .circleci/config.yml
```

Commit the updated `config.yml` like any other file.

You will need the [CircleCI local CLI](https://circleci.com/docs/local-cli/#installation). For more details on config packing, see the [CircleCI documentation](https://circleci.com/docs/how-to-use-the-circleci-local-cli/#packing-a-config).

### Local testing

To test individual jobs locally:

```bash
circleci config process .circleci/config.yml > process.yml
circleci local execute -c process.yml <job-name>
```

You will need to have Docker installed to be able to do this. See the [CircleCI docs](https://circleci.com/docs/how-to-use-the-circleci-local-cli/#run-a-job-in-a-container-on-your-machine) for details and limitations.

## Configuration overview

The Storybook CircleCI setup is a multi-workflow system designed to test Storybook across multiple frameworks, bundlers, and package managers.

### Parameters

The configuration accepts several pipeline parameters:

- **`workflow`**: Which workflow to run (`normal`, `merged`, `daily`, `skipped`, `docs`)
- **`ghPrNumber`**: GitHub PR number for PR-specific testing
- **`ghBaseBranch`**: Base branch name for comparison testing

### Workflows

- **`normal`**: Standard PR checks, running the most important sandboxes
- **`merged`**: Post-merge PR checks, running against more sandboxes
- **`daily`**: Daily job, running against even more sandboxes and empty directory
- **`docs`**: Documentation checks

### Jobs

- **`build`**: Compiles code, publishes to local Verdaccio registry
- **`lint`**: ESLint + Prettier checks
- **`knip`**: Unused dependency detection
- **`check`**: Type checking and validation
- **`unit-tests`**: Vitest-based unit tests
- **`e2e-ui`**: End-to-end tests for Storybook's manager UI
- **`e2e-ui-vitest-3`**: End-to-end tests for Storybook's manager UI using Vitest 3
- **`test-init-empty`**: Tests Storybook init from empty directories
- **`test-init-features`**: Tests Storybook initialization with features
- **`test-portable-stories`**: Tests portable stories across frameworks
- **`create-sandboxes`**: Generates framework-specific test environments (sandboxes)
- **`chromatic-sandboxes`**: Visual regression testing against each sandbox
- **`e2e-dev`**: End-to-end tests against a Storybook dev server for each sandbox
- **`e2e-production`**: End-to-end tests against static production Storybooks for each sandbox
- **`test-runner-production`**: Run the Test Runner against each sandbox
- **`vitest-integration`**: Run the Vitest tests of each sandbox

### TODOs

Several jobs are currently disabled due to flakiness:
- `bench-sandboxes`: Performance benchmarking
- `test-runner-dev`: Dev mode test runner
- `smoke-test-sandboxes`: Quick smoke tests
- Some package managers in daily workflow

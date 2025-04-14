```yml filename=".github/workflows/storybook-tests.yml" renderer="common" language="ts" tabTitle="yml"
name: Storybook Tests

on: deployment_status

jobs:
  test:
    timeout-minutes: 60
    runs-on: ubuntu-latest
    if: github.event.deployment_status.state == 'success'
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version-file: '.nvmrc'
      - name: Install dependencies
        run: yarn
      - name: Install Playwright
        run: npx playwright install --with-deps
      - name: Run Storybook tests
        run: yarn test-storybook
        env:
          TARGET_URL: '${{ github.event.deployment_status.target_url }}'
```

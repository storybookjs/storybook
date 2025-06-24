```yml filename=".github/workflows/deploy-github-pages.yml" renderer="common" language="js"
# Workflow name
name: Build and Publish Storybook to GitHub Pages

on:
  # Event for the workflow to run on
  push:
    branches:
      - 'your-branch-name' # Replace with the branch you want to deploy from

permissions:
  contents: read
  pages: write
  id-token: write

# List of jobs
jobs:
  deploy:
    runs-on: ubuntu-latest
    # Job steps
    steps:
      # Manual Checkout
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      # Set up Node
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      #👇 Add Storybook build and deploy to GitHub Pages as a step in the workflow
      - uses: bitovi/github-actions-storybook-to-github-pages@v1.0.3
        with:
          install_command: yarn install # default: npm ci
          build_command: yarn build-storybook # default: npm run build-storybook
          path: storybook-static # default: dist/storybook
          checkout: false # default: true
```

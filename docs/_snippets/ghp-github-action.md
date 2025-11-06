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
    env:
      # Configuration constants
      NODE_VERSION: '20'
      INSTALL_COMMAND: 'npm install' # Your install comman here
      BUILD_COMMAND: 'npm run build-storybook' # Your command to build storybook
      BUILD_PATH: './storybook-static' # The path to your static storybook build

    steps:
      # Checkout
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      # Set up Node
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}

      - name: 'Build'
        shell: bash
        run: |
          echo "::group::Build"
          ${{ env.INSTALL_COMMAND }}
          ${{ env.BUILD_COMMAND }}
          echo "::endgroup::"

      - name: 'upload'
        uses: actions/upload-pages-artifact@v3
        with:
          path: ${{ env.BUILD_PATH }}

      - id: deploy
        name: Deploy to GitHub Pages
        uses: actions/deploy-pages@v4
        with:
          token: ${{ github.token }}
```

```yml filename=".github/workflows/deploy-github-pages.yml" renderer="common" language="js"
name: Build and Publish Storybook to GitHub Pages
on:
  push:
    branches:
      - 'your-branch-name' # Use specific branch name
permissions:
  contents: read
  pages: write
  id-token: write
concurrency:
  group: 'pages'
  cancel-in-progress: false
jobs:
  deploy:
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deploy.outputs.page_url }}
    steps:
      - name: Checkout
        uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm' # Adjust caching strategy and configuration if using other package managers
      - name: Install dependencies
        run: npm ci # Replace with appropriate command if using other package managers
      - name: Build Storybook
        run: npm run build-storybook
      # Upload pages artifact
      - name: Upload Pages artifact
        uses: actions/upload-pages-artifact@v3
        with:
          path: 'storybook-static'
      # Deploy to Github Pages
      - id: deploy
        name: Deploy to GitHub Pages
        uses: actions/deploy-pages@v4
        with:
          token: ${{ github.token }}
```

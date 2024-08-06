```shell renderer="angular" tabTitle="with-builder"
# Builds Storybook with Angular's custom builder
# See https://storybook.js.org/docs/get-started/frameworks/angular#how-do-i-migrate-to-an-angular-storybook-builder
# to learn how to create the custom builder
ng run my-project:build-storybook
```

```json renderer="angular" language="js" filename="package.json" tabTitle="script-for-builder"
{
  "scripts": {
    "build-storybook": "ng run my-project:build-storybook"
  }
}
```

```jsonc filename="angular.json" renderer="angular" language="json"
{
  "$schema": "./node_modules/@angular/cli/lib/config/schema.json",
  "version": 1,
  "newProjectRoot": "projects",
  "projects": {
    "your-project": {
      "projectType": "application",
      "schematics": {},
      "root": "",
      "sourceRoot": "src",
      "prefix": "app",
      "architect": {
        "storybook": {
          "builder": "@storybook/angular:start-storybook",
          "options": {
            "configDir": ".storybook",
            "browserTarget": "your-project:build",
            "compodoc": true,
            "compodocArgs": [
              "-e",
              "json",
              "-d",
              ".", // Add this line to introspect the relevant files starting from the root directory of your project.
            ],
            "port": 6006,
          },
        },
        "build-storybook": {
          "builder": "@storybook/angular:build-storybook",
          "options": {
            "configDir": ".storybook",
            "browserTarget": "your-project:build",
            "compodoc": true,
            "compodocArgs": [
              "-e",
              "json",
              "-d",
              ".", // Add this line to introspect the relevant files starting from the root directory of your project.
            ],
            "outputDir": "storybook-static",
          },
        },
      },
    },
  },
}
```

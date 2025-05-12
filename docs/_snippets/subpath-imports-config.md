```jsonc filename="package.json" renderer="common" language="json"
{
  "imports": {
    "#api": {
      // storybook condition applies to Storybook
      "storybook": "./api.mock.ts",
      "default": "./api.ts",
    },
    "#app/actions": {
      "storybook": "./app/actions.mock.ts",
      "default": "./app/actions.ts",
    },
    "#lib/session": {
      "storybook": "./lib/session.mock.ts",
      "default": "./lib/session.ts",
    },
    "#lib/db": {
      // test condition applies to test environments *and* Storybook
      "test": "./lib/db.mock.ts",
      "default": "./lib/db.ts",
    },
    "#*": ["./*", "./*.ts", "./*.tsx"],
  },
}
```

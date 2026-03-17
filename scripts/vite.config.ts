import { defineConfig } from "vite-plus";

export default defineConfig({
  lint: {
    plugins: ["typescript", "react", "jsx-a11y", "import"],
    jsPlugins: [
      "eslint-plugin-depend",
      {
        name: "local-rules",
        specifier: "./eslint-plugin-local-rules",
      },
    ],
    categories: {
      correctness: "warn",
    },
    options: {
      typeAware: true,
      typeCheck: false,
      reportUnusedDisableDirectives: "error",
    },
    rules: {
      "no-unused-vars": "off",
      "no-use-before-define": "off",

      "typescript/no-require-imports": "off",
      "typescript/no-implied-eval": "error",
      "typescript/no-explicit-any": "warn",
      "typescript/no-wrapper-object-types": "warn",
      "typescript/no-empty-object-type": "warn",
      "typescript/ban-ts-comment": "error",
      "typescript/no-unused-vars": "warn",
      "typescript/no-redeclare": "off",
      "typescript/no-unsafe-function-type": "warn",
      "typescript/consistent-type-imports": [
        "error",
        { disallowTypeAnnotations: false },
      ],

      "react/no-unescaped-entities": "off",

      "depend/ban-dependencies": [
        "error",
        {
          modules: [
            "lodash",
            "lodash-es",
            "chalk",
            "qs",
            "handlebars",
            "fs-extra",
          ],
        },
      ],
    },
    overrides: [
      {
        files: ["*.html"],
        rules: {
          "typescript/no-unused-vars": "off",
        },
      },
      {
        files: [
          "*.js",
          "*.jsx",
          "*.json",
          "*.html",
          "**/.storybook/*.ts",
          "**/.storybook/*.tsx",
        ],
        rules: {
          "typescript/no-implied-eval": "off",
          "typescript/return-await": "off",
        },
      },
    ],
    ignorePatterns: [
      "dist",
      "build",
      "coverage",
      "node_modules",
      "storybook-static",
      "built-storybooks",
      "*.bundle.js",
      "*.js.map",
      "*.d.ts",
      "ember-output",
      ".yarn",
      "storage",
      "repros-generator",
    ],
  },
  fmt: {
    printWidth: 100,
    tabWidth: 2,
    bracketSpacing: true,
    trailingComma: "es5",
    singleQuote: true,
    arrowParens: "always",
    importOrder: [
      "^node:",
      "^(vitest|@testing-library)",
      "^react(-dom(/client)?(/server)?)?$",
      "^storybook/internal",
      "^@storybook/[^-]*$",
      "^@storybook/(?!addon-)(.*)$",
      "^@storybook/addon-(.*)$",
      "<THIRD_PARTY_MODULES>",
      "^[./]",
    ],
    importOrderSeparation: true,
    importOrderSortSpecifiers: true,
    jsdocPreferCodeFences: true,
    tsdoc: true,
    braceStyle: "1tbs",
    ignorePatterns: [".yarn", ".vscode", "dist", "build"],
  },
});

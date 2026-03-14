import { defineConfig } from 'vite-plus';

export default defineConfig({
  staged: {
    "*": "vp check --fix"
  },
  lint: {"options":{"typeAware":true,"typeCheck":true}},
  fmt: {
    "printWidth": 100,
    "tabWidth": 2,
    "bracketSpacing": true,
    "trailingComma": "es5",
    "singleQuote": true,
    "arrowParens": "always",
    "importOrder": [
      "^node:",
      "^(vitest|@testing-library)",
      "^react(-dom(/client)?(/server)?)?$",
      "^storybook/internal",
      "^@storybook/[^-]*$",
      "^@storybook/(?!addon-)(.*)$",
      "^@storybook/addon-(.*)$",
      "<THIRD_PARTY_MODULES>",
      "^[./]"
    ],
    "importOrderSeparation": true,
    "importOrderSortSpecifiers": true,
    "jsdocPreferCodeFences": true,
    "tsdoc": true,
    "braceStyle": "1tbs",
    "sortPackageJson": false,
    "ignorePatterns": []
  },
});

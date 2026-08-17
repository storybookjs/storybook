declare var STORYBOOK_ENV: 'vue3';

declare var PLUGINS_SETUP_FUNCTIONS: Set<(app, context) => unknown>;

declare var FRAMEWORK_OPTIONS:
  | undefined
  | {
      docgen?:
        | boolean
        | 'vue-docgen-api'
        | 'vue-component-meta'
        | { plugin: 'vue-component-meta'; tsconfig?: string };
    };

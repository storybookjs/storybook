interface ImportMetaEnv {
  __STORYBOOK_URL__?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare var STORYBOOK_BUILDER: string | undefined;

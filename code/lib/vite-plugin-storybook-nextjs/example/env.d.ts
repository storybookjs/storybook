interface ImportMetaEnv {
  readonly NEXT_PUBLIC_ANALYTICS_ID: string;
  readonly MODE: string;
  readonly PROD: string;
  readonly DEV: string;
  readonly BASE_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

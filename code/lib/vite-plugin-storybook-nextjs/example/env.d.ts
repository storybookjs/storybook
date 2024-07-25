interface ImportMetaEnv {
  readonly NEXT_PUBLIC_EXAMPLE1: string;
  readonly MODE: string;
  readonly PROD: string;
  readonly DEV: string;
  readonly BASE_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

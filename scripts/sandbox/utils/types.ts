export type GeneratorConfig = {
  name: string;
  script: string;
  expected: {
    framework: string;
    renderer: string;
    builder: string;
  };
  env?: Record<string, unknown>;
};

export type PackageMetadata = { version: string; location?: string; reasons?: string[] };
export type InstallationMetadata = {
  dependencies: Record<string, PackageMetadata[]>;
  duplicatedDependencies: Record<string, string[]>;
  infoCommand: string;
  dedupeCommand: string;
};

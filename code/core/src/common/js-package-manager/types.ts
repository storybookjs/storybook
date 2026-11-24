export type PackageMetadata = { version: string; location?: string; reasons?: string[] };
export type PublishedManifest = {
  version: string;
  versions: string[];
  time: Record<string, string>;
  dependencies: Record<string, string>;
  peerDependencies: Record<string, string>;
};
export type InstallationMetadata = {
  dependencies: Record<string, PackageMetadata[]>;
  duplicatedDependencies: Record<string, string[]>;
  infoCommand: string;
  dedupeCommand: string;
};

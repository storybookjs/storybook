import type { JsPackageManager, PackageManagerName } from 'storybook/internal/common';
import type { StorybookConfigRaw } from 'storybook/internal/types';

export interface DoctorOptions {
  configDir: string;
  packageManager?: PackageManagerName;
}

export interface ProjectDoctorData {
  configDir: string;
  packageManager: JsPackageManager;
  storybookVersion?: string;
  mainConfig: StorybookConfigRaw;
}

export enum DiagnosticType {
  MISSING_STORYBOOK_DEPENDENCY = 'missing_storybook_dependency',
  INCOMPATIBLE_PACKAGES = 'incompatible_packages',
  MISMATCHING_VERSIONS = 'mismatching_versions',
  DUPLICATED_DEPENDENCIES = 'duplicated_dependencies',
  CONFIGURATION_ERROR = 'configuration_error',
}

export enum DiagnosticStatus {
  PASSED = 'passed',
  HAS_ISSUES = 'has_issues',
  CHECK_ERROR = 'check_error',
}

export type DiagnosticDoctorData = {
  configDir: string;
};

export interface DiagnosticResult {
  type: DiagnosticType;
  title: string;
  message: string;
  projects: DiagnosticDoctorData[];
}

export interface DoctorCheckResult {
  type: DiagnosticType;
  title: string;
  message: string;
  project: DiagnosticDoctorData;
}

export interface ProjectDoctorResults {
  configDir: string;
  status: 'healthy' | 'has_issues' | 'check_error';
  diagnostics: Record<DiagnosticType, DiagnosticStatus>;
  messages: Record<DiagnosticType, string>;
}

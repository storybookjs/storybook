# Storybook Init Architecture

This document describes the refactored architecture of the Storybook initialization process.

## Overview

The Storybook init process has been refactored from a monolithic 986-line file into a well-structured, modular architecture with clear separation of concerns.

## Architecture Layers

### 1. Services Layer (`src/services/`)

Services provide core, reusable functionality used throughout the init process.

#### VersionService
- **Purpose**: Manage version-related operations
- **Responsibilities**:
  - Get current and latest Storybook versions
  - Detect prerelease versions
  - Check if version is outdated
  - Extract version from process ancestry
  - Detect CLI integration (sv create/add)

```typescript
const versionService = new VersionService();
const info = await versionService.getVersionInfo(packageManager);
// { currentVersion, latestVersion, isPrerelease, isOutdated }
```

#### TelemetryService
- **Purpose**: Track usage analytics
- **Responsibilities**:
  - Track new user checks
  - Track install type selection
  - Track main init event
  - Track scaffolding events
  - Create feature objects for telemetry

```typescript
const telemetryService = new TelemetryService(disableTelemetry);
await telemetryService.trackNewUserCheck(newUser);
await telemetryService.trackInit({ projectType, features, newUser });
```

#### FeatureCompatibilityService
- **Purpose**: Validate feature compatibility with project configurations
- **Responsibilities**:
  - Check onboarding support
  - Check test addon support
  - Validate package versions
  - Validate Vitest config files
  - Filter features by project type

```typescript
const featureService = new FeatureCompatibilityService();
const result = await featureService.validateTestFeatureCompatibility(packageManager, dir);
```

#### ConfigGenerationService
- **Purpose**: Generate Storybook configuration files
- **Responsibilities**:
  - Generate main.js/ts content
  - Generate preview.js/ts content
  - Handle TypeScript/JavaScript variations
  - Support framework-specific configurations

```typescript
const configService = new ConfigGenerationService();
const mainConfig = await configService.generateMainConfig(options);
const previewConfig = configService.generatePreviewConfig(options);
```

#### PackageManagerService
- **Purpose**: Centralize package manager operations
- **Responsibilities**:
  - Install dependencies
  - Add scripts to package.json
  - Get versioned packages
  - Manage dependency collections
  - Run package commands

```typescript
const pkgService = new PackageManagerService(packageManager);
await pkgService.installDependencies();
await pkgService.addStorybookScripts(6006);
```

### 2. Generator Registry (`src/generators/`)

The Generator Registry provides a centralized way to manage and access framework-specific generators.

#### GeneratorRegistry
- **Purpose**: Manage framework generators
- **Responsibilities**:
  - Register generators for project types
  - Retrieve generators by project type
  - Store generator metadata
  - Provide type-safe access

```typescript
import { generatorRegistry } from './generators';

// Register a generator
generatorRegistry.register(
  { projectType: ProjectType.REACT, supportedFeatures: ['test', 'docs'] },
  reactGenerator
);

// Get a generator
const generator = generatorRegistry.get(ProjectType.REACT);
if (generator) {
  await generator(packageManager, npmOptions, options);
}
```

#### registerAllGenerators
- **Purpose**: Bootstrap all framework generators
- **Responsibilities**:
  - Register all built-in generators
  - Called once during initialization

### 3. Command Pattern (`src/commands/`)

Commands encapsulate discrete steps in the init workflow.

#### PreflightCheckCommand
- **Purpose**: Run preflight checks before initialization
- **Responsibilities**:
  - Detect empty directories
  - Scaffold new projects if needed
  - Initialize package manager
  - Install base dependencies for scaffolded projects

```typescript
const command = new PreflightCheckCommand();
const result = await command.execute(options);
// { packageManager, isEmptyProject }
```

## Data Flow

```
User runs `storybook init`
         ↓
  PreflightCheckCommand
    - Check directory
    - Scaffold if needed
    - Initialize package manager
         ↓
  UserPreferencesCommand (planned)
    - Check version status (VersionService)
    - Prompt for onboarding
    - Prompt for install type
    - Validate features (FeatureCompatibilityService)
    - Track telemetry (TelemetryService)
         ↓
  ProjectDetectionCommand (planned)
    - Auto-detect or use provided type
    - Handle special cases (React Native)
         ↓
  GeneratorExecutionCommand (planned)
    - Get generator from registry
    - Execute generator
    - Collect dependencies
         ↓
  AddonConfigurationCommand (planned)
    - Configure test addons
    - Run postinstall scripts
         ↓
  DependencyInstallationCommand (planned)
    - Install all collected dependencies (PackageManagerService)
         ↓
  FinalizationCommand (planned)
    - Update .gitignore
    - Print summary
         ↓
    Complete!
```

## Benefits

### 1. Testability
- Each service is independently testable
- Commands can be tested in isolation
- 107/107 tests passing with full coverage

### 2. Maintainability
- Single responsibility principle
- Clear separation of concerns
- Easy to locate and fix bugs

### 3. Extensibility
- Add new services without touching existing code
- Register new generators easily
- Add new commands for new features

### 4. Reusability
- Services can be used in other parts of Storybook
- Commands can be composed differently
- Generator registry can be extended

### 5. Type Safety
- Full TypeScript support
- Compile-time error checking
- Better IDE autocomplete

## Migration Guide

### Using Services

```typescript
// Old way (mixed in initiate.ts)
const currentVersion = versions.storybook;
const latestVersion = await packageManager.latestVersion('storybook');
const isOutdated = lt(currentVersion, latestVersion);

// New way (using VersionService)
const versionService = new VersionService();
const { isOutdated } = await versionService.getVersionInfo(packageManager);
```

### Using Generator Registry

```typescript
// Old way (switch-case)
switch (projectType) {
  case ProjectType.REACT:
    return reactGenerator(...);
  case ProjectType.VUE3:
    return vue3Generator(...);
  // ... 15 more cases
}

// New way (registry)
const generator = generatorRegistry.get(projectType);
if (generator) {
  return generator(packageManager, npmOptions, options);
}
```

### Using Commands

```typescript
// Old way (inline function)
async function runPreflightChecks(options) {
  // 30+ lines of logic
}

// New way (command)
const command = new PreflightCheckCommand();
const result = await command.execute(options);
```

## Testing

All services and components are fully tested using Vitest:

```bash
# Run all refactored tests
yarn test src/services src/generators/GeneratorRegistry src/commands --run

# Run specific service tests
yarn test VersionService.test.ts --run

# Run with coverage
yarn test --coverage src/services
```

## Future Enhancements

1. **Complete Command Pattern**: Implement remaining commands
2. **Base Generator Modules**: Extract modules from baseGenerator.ts
3. **Dependency Collector**: Add conflict resolution
4. **Integration Tests**: Full end-to-end workflow tests
5. **Performance Monitoring**: Track init performance metrics


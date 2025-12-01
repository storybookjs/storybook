import { beforeEach, describe, expect, it } from 'vitest';

import { DependencyCollector } from './dependency-collector';

describe('DependencyCollector', () => {
  let collector: DependencyCollector;

  beforeEach(() => {
    collector = new DependencyCollector();
  });

  describe('addDependencies', () => {
    it('should add dependencies', () => {
      collector.addDependencies(['react@18.0.0', 'react-dom@18.0.0']);

      const { dependencies } = collector.getAllPackages();

      expect(dependencies).toContain('react@18.0.0');
      expect(dependencies).toContain('react-dom@18.0.0');
    });

    it('should add dependencies without version', () => {
      collector.addDependencies(['react', 'react-dom']);

      const { dependencies } = collector.getAllPackages();

      expect(dependencies).toContain('react');
      expect(dependencies).toContain('react-dom');
    });
  });

  describe('addDevDependencies', () => {
    it('should add dev dependencies', () => {
      collector.addDevDependencies(['typescript@5.0.0', 'vitest@1.0.0']);

      const { devDependencies } = collector.getAllPackages();

      expect(devDependencies).toContain('typescript@5.0.0');
      expect(devDependencies).toContain('vitest@1.0.0');
    });
  });

  describe('getAllPackages', () => {
    it('should return all packages by type', () => {
      collector.addDependencies(['react@18.0.0']);
      collector.addDevDependencies(['typescript@5.0.0']);

      const result = collector.getAllPackages();

      expect(result.dependencies).toEqual(['react@18.0.0']);
      expect(result.devDependencies).toEqual(['typescript@5.0.0']);
    });

    it('should return empty arrays when no packages', () => {
      const result = collector.getAllPackages();

      expect(result.dependencies).toEqual([]);
      expect(result.devDependencies).toEqual([]);
    });
  });

  describe('hasPackages', () => {
    it('should return false when no packages added', () => {
      expect(collector.hasPackages()).toBe(false);
    });

    it('should return true when dependencies added', () => {
      collector.addDependencies(['react']);
      expect(collector.hasPackages()).toBe(true);
    });

    it('should return true when devDependencies added', () => {
      collector.addDevDependencies(['typescript']);
      expect(collector.hasPackages()).toBe(true);
    });
  });

  describe('getVersionConflicts', () => {
    it('should return empty array when no conflicts', () => {
      collector.addDependencies(['react@18.0.0', 'vue@3.0.0']);

      const conflicts = collector.getVersionConflicts();

      expect(conflicts).toEqual([]);
    });

    it('should detect no conflicts when package is updated', () => {
      // When adding same package twice, it updates (doesn't create conflict)
      collector.addDependencies(['react@18.0.0']);
      collector.addDependencies(['react@17.0.0']);

      const conflicts = collector.getVersionConflicts();

      // No conflict because the second add updated the first
      expect(conflicts).toEqual([]);

      // Version should be updated to latest
      const { dependencies } = collector.getAllPackages();
      expect(dependencies).toContain('react@17.0.0');
    });

    it('should not report conflict for same version', () => {
      collector.addDevDependencies(['typescript@5.0.0']);
      collector.addDevDependencies(['typescript@5.0.0']);

      const conflicts = collector.getVersionConflicts();

      expect(conflicts).toEqual([]);
    });

    it('should handle scoped packages without conflicts', () => {
      // When adding same package twice, it updates (doesn't create conflict)
      collector.addDependencies(['@storybook/react@8.0.0']);
      collector.addDependencies(['@storybook/react@7.0.0']);

      const conflicts = collector.getVersionConflicts();

      // No conflict - version was updated
      expect(conflicts).toEqual([]);

      const { dependencies } = collector.getAllPackages();
      expect(dependencies).toContain('@storybook/react@7.0.0');
    });
  });

  describe('merge', () => {
    it('should merge dependencies from another collector', () => {
      collector.addDependencies(['react@18.0.0']);
      collector.addDevDependencies(['typescript@5.0.0']);

      const other = new DependencyCollector();
      other.addDependencies(['vue@3.0.0']);
      other.addDevDependencies(['vitest@1.0.0']);

      collector.merge(other);

      const { dependencies, devDependencies } = collector.getAllPackages();

      expect(dependencies).toContain('react@18.0.0');
      expect(dependencies).toContain('vue@3.0.0');
      expect(devDependencies).toContain('typescript@5.0.0');
      expect(devDependencies).toContain('vitest@1.0.0');
    });

    it('should handle empty collector merge', () => {
      collector.addDependencies(['react@18.0.0']);

      const other = new DependencyCollector();

      collector.merge(other);

      const { dependencies } = collector.getAllPackages();
      expect(dependencies).toEqual(['react@18.0.0']);
    });
  });

  describe('validate', () => {
    it('should return valid for valid packages', () => {
      collector.addDependencies(['react@18.0.0']);
      collector.addDevDependencies(['typescript@5.0.0']);

      const result = collector.validate();

      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should detect empty package names', () => {
      const typeMap = (collector as any).packages.get('dependencies');
      typeMap.set('', '1.0.0');

      const result = collector.validate();

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some((e) => e.includes('Invalid package name'))).toBe(true);
    });

    it('should detect empty versions', () => {
      const typeMap = (collector as any).packages.get('dependencies');
      typeMap.set('react', '');

      const result = collector.validate();

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Package react in dependencies has empty version');
    });

    it('should return multiple errors', () => {
      const typeMap = (collector as any).packages.get('dependencies');
      typeMap.set('', '1.0.0');
      typeMap.set('react', '');

      const result = collector.validate();

      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(2);
    });
  });

  describe('getPackageCount', () => {
    it('should return 0 for empty collector', () => {
      expect(collector.getPackageCount()).toBe(0);
    });

    it('should return total count', () => {
      collector.addDependencies(['react', 'vue']);
      collector.addDevDependencies(['typescript', 'vitest']);

      expect(collector.getPackageCount()).toBe(4);
    });

    it('should return count for specific type', () => {
      collector.addDependencies(['react', 'vue']);
      collector.addDevDependencies(['typescript']);

      expect(collector.getPackageCount('dependencies')).toBe(2);
      expect(collector.getPackageCount('devDependencies')).toBe(1);
    });
  });

  describe('version handling', () => {
    it('should update version when adding same package with different version', () => {
      collector.addDependencies(['react@18.0.0']);
      collector.addDependencies(['react@18.1.0']);

      const { dependencies } = collector.getAllPackages();

      expect(dependencies).toContain('react@18.1.0');
      expect(dependencies).not.toContain('react@18.0.0');
      expect(dependencies).toHaveLength(1);
    });

    it('should keep version when adding same package without version', () => {
      collector.addDependencies(['react@18.0.0']);
      collector.addDependencies(['react']);

      const { dependencies } = collector.getAllPackages();

      expect(dependencies).toContain('react@18.0.0');
      expect(dependencies).toHaveLength(1);
    });

    it('should handle scoped packages', () => {
      collector.addDependencies(['@storybook/react@8.0.0']);

      const { dependencies } = collector.getAllPackages();

      expect(dependencies).toContain('@storybook/react@8.0.0');
    });
  });
});

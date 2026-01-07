import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { PackageJson } from 'storybook/internal/types';

import { analyzeEcosystemPackages } from './get-known-packages';
import { getActualPackageVersion } from './package-json';

vi.mock(import('./package-json'), { spy: true });

describe('get-known-packages', () => {
  beforeEach(() => {
    vi.mocked(getActualPackageVersion).mockImplementation(async (pkg: string) => ({
      name: pkg,
      version: '1.0.0',
    }));
  });
  describe('analyzeEcosystemPackages', () => {
    it('should analyze test packages with actual versions', async () => {
      const packageJson: PackageJson = {
        dependencies: {
          jest: '29.0.0',
          vitest: '1.0.0',
          playwright: '1.30.0',
          '@testing-library/react': '1.0.0',
        },
      };

      const result = await analyzeEcosystemPackages(packageJson);

      expect(getActualPackageVersion).toHaveBeenCalled();

      expect(result.testPackages).toEqual({
        jest: '1.0.0',
        vitest: '1.0.0',
        playwright: '1.0.0',
        '@testing-library/react': '1.0.0',
      });
    });

    it('should analyze ecosystem packages in a single packageJson with multiple groups', async () => {
      const packageJson: PackageJson = {
        dependencies: {
          // styling
          tailwindcss: '3.0.0',
          'styled-components': '6.0.0',
          emotion: '11.0.0',
          // state management
          redux: '4.0.0',
          'react-redux': '8.0.0',
          zustand: '4.0.0',
          // data fetching
          axios: '1.0.0',
          '@tanstack/react-query': '4.0.0',
          'react-query': '3.0.0',
          // UI library
          '@mui/material': '5.0.0',
          antd: '5.0.0',
          '@headlessui/react': '1.0.0',
          // i18n
          i18next: '22.0.0',
          'react-i18next': '12.0.0',
          'next-intl': '2.0.0',
          // router
          'react-router-dom': '6.0.0',
          'react-router': '6.0.0',
          '@tanstack/react-router': '1.0.0',
          'expo-router': '2.0.0',
          wouter: '3.0.0',
        },
      };

      const result = await analyzeEcosystemPackages(packageJson);
      expect(result.stylingPackages).toEqual({
        tailwindcss: '3.0.0',
        'styled-components': '6.0.0',
      });

      expect(result.stateManagementPackages).toEqual({
        redux: '4.0.0',
        'react-redux': '8.0.0',
        zustand: '4.0.0',
      });

      expect(result.dataFetchingPackages).toEqual({
        axios: '1.0.0',
        '@tanstack/react-query': '4.0.0',
        'react-query': '3.0.0',
      });

      expect(result.uiLibraryPackages).toEqual({
        '@mui/material': '5.0.0',
        antd: '5.0.0',
        '@headlessui/react': '1.0.0',
      });

      expect(result.i18nPackages).toEqual({
        i18next: '22.0.0',
        'react-i18next': '12.0.0',
        'next-intl': '2.0.0',
      });

      expect(result.routerPackages).toEqual({
        'react-router-dom': '6.0.0',
        'react-router': '6.0.0',
        '@tanstack/react-router': '1.0.0',
        'expo-router': '2.0.0',
        wouter: '3.0.0',
      });
    });

    it('should handle packages with scoped names and subpaths', async () => {
      const packageJson: PackageJson = {
        dependencies: {
          '@testing-library/react': '13.0.0',
          '@testing-library/jest-dom': '5.0.0',
          '@emotion/react': '11.0.0',
          '@emotion/styled': '11.0.0',
        },
      };

      const result = await analyzeEcosystemPackages(packageJson);

      expect(result.testPackages).toEqual({
        '@testing-library/react': '1.0.0',
        '@testing-library/jest-dom': '1.0.0',
      });

      expect(result.stylingPackages).toEqual({
        '@emotion/react': '11.0.0',
        '@emotion/styled': '11.0.0',
      });
    });

    it('should return empty object when no matching packages are found', async () => {
      const packageJson: PackageJson = {
        dependencies: {
          'some-random-package': '1.0.0',
          'another-package': '2.0.0',
        },
      };

      const result = await analyzeEcosystemPackages(packageJson);

      expect(result).toEqual({});
    });
  });
});

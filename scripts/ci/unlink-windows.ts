import * as fs from 'fs';
import * as path from 'path';

import { getWorkspace } from '../utils/tools';

/**
 * This script converts symlinks/junctions in node_modules to real directories by copying the source
 * package content into the node_modules location.
 *
 * Why this is needed: Cache persistence in Windows boxes on CircleCI fails to persist our monorepo
 * node_modules/<storybook package> folders because they are symlinks/junctions, and the zipping
 * tool fails to handle them. In order to prevent having to run yarn install in every job running on
 * Windows, and to have the same or similar-enough setup for cache across Linux/Windows, we need to
 * convert the symlinks/junctions to real directories. This script does that.
 *
 * Note: This script has not fully eliminated the need to run yarn install in subsequent Windows
 * jobs. We're keeping it in the hope that we'll eventually figure out what's wrong or missing from
 * the cache persistence in Windows boxes on CircleCI, so we won't have to run yarn install in
 * subsequent jobs running on Windows.
 */

console.log('Starting dynamic retrieval of workspace packages...');

// 1. Get the list of packages
const packages = await getWorkspace();
const nodeModulesBaseDir = path.resolve(import.meta.dirname, '..', '..', 'node_modules');

console.log(`Found ${packages.length} workspace packages to process.`);

for (const pkg of packages) {
  if (pkg.private) {
    continue;
  }
  const packageName = pkg.name;
  // pkg.path is the absolute path to the package directory (e.g., C:\Users\circleci\project\packages\my-package)
  const sourcePath = pkg.path;

  // The link/junction location inside node_modules
  const nodeModulesPath = path.join(nodeModulesBaseDir, packageName);

  if (fs.existsSync(nodeModulesPath)) {
    console.log(`Processing: ${packageName}`);

    try {
      // 2. Remove the existing link/junction in node_modules
      // Use fs.rmSync to delete the directory (the link/junction)
      fs.rmSync(nodeModulesPath, { recursive: true, force: true });

      // 3. Copy the actual source package content into the node_modules location
      if (fs.existsSync(sourcePath)) {
        // Copy the source package directory into the node_modules directory
        copyRecursiveSync(sourcePath, nodeModulesPath);
        console.log(`  -> Copied files from ${sourcePath} to ${nodeModulesPath}`);
      } else {
        console.warn(
          `  -> WARNING: Source directory not found for ${packageName} at ${sourcePath}`
        );
      }
    } catch (e) {
      console.error(`Error processing ${packageName}:`, e);
      // Fail the build if a critical file operation fails
      process.exit(1);
    }
  }
}

console.log('Link conversion complete. node_modules is ready for caching.');

function copyRecursiveSync(src: string, dest: string) {
  const exists = fs.existsSync(src);
  const stats = exists && fs.statSync(src);
  const isDirectory = exists && stats.isDirectory();

  if (isDirectory) {
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest);
    }
    fs.readdirSync(src).forEach((childItemName) => {
      copyRecursiveSync(path.join(src, childItemName), path.join(dest, childItemName));
    });
  } else if (exists) {
    fs.copyFileSync(src, dest);
  }
}

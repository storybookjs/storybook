import * as fs from 'fs';
import * as path from 'path';

import { getWorkspace } from '../utils/tools';

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

async function fixCacheLinks() {
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
}

// Execute the async function
fixCacheLinks().catch((err) => {
  console.error('An error occurred during link fixing:', err);
  process.exit(1);
});

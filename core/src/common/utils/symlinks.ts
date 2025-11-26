export function isPreservingSymlinks() {
  const { NODE_OPTIONS, NODE_PRESERVE_SYMLINKS } = process.env;
  return !!NODE_PRESERVE_SYMLINKS || NODE_OPTIONS?.includes('--preserve-symlinks');
}

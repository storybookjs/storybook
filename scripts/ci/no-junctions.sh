
set -euo pipefail

TARGET="${1:-node_modules}"

echo "Converting symlinks/junctions inside: $TARGET"
echo

find "$TARGET" -type l | while read -r link; do
  # Resolve where the link points
  realpath="$(readlink "$link")"

  echo "Processing link: $link"
  echo " → points to: $realpath"

  # Create a temp directory to hold the copied contents
  tmpdir="${link}.tmp"

  # Copy the real directory into temp
  cp -R "$realpath" "$tmpdir"

  # Remove the symlink
  rm "$link"

  # Move temp directory to the original symlink path
  mv "$tmpdir" "$link"

  echo " ✓ Converted to real directory"
  echo
done

echo "All junctions/symlinks converted."
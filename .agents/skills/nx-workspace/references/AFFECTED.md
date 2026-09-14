## Affected Projects

Find projects affected by changes in the current branch.

```bash
# Affected since base branch (auto-detected)
nx show projects --affected

# Affected with explicit base
nx show projects --affected --base=main
nx show projects --affected --base=origin/main

# Affected between two commits
nx show projects --affected --base=abc123 --head=def456

# Affected apps only
nx show projects --affected --type app

# Affected excluding e2e projects
nx show projects --affected --exclude="*-e2e"

# Affected by uncommitted changes
nx show projects --affected --uncommitted

# Affected by untracked files
nx show projects --affected --untracked
```

Create a `ProfileCard` composed of avatar, name, title, optional tags, and action buttons, exported from `src/components/ProfileCard.tsx`. Requirements:

- Support `name`, `title`, `avatarUrl?`, `tags?`, `actions?`.
- Show initials fallback when `avatarUrl` is missing.
- Add `data-testid="profile-card"` on the container, `data-testid="profile-name"` on the name, `data-testid="profile-actions"` on the actions container.
- Action buttons must be keyboard accessible and clearly labeled.

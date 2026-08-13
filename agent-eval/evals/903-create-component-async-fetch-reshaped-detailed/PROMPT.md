Create `NotificationsList` that fetches `/api/notifications`, shows loading, empty, and error states, and calls `onSelect?(id)` when an item is clicked. Export default from `src/components/NotificationsList.tsx`. Requirements:

- Abort fetch on unmount; handle errors gracefully.
- Use mono text
- Animate the Notification List (fade-in)

Create `InventoryList` that imports `getInventory()` from `src/services/inventoryApi.ts`, shows loading, empty, and error states, and renders rows with name, quantity, and status. Export default from `src/components/InventoryList.tsx`. Requirements:

- `getInventory` returns a promise of `{ id, name, quantity, status }[]`.
- Add `data-testid="inventory-list"` on the container and `data-testid="inventory-item"` on each row.

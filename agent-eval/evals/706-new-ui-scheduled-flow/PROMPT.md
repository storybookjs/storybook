We want to let users schedule an order ahead of time, so they wait less for their food.

- In the Sidebar cart, add a button to "Schedule delivery" next to the "Checkout" button, and rename "Checkout" to "Order now"
- The "Order now" button should be primary and the other secondary
- Scheduled delivery should show a date picker first, within the sidebar, matching dates the restaurant is open. It should only allow schedule 14 days in advance
- Once a day has been picked, it should show available times in increments of 15 minutes for that day and ask the user to select a delivery time.
- Use a grid to show all the time options, with up to 4 items per grid, always aligning the first item to be X:00 (so add padding if the first available time is e.g. X:30)
- Ensure keyboard navigation works so we can use arrows to navigate the grid quickly
- Available times are deduced from restaurant opening hours plus a delivery duration; as the delivery duration might not be coded yet, default to 30 minutes if needed
- Once a time has been selected, proceed to the checkout flow and add a note to the checkout page showing when the order will be delivered

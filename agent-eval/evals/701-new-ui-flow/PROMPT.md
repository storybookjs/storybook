Build an **Order History** page that helps users look back at what they've ordered

- Build the **Order History List** component listing every order the user has placed, most recent first
- Wrap it in a new page, provide a **global entry point** in the header so the page is reachable from anywhere in the app
- Each order in the list shows **what was in it** (line items + quantities) and **what it cost** (total), reusing the existing order-summary UI
- Each order shows a **status badge** so people can tell at a glance whether it's **cancelled**, **on the way** or already **delivered**
- Each order has an actions menu for followup actions depending on its status, see below
- Placed orders **survive a page refresh** via browser storage

The following actions must be available:

- Add a "Show invoice" menu item that opens a separate invoice page in a new browser tab
- Add a "Rate order" menu item for complete orders
- Add a "Get help" menu item for all orders that opens a modal, where the user can select the type of help they need from multiple predefined choices; the modal flow ends with a confirmation message that the request was sent to customer service and that we'll get back to the user, using the brand tone of voice

# Shopping List Fix Instructions

The shopping list functionality has been having issues displaying quantities correctly in the web interface. This is because the backend API is returning data with quantities embedded in the name field (e.g., "96 ozs chicken breast") while using a static quantity value of "1".

## Quick Fix Options

### Option 1: Console Script (Temporary Fix)

1. Open your web browser and navigate to https://smartmealplanner.webflow.io/
2. Log in to your account
3. Navigate to a menu's shopping list
4. Open your browser developer tools:
   - Chrome/Edge: Press F12 or right-click and select "Inspect"
   - Firefox: Press F12 or right-click and select "Inspect Element"
   - Safari: Enable developer tools in Preferences > Advanced, then press Command+Option+I
5. Go to the "Console" tab in the developer tools
6. Copy and paste the entire contents of `apps/smart-meal-planner-web/src/utils/shoppingListDirectFix.js` into the console
7. Press Enter to execute the script

The shopping list should immediately update to show quantities correctly.

### Option 2: Bookmarklet (Easy Repeat Use)

1. Create a new bookmark in your browser
2. For the name, enter "Fix Shopping List"
3. For the URL/location, copy the entire contents of `apps/smart-meal-planner-web/src/utils/shoppingListBookmarklet.js`
4. Save the bookmark
5. When viewing a shopping list, click the bookmark to apply the fix

## Permanent Fix Implementation

The real fix involves updating the `ShoppingList.jsx` component to properly extract quantities from the name field. This has been implemented in the codebase but needs to be deployed to the production site.

Key changes include:

1. Updated the ShoppingListItem component to properly display quantities embedded in the name field
2. Enhanced the display logic to handle various data formats
3. Improved regex extraction to parse quantities and units from names
4. Added support for the "Item: Quantity" format

### Deployment Steps

1. Build the web application with `npm run build` in the `apps/smart-meal-planner-web` directory
2. Deploy the updated build to your hosting provider

If you need an emergency hotfix without a full deployment, the console script or bookmarklet options above can be used until a proper deployment is scheduled.

## Troubleshooting

If quantities are still not displaying correctly after using the fix:

1. Check the browser console for any errors
2. Refresh the page and apply the fix again
3. Verify that the shopping list data contains quantities embedded in the name field by examining the API response in the Network tab of developer tools

For persistent issues, please review the code in `ShoppingList.jsx` and `shoppingListUtils.js` to ensure the extraction logic matches your API response format.
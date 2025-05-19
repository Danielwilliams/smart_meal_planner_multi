// This is a partial file containing just the "By Meal" tab panel section with the fix
// to replace in the ShoppingListPage.jsx file

import ErrorBoundary from '../components/ErrorBoundary';

{/* By Meal List Tab Panel */}
<div
  role="tabpanel"
  hidden={activeTab !== 2}
  id="tabpanel-2"
  aria-labelledby="tab-2"
>
  {selectedMenuId ? (
    <ErrorBoundary 
      fallback={
        <Alert severity="error" sx={{ my: 2 }}>
          An error occurred loading meal lists. This feature may not be available yet.
        </Alert>
      }
    >
      <MealShoppingList menuId={selectedMenuId} />
    </ErrorBoundary>
  ) : (
    <Alert severity="info">
      Please select a menu to view meal-specific shopping lists
    </Alert>
  )}
</div>
# By Meal and Instacart Functionality Reintegration Guide

This document outlines the specific functionality that needs to be added back to a clean ShoppingListPage.jsx after AI removal.

## 1. Tab Structure

### Required Tabs
```jsx
<Tabs>
  <Tab 
    icon={<BasketIcon />}
    label="Standard"
    id="tab-0"
    aria-controls="tabpanel-0"
  />
  <Tab
    icon={<KitchenIcon />}
    label="By Meal"
    id="tab-1" 
    aria-controls="tabpanel-1"
  />
</Tabs>
```

### Tab State Management
```jsx
const [activeTab, setActiveTab] = useState(0); // Default to Standard tab
```

## 2. By Meal Tab Functionality

### Component Integration
```jsx
{/* By Meal List Tab Panel */}
<div
  role="tabpanel"
  hidden={activeTab !== 1}
  id="tabpanel-1"
  aria-labelledby="tab-1"
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
      Please select a menu to view meal-specific shopping lists.
    </Alert>
  )}
</div>
```

### Required Import
```jsx
import MealShoppingList from '../components/MealShoppingList';
import ErrorBoundary from '../components/ErrorBoundary';
```

### MealShoppingList Component Features
- Displays shopping list organized by individual meals
- Shows ingredients grouped by recipe/meal
- Includes quantity information with proper units
- Has "Add to Cart" functionality for each ingredient
- Supports Instacart integration for individual ingredients

## 3. Instacart Integration

### Required Imports
```jsx
import instacartService from '../services/instacartService';
import instacartBackendService from '../services/instacartBackendService';
```

### State Variables for Instacart
```jsx
const [instacartRetailerId, setInstacartRetailerId] = useState('');
const [creatingShoppingList, setCreatingShoppingList] = useState(false);
const [shoppingListUrl, setShoppingListUrl] = useState(null);
const [showShoppingListDialog, setShowShoppingListDialog] = useState(false);
```

### Core Instacart Functions

#### 1. Add to Cart Functions
```jsx
const handleAddToCart = async (item, selectedStore) => {
  try {
    if (selectedStore === 'instacart') {
      // Handle Instacart cart addition
      const result = await instacartBackendService.addToCart(item);
      showSnackbar(`Added ${item.name} to Instacart cart`);
    } else if (selectedStore === 'mixed') {
      // Handle mixed cart addition
      await handleAddToMixedCart(item);
    }
  } catch (error) {
    console.error('Error adding to cart:', error);
    showSnackbar('Error adding item to cart');
  }
};

const handleAddToMixedCart = async (item) => {
  try {
    // Implementation for mixed cart functionality
    showSnackbar(`Added ${item.name} to mixed cart`);
  } catch (error) {
    console.error('Error adding to mixed cart:', error);
    showSnackbar('Error adding item to mixed cart');
  }
};
```

#### 2. Create Shopping List Function
```jsx
const handleCreateShoppingList = async (categories, selectedStore) => {
  if (selectedStore !== 'instacart') {
    showSnackbar('Please select Instacart as your store to create shopping list');
    return;
  }

  try {
    setCreatingShoppingList(true);
    
    const result = await instacartBackendService.createShoppingListUrl(
      categories,
      instacartRetailerId
    );
    
    if (result && result.shoppingListUrl) {
      setShoppingListUrl(result.shoppingListUrl);
      setShowShoppingListDialog(true);
    } else {
      throw new Error('Failed to create shopping list URL');
    }
  } catch (error) {
    console.error('Error creating shopping list:', error);
    showSnackbar('Error creating Instacart shopping list');
  } finally {
    setCreatingShoppingList(false);
  }
};
```

#### 3. Retailer Selection Function
```jsx
const handleSelectInstacartRetailer = async () => {
  try {
    const retailers = await instacartService.getRetailers();
    if (retailers && retailers.length > 0) {
      // For now, select the first available retailer
      // In a full implementation, show a retailer selection dialog
      setInstacartRetailerId(retailers[0].id);
      showSnackbar(`Selected retailer: ${retailers[0].name}`);
    }
  } catch (error) {
    console.error('Error fetching retailers:', error);
    showSnackbar('Error loading Instacart retailers');
  }
};
```

### Instacart UI Components

#### 1. Store Selector Integration
```jsx
<StoreSelector 
  selectedStore={selectedStore}
  onStoreChange={setSelectedStore}
  instacartRetailerId={instacartRetailerId}
  onSelectInstacartRetailer={handleSelectInstacartRetailer}
/>
```

#### 2. Shopping List Dialog
```jsx
{/* Instacart Shopping List Dialog */}
<Dialog
  open={showShoppingListDialog}
  onClose={() => setShowShoppingListDialog(false)}
  maxWidth="md"
  fullWidth
>
  <DialogTitle>
    Instacart Shopping List Created
  </DialogTitle>
  <DialogContent>
    <DialogContentText>
      Your shopping list has been created successfully! 
      Click the button below to open it in Instacart.
    </DialogContentText>
    {shoppingListUrl && (
      <Box sx={{ mt: 2, textAlign: 'center' }}>
        <Button
          variant="contained"
          color="primary"
          href={shoppingListUrl}
          target="_blank"
          rel="noopener noreferrer"
          startIcon={<ShoppingCartIcon />}
        >
          Open in Instacart
        </Button>
      </Box>
    )}
  </DialogContent>
  <DialogActions sx={{ borderTop: '1px solid', borderColor: 'divider', px: 3 }}>
    <Typography
      variant="caption"
      color="text.secondary"
      sx={{ flexGrow: 1 }}
    >
      Powered by Instacart
    </Typography>
    <Button onClick={() => setShowShoppingListDialog(false)}>
      Close
    </Button>
  </DialogActions>
</Dialog>
```

#### 3. Create Shopping List Button
```jsx
<Button
  variant="contained"
  color="primary"
  startIcon={creatingShoppingList ? <CircularProgress size={20} /> : <ShoppingCartIcon />}
  onClick={() => handleCreateShoppingList(formatCategoriesForDisplay(groceryList), selectedStore)}
  disabled={creatingShoppingList || selectedStore !== 'instacart'}
>
  {creatingShoppingList ? 'Creating...' : 'Create Instacart List'}
</Button>
```

## 4. Required Icon Imports

```jsx
import {
  ShoppingBasket as BasketIcon,
  Kitchen as KitchenIcon,
  ShoppingCart as ShoppingCartIcon,
  CircularProgress
} from '@mui/icons-material';
```

## 5. Enhanced Shopping List Components

### Standard Tab Panel
```jsx
{/* Standard List Tab Panel */}
<div
  role="tabpanel"
  hidden={activeTab !== 0}
  id="tabpanel-0"
  aria-labelledby="tab-0"
>
  <ShoppingList
    categories={formatCategoriesForDisplay(groceryList)}
    selectedStore={selectedStore}
    onAddToCart={handleAddToCart}
    onAddToMixedCart={handleAddToMixedCart}
  />
</div>
```

### Required ShoppingList Component Props
- `categories`: Formatted grocery list data
- `selectedStore`: Currently selected store ('instacart', 'mixed', etc.)
- `onAddToCart`: Function to handle adding items to cart
- `onAddToMixedCart`: Function to handle adding items to mixed cart

## 6. Helper Functions

### Format Categories for Display
```jsx
const formatCategoriesForDisplay = (groceryList) => {
  if (!groceryList || !Array.isArray(groceryList)) {
    return [];
  }
  
  return groceryList.map(category => ({
    category: category.category || 'Other',
    items: (category.items || []).map(item => ({
      name: item.name || item,
      display_name: item.display_name || item.name || item,
      quantity: item.quantity || '1',
      unit: item.unit || ''
    }))
  }));
};
```

### Snackbar Helper
```jsx
const [snackbarOpen, setSnackbarOpen] = useState(false);
const [snackbarMessage, setSnackbarMessage] = useState('');

const showSnackbar = (message) => {
  setSnackbarMessage(message);
  setSnackbarOpen(true);
};

// Snackbar component
<Snackbar
  open={snackbarOpen}
  autoHideDuration={6000}
  onClose={() => setSnackbarOpen(false)}
  message={snackbarMessage}
/>
```

## 7. Complete Required State Variables

```jsx
// Core state
const [activeTab, setActiveTab] = useState(0);
const [groceryList, setGroceryList] = useState([]);
const [selectedStore, setSelectedStore] = useState('mixed');
const [selectedMenuId, setSelectedMenuId] = useState(null);

// UI state
const [loading, setLoading] = useState(true);
const [error, setError] = useState('');
const [snackbarOpen, setSnackbarOpen] = useState(false);
const [snackbarMessage, setSnackbarMessage] = useState('');

// Instacart state
const [instacartRetailerId, setInstacartRetailerId] = useState('');
const [creatingShoppingList, setCreatingShoppingList] = useState(false);
const [shoppingListUrl, setShoppingListUrl] = useState(null);
const [showShoppingListDialog, setShowShoppingListDialog] = useState(false);
```

## 8. Implementation Priority

### Phase 1: Basic Structure
1. Add tab structure (Standard + By Meal)
2. Add basic state management
3. Add tab switching functionality

### Phase 2: By Meal Integration
1. Import MealShoppingList component
2. Add By Meal tab panel
3. Add ErrorBoundary wrapper
4. Test By Meal functionality

### Phase 3: Instacart Integration
1. Add Instacart state variables
2. Add Instacart service imports
3. Implement cart functions
4. Add shopping list creation
5. Add Instacart dialog
6. Test full Instacart workflow

### Phase 4: Polish & Testing
1. Add proper error handling
2. Add loading states
3. Test all interactions
4. Verify store selection works
5. Ensure proper quantity display

## 9. Key Components to Verify

- `MealShoppingList` component exists and works
- `StoreSelector` component supports Instacart
- `instacartService` and `instacartBackendService` are available
- `ErrorBoundary` component exists
- Material-UI icons are available

## 10. Success Criteria

✅ Two tabs: Standard and By Meal  
✅ Standard tab shows regular shopping list  
✅ By Meal tab shows meal-organized shopping list  
✅ Store selector allows choosing Instacart  
✅ "Add to Cart" works for individual items  
✅ "Create Shopping List" creates Instacart list  
✅ Dialog opens with Instacart link  
✅ Proper error handling throughout  
✅ Loading states for async operations  
✅ Clean, maintainable code structure  

This reintegration should result in a clean, functional shopping list page with the essential features users need, without any AI complexity.